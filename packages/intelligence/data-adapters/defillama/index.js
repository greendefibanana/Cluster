import { fetchJsonWithRetry, freeDataCache, withQuery } from "../../cache/index.js";
import { buildDefiStrategyContext } from "../../context-builder/index.js";

const SOURCES = {
  prices: "https://coins.llama.fi/prices/current",
  yields: "https://yields.llama.fi/pools",
  protocols: "https://api.llama.fi/protocols",
  protocol: "https://api.llama.fi/protocol",
  chains: "https://api.llama.fi/v2/chains",
  stablecoins: "https://stablecoins.llama.fi/stablecoins",
  fees: "https://api.llama.fi/summary/fees",
  revenue: "https://api.llama.fi/summary/fees",
  volume: "https://api.llama.fi/summary/dexs",
};

export async function getTokenPrices(tokens = ["coingecko:usd-coin"], options = {}) {
  const ids = Array.isArray(tokens) ? tokens.join(",") : String(tokens);
  const url = withQuery(`${SOURCES.prices}/${encodeURIComponent(ids)}`, { searchWidth: options.searchWidth || "4h" });
  const { value, cacheStatus, stale } = await freeDataCache.getOrFetch(`defillama:prices:${url}`, () => fetchJsonWithRetry(url), {
    ttlMs: options.ttlMs ?? 60_000,
    source: SOURCES.prices,
  });
  return { prices: value.coins || {}, cacheStatus, stale: Boolean(stale), source: url };
}

export async function getYieldPools(filters = {}) {
  const { value, cacheStatus, stale } = await freeDataCache.getOrFetch("defillama:yields:pools", () => fetchJsonWithRetry(SOURCES.yields), {
    ttlMs: filters.ttlMs ?? 5 * 60_000,
    source: SOURCES.yields,
  });
  const rows = Array.isArray(value.data) ? value.data : [];
  const filtered = rows.filter((pool) => {
    if (filters.chain && String(pool.chain).toLowerCase() !== String(filters.chain).toLowerCase()) return false;
    if (filters.project && String(pool.project).toLowerCase() !== String(filters.project).toLowerCase()) return false;
    if (filters.symbol && !String(pool.symbol || "").toLowerCase().includes(String(filters.symbol).toLowerCase())) return false;
    if (filters.minTvlUsd && Number(pool.tvlUsd || 0) < Number(filters.minTvlUsd)) return false;
    return true;
  });
  return { pools: filtered.slice(0, filters.limit || 50).map(normalizeYieldPool), cacheStatus, stale: Boolean(stale), source: SOURCES.yields };
}

export async function getProtocolTvl(protocol, options = {}) {
  if (!protocol) throw new Error("protocol is required");
  const slug = String(protocol).toLowerCase();
  const url = `${SOURCES.protocol}/${encodeURIComponent(slug)}`;
  const { value, cacheStatus, stale } = await freeDataCache.getOrFetch(`defillama:protocol:${slug}`, () => fetchJsonWithRetry(url), {
    ttlMs: options.ttlMs ?? 5 * 60_000,
    source: url,
  });
  return {
    protocol: value.name || protocol,
    slug,
    tvl: value.tvl ?? lastTvl(value.chainTvls),
    chainTvls: value.chainTvls || {},
    category: value.category || null,
    cacheStatus,
    stale: Boolean(stale),
    source: url,
  };
}

export async function getChainTvl(chain = null, options = {}) {
  const { value, cacheStatus, stale } = await freeDataCache.getOrFetch("defillama:chains:tvl", () => fetchJsonWithRetry(SOURCES.chains), {
    ttlMs: options.ttlMs ?? 5 * 60_000,
    source: SOURCES.chains,
  });
  const chains = Array.isArray(value) ? value : [];
  const filtered = chain ? chains.filter((row) => String(row.name).toLowerCase() === String(chain).toLowerCase()) : chains;
  return { chains: filtered, cacheStatus, stale: Boolean(stale), source: SOURCES.chains };
}

export async function getProtocolFees(protocol, options = {}) {
  return getProtocolMetric("fees", protocol, options);
}

export async function getProtocolRevenue(protocol, options = {}) {
  return getProtocolMetric("revenue", protocol, { dataType: "dailyRevenue", ...options });
}

export async function getProtocolVolume(protocol, options = {}) {
  return getProtocolMetric("volume", protocol, { base: SOURCES.volume, dataType: "dailyVolume", ...options });
}

export async function getStablecoinContext(options = {}) {
  const url = withQuery(SOURCES.stablecoins, { includePrices: "true" });
  const { value, cacheStatus, stale } = await freeDataCache.getOrFetch("defillama:stablecoins", () => fetchJsonWithRetry(url), {
    ttlMs: options.ttlMs ?? 10 * 60_000,
    source: url,
  });
  const peggedAssets = Array.isArray(value.peggedAssets) ? value.peggedAssets : [];
  return {
    totalCirculatingUsd: value.totalCirculatingUSD || null,
    assets: peggedAssets.slice(0, options.limit || 25).map((asset) => ({
      id: asset.id,
      name: asset.name,
      symbol: asset.symbol,
      price: asset.price,
      circulatingUsd: asset.circulating?.peggedUSD ?? asset.circulatingPrevDay?.peggedUSD ?? null,
      chains: asset.chainCirculating || {},
    })),
    cacheStatus,
    stale: Boolean(stale),
    source: url,
  };
}

