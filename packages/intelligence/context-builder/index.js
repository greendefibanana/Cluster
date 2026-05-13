export const contextSchemas = {
  DefiStrategyContext: {
    required: ["type", "chain", "asset", "prices", "yields", "tvl", "volume", "fees", "revenue", "stablecoinContext", "liquidityState", "riskNotes", "timestamp", "sources"],
  },
  PredictionStrategyContext: {
    required: ["type", "query", "markets", "odds", "liquidity", "volume", "eventNews", "marketStatus", "closeDate", "riskNotes", "timestamp", "sources"],
  },
  OnchainStateContext: {
    required: ["chain", "balances", "liquidityChecks", "protocolState", "poolState", "timestamp"],
  },
};

export function buildDefiStrategyContext(input = {}) {
  return normalizeContext("DefiStrategyContext", {
    type: "defi",
    chain: input.chain || "all",
    asset: input.asset || "all",
    protocol: input.protocol || null,
    prices: input.prices || {},
    yields: input.yields || [],
    tvl: input.tvl || null,
    volume: input.volume || {},
    fees: input.fees || {},
    revenue: input.revenue || {},
    stablecoinContext: input.stablecoinContext || {},
    liquidityState: input.liquidityState || {},
    riskNotes: input.riskNotes || [],
    timestamp: input.timestamp || new Date().toISOString(),
    sources: input.sources || [],
  });
}

export function buildPredictionStrategyContext(input = {}) {
  return normalizeContext("PredictionStrategyContext", {
    type: "prediction",
    query: input.query || "",
    markets: input.markets || [],
    odds: input.odds || [],
    liquidity: input.liquidity || null,
    volume: input.volume || null,
    eventNews: input.eventNews || [],
    marketStatus: input.marketStatus || null,
    closeDate: input.closeDate || "unknown",
    riskNotes: input.riskNotes || [],
    timestamp: input.timestamp || new Date().toISOString(),
    sources: input.sources || [],
  });
}

export function buildOnchainStateContext(input = {}) {
  return normalizeContext("OnchainStateContext", {
    chain: input.chain || "unknown",
    balances: input.balances || [],
    liquidityChecks: input.liquidityChecks || [],
    protocolState: input.protocolState || null,
    poolState: input.poolState || null,
    timestamp: input.timestamp || new Date().toISOString(),
  });
}

export function validateContextSchema(context, schemaName) {
  const schema = contextSchemas[schemaName];
  if (!schema) throw new Error(`Unknown context schema: ${schemaName}`);
  const missing = schema.required.filter((key) => context?.[key] === undefined || context?.[key] === null);
  return { ok: missing.length === 0, missing };
}

function normalizeContext(schemaName, context) {
  const validation = validateContextSchema(context, schemaName);
  if (!validation.ok) {
    throw new Error(`${schemaName} missing required fields: ${validation.missing.join(", ")}`);
  }
  return context;
}
