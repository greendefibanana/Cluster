import { BaseProvider, estimateTokens } from "./base.js";

export class MockProvider extends BaseProvider {
  constructor() {
    super({ name: "mock", supportedModels: ["mock-fast", "mock-structured"] });
  }

  async runInference({ model = "mock-fast", messages = [], responseSchema, metadata = {}, taskType = "general" }) {
    const prompt = messages.map((message) => message.content).join("\n").slice(0, 280);
    const output = mockOutputForTask(taskType, prompt, responseSchema);
    const inputTokens = estimateTokens(messages);
    const outputTokens = estimateTokens([{ role: "assistant", content: JSON.stringify(output) }]);
    return {
      output,
      raw: { model, mocked: true, metadata },
      usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      providerRequestId: `mock-${Date.now()}`,
    };
  }
}

function mockOutputForTask(taskType, prompt) {
  if (taskType === "sleuth-alpha" || taskType === "meme-launch") {
    return {
      thesis: "AI agent capital rotation is accelerating through social distribution.",
      confidence: 0.72,
      sources: ["mock-social-feed", "mock-chain-flow"],
      riskFactors: ["thin liquidity", "narrative reversal"],
      suggestedInstrumentType: "meme",
      proofSummary: `Mock sleuth proof from prompt: ${prompt.slice(0, 80)}`,
    };
  }
  if (taskType === "quant-strategy" || taskType === "lp-yield") {
    return {
      strategyName: "Bounded LP Rotation",
      instrumentType: "yield",
      expectedReturn: "12-18% APY demo range",
      riskScore: 48,
      allocationPlan: [{ asset: "mUSD", weight: 0.7 }, { asset: "BNB", weight: 0.3 }],
      executionSteps: ["open isolated Sovereign Account", "route only through whitelisted LP adapter", "rebalance on slippage breach"],
      exitConditions: ["drawdown > 6%", "pool liquidity drops below threshold"],
    };
  }
  if (taskType === "pnl-report") {
    return {
      strategyId: "mock-strategy",
      pnl: 124.42,
      tvl: 5000,
      drawdown: 0.018,
      performanceSummary: "Mock PnL stayed positive with controlled drawdown.",
      validationInputs: ["sovereign-account-balance", "adapter-position-snapshot"],
    };
  }
  if (taskType === "marketing" || taskType === "social-post") {
    return {
      campaignTitle: "Agents that post alpha you can fund",
      posts: ["Quant strategy live. Open your own Sovereign Account, keep custody, follow the execution."],
      targetAudience: "Farcaster DeFi users",
      hooks: ["social alpha", "non-custodial Sovereign Accounts"],
      assetsPrompt: "Kinetic dashboard with agent strategy cards and proof badges",
    };
  }
  return { content: `Mock intelligence response for ${taskType}: ${prompt}` };
}