export async function getTopYieldOpportunities(filters = {}) {
  const { pools, cacheStatus, stale, source } = await getYieldPools({ ...filters, limit: 1_000 });
  const maxRisk = Number(filters.maxRiskScore ?? 75);
  const maxApy = Number(filters.maxApy ?? 80);
  const opportunities = pools
    .filter((pool) => pool.apy !== null)
    .map((pool) => ({ ...pool, riskScore: yieldRiskScore(pool), riskNotes: yieldRiskNotes(pool) }))
    .filter((pool) => pool.riskScore <= maxRisk)
    .filter((pool) => Number(pool.apy || 0) <= maxApy)
    .sort((a, b) => Number(b.apy || 0) - Number(a.apy || 0))
    .slice(0, filters.limit || 10);
  return { opportunities, cacheStatus, stale, source };
}

export async function buildDefiMarketContext({
  chain = "Ethereum",
  asset = "USDC",
  protocol = null,
  tokenIds = ["coingecko:usd-coin"],
  minTvlUsd = 1_000_000,
} = {}) {
  const [prices, yields, chainTvl, stablecoins, topYields] = await Promise.all([
    getTokenPrices(tokenIds),
    getYieldPools({ chain, symbol: asset, minTvlUsd, limit: 20 }),
    getChainTvl(chain),
    getStablecoinContext({ limit: 10 }),
    getTopYieldOpportunities({ chain, symbol: asset, minTvlUsd, limit: 5 }),
  ]);
  const [tvl, fees, revenue, volume] = protocol
    ? await Promise.all([
      getProtocolTvl(protocol).catch((error) => ({ error: error.message })),
      getProtocolFees(protocol).catch((error) => ({ error: error.message })),
      getProtocolRevenue(protocol).catch((error) => ({ error: error.message })),
      getProtocolVolume(protocol).catch((error) => ({ error: error.message })),
    ])
    : [chainTvl, null, null, null];

  return buildDefiStrategyContext({
    chain,
    asset,
    protocol,
    prices: prices.prices,
    yields: topYields.opportunities.length ? topYields.opportunities : yields.pools,
    tvl,
    volume,
    fees,
    revenue,
    stablecoinContext: stablecoins,
    liquidityState: {
      minTvlUsd,
      poolsChecked: yields.pools.length,
      topPoolTvlUsd: yields.pools[0]?.tvlUsd || null,
    },
    riskNotes: [
      ...new Set([
        ...topYields.opportunities.flatMap((pool) => pool.riskNotes || []),
        ...(prices.stale || yields.stale || chainTvl.stale ? ["one or more inputs served from stale cache"] : []),
      ]),
    ],
    sources: [prices.source, yields.source, chainTvl.source, stablecoins.source, topYields.source].filter(Boolean),
  });
}

async function getProtocolMetric(metric, protocol, options = {}) {
  if (!protocol) throw new Error("protocol is required");
  const base = options.base || SOURCES[metric] || SOURCES.fees;
  const dataType = options.dataType || "dailyFees";
  const url = withQuery(`${base}/${encodeURIComponent(String(protocol).toLowerCase())}`, { dataType });
  const { value, cacheStatus, stale } = await freeDataCache.getOrFetch(`defillama:${metric}:${url}`, () => fetchJsonWithRetry(url), {
    ttlMs: options.ttlMs ?? 5 * 60_000,
    source: url,
  });
  return {
    protocol,
    metric,
    total24h: value.total24h ?? value.totalDataChart?.at?.(-1)?.[1] ?? null,
    total7d: value.total7d ?? null,
    totalAllTime: value.totalAllTime ?? null,
    chart: value.totalDataChart || [],
    cacheStatus,
    stale: Boolean(stale),
    source: url,
  };
}

function normalizeYieldPool(pool) {
  return {
    pool: pool.pool,
    chain: pool.chain,
    project: pool.project,
    symbol: pool.symbol,
    tvlUsd: Number(pool.tvlUsd || 0),
    apy: nullableNumber(pool.apy),
    apyBase: nullableNumber(pool.apyBase),
    apyReward: nullableNumber(pool.apyReward),
    stablecoin: Boolean(pool.stablecoin),
    exposure: pool.exposure || null,
    ilRisk: pool.ilRisk || null,
    underlyingTokens: pool.underlyingTokens || [],
    rewardTokens: pool.rewardTokens || [],
  };
}

function yieldRiskScore(pool) {
  let score = 25;
  if (pool.tvlUsd < 1_000_000) score += 30;
  if (pool.tvlUsd < 250_000) score += 20;
  if (!pool.stablecoin) score += 15;
  if (Number(pool.apy || 0) > 50) score += 20;
  if (String(pool.ilRisk || "").toLowerCase() === "yes") score += 10;
  return Math.min(100, score);
}

function yieldRiskNotes(pool) {
  return [
    pool.tvlUsd < 1_000_000 ? "pool TVL below production threshold" : null,
    !pool.stablecoin ? "non-stable exposure" : null,
    Number(pool.apy || 0) > 50 ? "high APY may be incentive-driven or unstable" : null,
    String(pool.ilRisk || "").toLowerCase() === "yes" ? "impermanent loss risk" : null,
  ].filter(Boolean);
}

function nullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function lastTvl(chainTvls = {}) {
  const values = Object.values(chainTvls).flatMap((chain) => Array.isArray(chain.tvl) ? chain.tvl : []);
  return values.at(-1)?.totalLiquidityUSD ?? null;
}
