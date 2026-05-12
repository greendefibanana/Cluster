const adapterProfiles = {
  solanaMeme: { name: "SolanaMemeAdapter", chain: "Solana", risk: 82, eventType: "meme_launch" },
  hyperliquid: { name: "HyperliquidAdapter", chain: "Hyperliquid", risk: 74, eventType: "cross_chain_execution" },
  ethereumYield: { name: "EthereumYieldAdapter", chain: "Ethereum", risk: 46, eventType: "lp_opened" },
  bnbLaunch: { name: "BNBLaunchAdapter", chain: "BNB Chain", risk: 68, eventType: "meme_launch" },
  mantleYield: { name: "MantleYieldAdapter", chain: "Mantle", risk: 34, eventType: "strategy_opened" },
  predictionMarket: { name: "PredictionMarketAdapter", chain: "Mantle", risk: 61, eventType: "prediction_market_created" },
};

export class ChainExecutionAdapter {
  constructor(profile) {
    this.profile = profile;
  }

  validateIntent(intent) {
    return Boolean(intent.userSovereignAccount && intent.asset && Number(intent.amount) > 0 && intent.adapter);
  }

  estimateRisk(intent) {
    return Math.min(100, this.profile.risk + Math.floor(Number(intent.amount || 0) / 10_000));
  }

  estimateFees(intent) {
    return {
      executionFee: Number(intent.amount) * 0.0008,
      chain: this.profile.chain,
    };
  }

  async simulate(intent) {
    return {
      adapter: this.profile.name,
      valid: this.validateIntent(intent),
      riskScore: this.estimateRisk(intent),
      fees: this.estimateFees(intent),
    };
  }

  async execute(intent, bridgeReceipt) {
    if (!this.validateIntent(intent)) {
      throw new Error(`${this.profile.name} rejected invalid intent`);
    }
    return {
      adapter: this.profile.name,
      chain: this.profile.chain,
      eventType: this.profile.eventType,
      status: "executed",
      executionHash: `${bridgeReceipt.receiptHash}:exec`,
      pnl: 0,
      tvl: Number(intent.amount),
      riskScore: this.estimateRisk(intent),
    };
  }

  async generateProof(intent, execution) {
    return {
      adapter: this.profile.name,
      intent,
      execution,
      validationObject: this.generateValidationObject(intent, execution),
    };
  }

  generateValidationObject(intent, execution) {
    return {
      claimType: this.profile.eventType,
      subject: intent.userSovereignAccount,
      chain: this.profile.chain,
      status: execution.status,
      riskScore: execution.riskScore,
    };
  }
}

export function createChainAdapter(kind) {
  const profile = adapterProfiles[kind];
  if (!profile) {
    throw new Error(`Unknown chain adapter ${kind}`);
  }
  return new ChainExecutionAdapter(profile);
}

export function adapterKindForStrategy(strategyType) {
  if (strategyType === "solana-meme") return "solanaMeme";
  if (strategyType === "eth-yield") return "ethereumYield";
  if (strategyType === "hyperliquid") return "hyperliquid";
  if (strategyType === "bnb-launch") return "bnbLaunch";
  if (strategyType === "prediction") return "predictionMarket";
  return "mantleYield";
}
