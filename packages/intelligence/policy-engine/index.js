export const defaultPolicy = {
  minTvlUsd: 1_000_000,
  minLiquidityUsd: 25_000,
  maxDataAgeMs: 15 * 60_000,
  protocolAllowlist: [],
  chainAllowlist: ["Ethereum", "Polygon", "Arbitrum", "Optimism", "Base", "BSC", "Mantle", "Solana", "ethereum", "polygon", "arbitrum", "optimism", "base", "bsc", "mantle", "solana"],
  maxRiskScore: 75,
  maxAllocationUsd: 1_000,
  predictionMarketStatuses: ["active"],
  marketLiquidityThreshold: 1_000,
  requireExecutionPermission: true,
};

export function validatePolicy({ context, strategy, permissions = {}, policy = {} } = {}) {
  const effective = { ...defaultPolicy, ...policy };
  const warnings = [];
  const rejectionReasons = [];
  const executableActions = [];

  checkFreshness(context, effective, rejectionReasons, warnings);
  checkRisk(strategy, effective, rejectionReasons);
  checkAllocation(strategy, effective, rejectionReasons);
  checkPermissions(permissions, effective, rejectionReasons);

  if (context?.type === "defi") {
    checkDefiContext(context, effective, rejectionReasons, warnings);
    if (!rejectionReasons.length) {
      executableActions.push({
        type: "sovereign-adapter-intent",
        adapter: "DeFiYieldAdapter",
        chain: context.chain,
        protocol: context.protocol,
        maxAllocationUsd: effective.maxAllocationUsd,
      });
    }
  } else if (context?.type === "prediction") {
    checkPredictionContext(context, effective, rejectionReasons, warnings);
    if (!rejectionReasons.length) {
      executableActions.push({
        type: "sovereign-adapter-intent",
        adapter: "PredictionMarketAdapter",
        markets: (context.markets || []).map((market) => market.id),
        maxAllocationUsd: effective.maxAllocationUsd,
      });
    }
  } else {
    warnings.push("unknown context type; only generic policy checks applied");
  }

  return {
    approved: rejectionReasons.length === 0,
    warnings,
    rejectionReasons,
    executableActions,
  };
}

function checkFreshness(context, policy, rejectionReasons, warnings) {
  const timestamp = context?.timestamp ? new Date(context.timestamp).getTime() : 0;
  if (!timestamp || Number.isNaN(timestamp)) {
    rejectionReasons.push("context timestamp missing or invalid");
    return;
  }
  const age = Date.now() - timestamp;
  if (age > policy.maxDataAgeMs) {
    rejectionReasons.push("context data is stale");
  } else if (age > policy.maxDataAgeMs / 2) {
    warnings.push("context data is approaching stale threshold");
  }
}

function checkRisk(strategy, policy, rejectionReasons) {
  const riskScore = Number(strategy?.riskScore ?? 0);
  if (riskScore > policy.maxRiskScore) {
    rejectionReasons.push(`risk score ${riskScore} exceeds max ${policy.maxRiskScore}`);
  }
}

function checkAllocation(strategy, policy, rejectionReasons) {
  const allocation = Number(strategy?.allocationUsd ?? strategy?.strategyPlan?.allocationUsd ?? 0);
  if (allocation > policy.maxAllocationUsd) {
    rejectionReasons.push(`allocation ${allocation} exceeds max ${policy.maxAllocationUsd}`);
  }
}

function checkPermissions(permissions, policy, rejectionReasons) {
  if (!policy.requireExecutionPermission) return;
  if (permissions.paused) rejectionReasons.push("Sovereign Account is paused");
  if (permissions.executionApproved === false) rejectionReasons.push("execution permission not granted");
}

function checkDefiContext(context, policy, rejectionReasons, warnings) {
  if (policy.chainAllowlist.length && !policy.chainAllowlist.includes(context.chain)) {
    rejectionReasons.push(`chain not allowed: ${context.chain}`);
  }
  if (policy.protocolAllowlist.length && context.protocol && !policy.protocolAllowlist.includes(context.protocol)) {
    rejectionReasons.push(`protocol not allowed: ${context.protocol}`);
  }
  const tvl = Number(context.tvl?.tvl ?? context.tvl?.chains?.[0]?.tvl ?? context.liquidityState?.topPoolTvlUsd ?? 0);
  if (tvl && tvl < policy.minTvlUsd) {
    rejectionReasons.push(`TVL ${tvl} below minimum ${policy.minTvlUsd}`);
  }
  const liquidity = Number(context.liquidityState?.topPoolTvlUsd ?? context.liquidityState?.liquidityUsd ?? 0);
  if (liquidity && liquidity < policy.minLiquidityUsd) {
    rejectionReasons.push(`liquidity ${liquidity} below minimum ${policy.minLiquidityUsd}`);
  }
  if ((context.riskNotes || []).length) {
    warnings.push(...context.riskNotes);
  }
}

function checkPredictionContext(context, policy, rejectionReasons, warnings) {
  if (!policy.predictionMarketStatuses.includes(context.marketStatus)) {
    rejectionReasons.push(`prediction market status not allowed: ${context.marketStatus}`);
  }
  const liquidityRows = Array.isArray(context.liquidity) ? context.liquidity : [context.liquidity];
  const lowestLiquidity = Math.min(...liquidityRows.map((row) => Number(row?.liquidityNum ?? row?.liquidity ?? Infinity)));
  if (Number.isFinite(lowestLiquidity) && lowestLiquidity < policy.marketLiquidityThreshold) {
    rejectionReasons.push(`market liquidity ${lowestLiquidity} below threshold ${policy.marketLiquidityThreshold}`);
  }
  if ((context.riskNotes || []).length) {
    warnings.push(...context.riskNotes);
  }
}
