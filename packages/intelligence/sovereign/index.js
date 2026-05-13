export class DeFiYieldAdapter {
  constructor({ adapterAddress = null, chain = "Mantle" } = {}) {
    this.name = "DeFiYieldAdapter";
    this.adapterAddress = adapterAddress;
    this.chain = chain;
  }

  buildIntent({ context, policyDecision, allocationUsd }) {
    ensureApproved(policyDecision);
    return {
      adapter: this.name,
      adapterAddress: this.adapterAddress,
      strategyType: "defi-yield",
      chain: context.chain || this.chain,
      protocol: context.protocol,
      asset: context.asset,
      allocationUsd,
      proofRequired: true,
      custody: "user-retained",
      permissions: ["user-approve-allocation", "revoke-anytime", "pause-execution", "withdraw-freely"],
    };
  }
}

export class PredictionMarketAdapter {
  constructor({ adapterAddress = null } = {}) {
    this.name = "PredictionMarketAdapter";
    this.adapterAddress = adapterAddress;
  }

  buildIntent({ context, policyDecision, allocationUsd }) {
    ensureApproved(policyDecision);
    return {
      adapter: this.name,
      adapterAddress: this.adapterAddress,
      strategyType: "prediction-market",
      markets: (context.markets || []).map((market) => ({ id: market.id, question: market.question })),
      allocationUsd,
      proofRequired: true,
      custody: "user-retained",
      permissions: ["user-approve-allocation", "revoke-anytime", "pause-execution", "withdraw-freely"],
    };
  }
}

export class PerpsAdapter {
  constructor() {
    this.name = "PerpsAdapter";
    this.placeholder = true;
  }
}

export class MemeAdapter {
  constructor() {
    this.name = "MemeAdapter";
    this.placeholder = true;
  }
}

export function linkStrategyToSovereignAccount({ sovereignAccount, adapterIntent, proofURI, userApproval = false }) {
  if (!sovereignAccount) throw new Error("sovereignAccount is required");
  return {
    sovereignAccount,
    adapterIntent,
    proofURI,
    userApprovalRequired: !userApproval,
    executionEnabled: Boolean(userApproval),
    custody: "user-retained",
    revokePath: "SovereignAccount.revokeAgent / removeAdapter / pause / withdraw",
  };
}

function ensureApproved(policyDecision) {
  if (!policyDecision?.approved) {
    throw new Error(`Policy decision is not approved: ${(policyDecision?.rejectionReasons || []).join("; ")}`);
  }
}
