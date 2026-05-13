import { expect } from "chai";
import hre from "hardhat";
import { TTLCache } from "../packages/intelligence/cache/index.js";
import {
  buildDefiStrategyContext,
  buildOnchainStateContext,
  buildPredictionStrategyContext,
  validateContextSchema,
} from "../packages/intelligence/context-builder/index.js";
import { getTokenPrices, getTopYieldOpportunities } from "../packages/intelligence/data-adapters/defillama/index.js";
import { searchPredictionMarkets, getMarketOdds } from "../packages/intelligence/data-adapters/prediction/index.js";
import { fetchRssFeed, searchNews } from "../packages/intelligence/data-adapters/news/index.js";
import { createMemoryByokRegistry } from "../packages/intelligence/providers/index.js";
import { validatePolicy } from "../packages/intelligence/policy-engine/index.js";
import { uploadDefiStrategyProof, uploadInferenceTrace } from "../packages/intelligence/proofs/index.js";
import { AgentReputationService } from "../packages/intelligence/reputation/index.js";
import { DeFiYieldAdapter, linkStrategyToSovereignAccount } from "../packages/intelligence/sovereign/index.js";
import { MockZeroGProvider } from "../gateway/zeroGProvider.js";

describe("ClusterFi free-first v1 intelligence layer", function () {
  const originalFetch = globalThis.fetch;

  afterEach(function () {
    globalThis.fetch = originalFetch;
  });

  it("normalizes DeFiLlama prices and yield opportunities from public endpoints", async function () {
    globalThis.fetch = mockFetch((url) => {
      if (String(url).includes("prices/current")) {
        return { coins: { "coingecko:usd-coin": { price: 1, symbol: "USDC", timestamp: 1 } } };
      }
      if (String(url).includes("yields.llama.fi/pools")) {
        return {
          data: [
            { pool: "1", chain: "Ethereum", project: "aave-v3", symbol: "USDC", tvlUsd: 5_000_000, apy: 4.2, stablecoin: true },
            { pool: "2", chain: "Ethereum", project: "tiny", symbol: "USDC", tvlUsd: 10_000, apy: 400, stablecoin: false, ilRisk: "yes" },
          ],
        };
      }
      return {};
    });

    const prices = await getTokenPrices(["coingecko:usd-coin"]);
    const yields = await getTopYieldOpportunities({ chain: "Ethereum", symbol: "USDC", minTvlUsd: 100_000 });

    expect(prices.prices["coingecko:usd-coin"].price).to.equal(1);
    expect(yields.opportunities).to.have.length(1);
    expect(yields.opportunities[0].project).to.equal("aave-v3");
  });

  it("normalizes Polymarket search results, odds, liquidity, and volume fields", async function () {
    globalThis.fetch = mockFetch(() => ([
      {
        id: "market-1",
        question: "Will BTC hit 100k?",
        active: true,
        closed: false,
        outcomes: "[\"Yes\",\"No\"]",
        outcomePrices: "[\"0.62\",\"0.38\"]",
        clobTokenIds: "[\"yes-token\",\"no-token\"]",
        liquidityNum: "50000",
        volume24hr: "12000",
      },
    ]));

    const result = await searchPredictionMarkets("BTC 100k");
    const odds = await getMarketOdds(result.markets[0]);

    expect(result.markets[0].question).to.include("BTC");
    expect(odds.odds[0]).to.include({ outcome: "Yes", probability: 0.62 });
  });

  it("normalizes RSS and GDELT news items", async function () {
    globalThis.fetch = mockFetch((url) => {
      if (String(url).includes("gdeltproject.org")) {
        return { articles: [{ title: "Crypto bill advances", url: "https://example.com/1", seendate: "20260513080000", domain: "example.com" }] };
      }
      return `<?xml version="1.0"?><rss><channel><item><title>Fed decision</title><link>https://example.com/2</link><pubDate>Wed, 13 May 2026 09:00:00 GMT</pubDate><description>Markets react</description></item></channel></rss>`;
    });

    const rss = await fetchRssFeed("https://example.com/feed.xml");
    const gdelt = await searchNews("crypto policy");

    expect(rss.items[0].title).to.equal("Fed decision");
    expect(gdelt.items[0].publishedAt).to.equal("2026-05-13T08:00:00.000Z");
  });

  it("validates normalized context schemas", function () {
    const defi = buildDefiStrategyContext({ chain: "Ethereum", asset: "USDC", prices: {}, yields: [], tvl: {}, volume: {}, fees: {}, revenue: {}, stablecoinContext: {}, liquidityState: {}, riskNotes: [], sources: [] });
    const prediction = buildPredictionStrategyContext({ query: "btc", markets: [], odds: [], liquidity: {}, volume: {}, eventNews: [], marketStatus: "active", closeDate: "2026-12-31", riskNotes: [], sources: [] });
    const onchain = buildOnchainStateContext({ chain: "ethereum", balances: [], liquidityChecks: [], protocolState: {}, poolState: {} });

    expect(validateContextSchema(defi, "DefiStrategyContext").ok).to.equal(true);
    expect(validateContextSchema(prediction, "PredictionStrategyContext").ok).to.equal(true);
    expect(validateContextSchema(onchain, "OnchainStateContext").ok).to.equal(true);
  });

  it("stores BYOK keys encrypted and resolves free-first providers", async function () {
    const registry = createMemoryByokRegistry();
    const masked = registry.storeUserKey({ userId: "user-1", provider: "openai", apiKey: "sk-user-secret" });
    const health = await registry.healthCheck({ userId: "user-1", provider: "mock" });

    expect(masked.apiKey).to.match(/^\*\*\*\*/);
    expect(registry.store.state.providerCredentials[0].encryptedApiKey).to.not.include("sk-user-secret");
    expect(health.ok).to.equal(true);
  });

  it("enforces policy checks before any Sovereign Account action can be linked", function () {
    const context = buildDefiStrategyContext({
      chain: "Ethereum",
      asset: "USDC",
      prices: {},
      yields: [],
      tvl: { tvl: 5_000_000 },
      volume: {},
      fees: {},
      revenue: {},
      stablecoinContext: {},
      liquidityState: { topPoolTvlUsd: 2_000_000 },
      riskNotes: [],
      sources: ["defillama"],
    });
    const approved = validatePolicy({
      context,
      strategy: { riskScore: 40, strategyPlan: { allocationUsd: 100 } },
      permissions: { executionApproved: true, paused: false },
    });
    const rejected = validatePolicy({
      context,
      strategy: { riskScore: 90, strategyPlan: { allocationUsd: 10_000 } },
      permissions: { executionApproved: false },
    });

    expect(approved.approved).to.equal(true);
    expect(approved.executableActions[0].adapter).to.equal("DeFiYieldAdapter");
    expect(rejected.approved).to.equal(false);
    expect(rejected.rejectionReasons).to.not.be.empty;
  });

  it("serves stale cache fallback during provider cooldowns", async function () {
    let now = 1_000;
    const cache = new TTLCache({ defaultTtlMs: 10, now: () => now });
    await cache.getOrFetch("key", async () => ({ ok: true }), { ttlMs: 10 });
    now = 2_000;
    const stale = await cache.getOrFetch("key", async () => {
      throw new Error("rate limited");
    }, { allowStale: true, cooldownMs: 1_000 });

    expect(stale.value.ok).to.equal(true);
    expect(stale.cacheStatus).to.equal("stale-error");
  });

  it("uploads strategy proofs and inference traces to existing 0G storage providers", async function () {
    const zeroG = new MockZeroGProvider({ namespace: "free-v1-test" });
    const proof = await uploadDefiStrategyProof({ strategyId: "strategy-1", ok: true }, { zeroGStorage: zeroG, publishDA: false });
    const trace = await uploadInferenceTrace({ traceId: "trace-1", ok: true }, { zeroGStorage: zeroG });

    expect(proof.proofURI).to.match(/^0g:\/\//);
    expect(trace.uri).to.match(/^0g:\/\//);
  });

  it("updates reputation from policy-safe strategy outcomes", function () {
    const service = new AgentReputationService();
    service.recordStrategyOutcome({ agentId: "agent-1", strategyId: "s1", policyApproved: true, pnlUsd: 20, userAdoption: 3 });
    const result = service.validatePredictionResult({ market: "m1", resolution: "yes", thesis: { recommendation: "yes" } });
    service.recordStrategyOutcome({ agentId: "agent-1", strategyId: "s2", policyApproved: true, predictionCorrect: result.correct, userAdoption: 2 });

    expect(service.updateAgentReputation("agent-1").score).to.be.greaterThan(50);
  });

  it("links approved strategy intents to Sovereign Accounts without custody transfer", function () {
    const context = buildDefiStrategyContext({ chain: "Ethereum", asset: "USDC", protocol: "aave", prices: {}, yields: [], tvl: {}, volume: {}, fees: {}, revenue: {}, stablecoinContext: {}, liquidityState: {}, riskNotes: [], sources: [] });
    const intent = new DeFiYieldAdapter().buildIntent({ context, policyDecision: { approved: true }, allocationUsd: 100 });
    const link = linkStrategyToSovereignAccount({ sovereignAccount: "0xSovereign", adapterIntent: intent, proofURI: "0g://proof", userApproval: false });

    expect(link.custody).to.equal("user-retained");
    expect(link.executionEnabled).to.equal(false);
  });

  it("compiles the production DeFiYieldAdapter placeholder through Hardhat", async function () {
    const Factory = await hre.ethers.getContractFactory("DeFiYieldAdapter");
    const adapter = await Factory.deploy();
    await adapter.waitForDeployment();
    expect(await adapter.adapterType()).to.equal(hre.ethers.encodeBytes32String("DEFI_YIELD"));
  });
});

function mockFetch(handler) {
  return async (url) => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => handler(url),
    text: async () => String(handler(url)),
  });
}
