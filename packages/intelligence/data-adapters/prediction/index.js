import { fetchJsonWithRetry, freeDataCache, withQuery } from "../../cache/index.js";
import { buildPredictionStrategyContext } from "../../context-builder/index.js";

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

export async function searchPredictionMarkets(query, options = {}) {
  if (!query) throw new Error("query is required");
  const url = withQuery(`${GAMMA_API}/markets`, {
    active: options.active ?? true,
    closed: options.closed ?? false,
    limit: options.limit || 50,
    search: query,
  });
  const { value, cacheStatus, stale } = await freeDataCache.getOrFetch(`polymarket:search:${url}`, () => fetchJsonWithRetry(url), {
    ttlMs: options.ttlMs ?? 60_000,
    source: url,
  });
  const markets = normalizeMarkets(Array.isArray(value) ? value : value.data || [])
    .filter((market) => matchesQuery(market, query))
    .filter((market) => options.active === undefined || market.active === Boolean(options.active))
    .filter((market) => options.closed === undefined || market.closed === Boolean(options.closed))
    .slice(0, options.limit || 20);
  return { markets, cacheStatus, stale: Boolean(stale), source: url };
}

export async function getTrendingPredictionMarkets(options = {}) {
  const url = withQuery(`${GAMMA_API}/markets`, {
    active: true,
    closed: false,
    limit: options.limit || 25,
    order: options.order || "volume24hr",
    ascending: false,
  });
  const { value, cacheStatus, stale } = await freeDataCache.getOrFetch(`polymarket:trending:${url}`, () => fetchJsonWithRetry(url), {
    ttlMs: options.ttlMs ?? 60_000,
    source: url,
  });
  return { markets: normalizeMarkets(Array.isArray(value) ? value : value.data || []), cacheStatus, stale: Boolean(stale), source: url };
}

export async function getMarketById(marketId, options = {}) {
  if (!marketId) throw new Error("marketId is required");
  const directUrl = `${GAMMA_API}/markets/${encodeURIComponent(marketId)}`;
  const fetcher = async () => {
    try {
      return await fetchJsonWithRetry(directUrl);
    } catch {
      const fallbackUrl = withQuery(`${GAMMA_API}/markets`, { id: marketId, limit: 1 });
      const rows = await fetchJsonWithRetry(fallbackUrl);
      return Array.isArray(rows) ? rows[0] : rows.data?.[0];
    }
  };
  const { value, cacheStatus, stale } = await freeDataCache.getOrFetch(`polymarket:market:${marketId}`, fetcher, {
    ttlMs: options.ttlMs ?? 60_000,
    source: directUrl,
  });
  return { market: normalizeMarket(value), cacheStatus, stale: Boolean(stale), source: directUrl };
}

export async function getMarketOdds(marketIdOrMarket, options = {}) {
  const market = typeof marketIdOrMarket === "object" ? marketIdOrMarket : (await getMarketById(marketIdOrMarket, options)).market;
  const gammaOdds = market.outcomes.map((outcome, index) => ({
    outcome,
    probability: market.outcomePrices[index] ?? null,
    tokenId: market.clobTokenIds[index] ?? null,
    source: "gamma",
  }));
  if (!options.useClob || !market.clobTokenIds.length) return { odds: gammaOdds, source: "gamma", marketId: market.id };

  const clobOdds = await Promise.all(market.clobTokenIds.map(async (tokenId, index) => {
    const url = withQuery(`${CLOB_API}/price`, { token_id: tokenId, side: "BUY" });
    try {
      const { value } = await freeDataCache.getOrFetch(`polymarket:clob:price:${tokenId}`, () => fetchJsonWithRetry(url), {
        ttlMs: 30_000,
        source: url,
      });
      return { outcome: market.outcomes[index], probability: nullableNumber(value.price), tokenId, source: url };
    } catch {
      return gammaOdds[index];
    }
  }));
  return { odds: clobOdds, source: CLOB_API, marketId: market.id };
}

export async function getMarketLiquidity(marketIdOrMarket, options = {}) {
  const market = typeof marketIdOrMarket === "object" ? marketIdOrMarket : (await getMarketById(marketIdOrMarket, options)).market;
  return {
    marketId: market.id,
    liquidity: market.liquidity,
    liquidityNum: market.liquidityNum,
    liquidityClob: market.liquidityClob,
    source: "gamma",
  };
}

export async function getMarketVolume(marketIdOrMarket, options = {}) {
  const market = typeof marketIdOrMarket === "object" ? marketIdOrMarket : (await getMarketById(marketIdOrMarket, options)).market;
  return {
    marketId: market.id,
    volume: market.volume,
    volume24hr: market.volume24hr,
    volume1wk: market.volume1wk,
    source: "gamma",
  };
}

export async function buildPredictionMarketContext({ query, marketId = null, news = [], limit = 10 } = {}) {
  const markets = marketId
    ? [(await getMarketById(marketId)).market]
    : (await searchPredictionMarkets(query, { limit })).markets;
  const usableMarkets = markets.length ? markets : (await getTrendingPredictionMarkets({ limit })).markets.filter((market) => market.active && !market.closed);
  const odds = await Promise.all(usableMarkets.map((market) => getMarketOdds(market)));
  const liquidity = await Promise.all(usableMarkets.map((market) => getMarketLiquidity(market)));
  const volume = await Promise.all(usableMarkets.map((market) => getMarketVolume(market)));
  const primary = usableMarkets[0] || {};
  return buildPredictionStrategyContext({
    query: query || primary.question || "",
    markets: usableMarkets,
    odds,
    liquidity,
    volume,
    eventNews: news,
    marketStatus: primary.closed ? "closed" : primary.active ? "active" : "inactive",
    closeDate: primary.endDate || null,
    riskNotes: [
      primary.closed ? "market is closed" : null,
      Number(primary.liquidityNum || primary.liquidity || 0) < 1_000 ? "low liquidity market" : null,
      odds.some((item) => item.odds.some((row) => row.probability === null)) ? "some outcome odds are unavailable" : null,
    ].filter(Boolean),
    sources: [...new Set(markets.map((market) => market.source).filter(Boolean))],
  });
}

function normalizeMarkets(markets) {
  return markets.map(normalizeMarket).filter(Boolean);
}

function normalizeMarket(market) {
  if (!market) return null;
  return {
    id: String(market.id ?? market.conditionId ?? market.slug),
    conditionId: market.conditionId || null,
    slug: market.slug || null,
    question: market.question || market.title || "",
    description: market.description || "",
    active: Boolean(market.active),
    closed: Boolean(market.closed),
    archived: Boolean(market.archived),
    category: market.category || market.categorySlug || null,
    outcomes: parseArrayish(market.outcomes),
    outcomePrices: parseArrayish(market.outcomePrices).map(nullableNumber),
    clobTokenIds: parseArrayish(market.clobTokenIds),
    liquidity: nullableNumber(market.liquidity),
    liquidityNum: nullableNumber(market.liquidityNum),
    liquidityClob: nullableNumber(market.liquidityClob),
    volume: nullableNumber(market.volume),
    volume24hr: nullableNumber(market.volume24hr),
    volume1wk: nullableNumber(market.volume1wk),
    endDate: market.endDate || market.endDateIso || null,
    source: `${GAMMA_API}/markets/${market.id ?? market.conditionId ?? ""}`,
  };
}

function matchesQuery(market, query) {
  const haystack = `${market.question} ${market.description} ${market.category}`.toLowerCase();
  return String(query).toLowerCase().split(/\s+/).filter(Boolean).some((term) => haystack.includes(term));
}

function parseArrayish(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function nullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
