import { buildDefiMarketContext } from "./data-adapters/defillama/index.js";
import { buildPredictionMarketContext } from "./data-adapters/prediction/index.js";
import { buildNewsContext } from "./data-adapters/news/index.js";
import { taskPrompt, validateStrategyOutput } from "./agent-tasks/index.js";
import { validatePolicy } from "./policy-engine/index.js";
import { uploadDefiStrategyProof, uploadPredictionStrategyProof, uploadPolicyDecisionProof } from "./proofs/index.js";
import { DeFiYieldAdapter, linkStrategyToSovereignAccount, PredictionMarketAdapter } from "./sovereign/index.js";
import { AgentReputationService } from "./reputation/index.js";
import { createIntelligenceRouter } from "../../gateway/intelligence/router.js";
import { MemoryIntelligenceStore } from "../../gateway/intelligence/store.js";
import { MockProvider } from "../../gateway/intelligence/providers/mockProvider.js";
import { MockZeroGProvider } from "../../gateway/zeroGProvider.js";

export async function runFreeDefiFlow(options = {}) {
  const context = options.context || await buildDefiMarketContext({
    chain: options.chain || "Ethereum",
    asset: options.asset || "USDC",
    protocol: options.protocol || null,
    minTvlUsd: Number(options.minTvlUsd || 1_000_000),
  });
  const router = options.router || demoRouter();
  const taskType = options.taskType || "defi-yield-analysis";
  const inference = await router.runAgentInference({
    userId: options.userId || "demo-user",
    agentId: options.agentId || "defi-agent",
    taskType,
    providerMode: "BYOK",
    provider: options.provider || "mock",
    fallbackProviders: [],
    responseSchema: {
      required: ["recommendation", "confidence", "riskScore", "reasoning", "strategyPlan", "exitConditions", "sources"],
    },
    messages: [{ role: "user", content: taskPrompt({ taskType, context }) }],
  });
  ensureStrategyOutput(inference.output);
  const policyDecision = validatePolicy({
    context,
    strategy: inference.output,
    permissions: { executionApproved: true, paused: false },
    policy: options.policy || {},
  });
  const proof = await uploadDefiStrategyProof({ context, strategy: inference.output, policyDecision, traceId: inference.traceId }, {
    zeroGStorage: options.zeroGStorage,
    zeroGDA: options.zeroGDA,
    publishDA: options.publishDA ?? true,
  });
  const adapterIntent = policyDecision.approved
    ? new DeFiYieldAdapter({ adapterAddress: options.adapterAddress }).buildIntent({ context, policyDecision, allocationUsd: options.allocationUsd || 100 })
    : null;
  const sovereignLink = adapterIntent
    ? linkStrategyToSovereignAccount({ sovereignAccount: options.sovereignAccount || "demo-sovereign-account", adapterIntent, proofURI: proof.proofURI, userApproval: false })
    : null;
  const policyProof = await uploadPolicyDecisionProof({ contextType: "defi", policyDecision, proofURI: proof.proofURI }, { zeroGStorage: options.zeroGStorage, publishDA: false });
  return { context, inference, policyDecision, proof, policyProof, adapterIntent, sovereignLink };
}

export async function runFreePredictionFlow(options = {}) {
  const eventContext = options.eventContext || await buildNewsContext({
    query: options.query || "crypto regulation prediction market",
    rssFeeds: options.rssFeeds || [],
    limit: 5,
  });
  const context = options.context || await buildPredictionMarketContext({
    query: options.query || "bitcoin",
    news: eventContext.items,
    limit: Number(options.limit || 5),
  });
  const router = options.router || demoRouter();
  const taskType = options.taskType || "prediction-market-thesis";
  const inference = await router.runAgentInference({
    userId: options.userId || "demo-user",
    agentId: options.agentId || "prediction-agent",
    taskType,
    providerMode: "BYOK",
    provider: options.provider || "mock",
    fallbackProviders: [],
    responseSchema: {
      required: ["recommendation", "confidence", "riskScore", "reasoning", "strategyPlan", "exitConditions", "sources"],
    },
    messages: [{ role: "user", content: taskPrompt({ taskType, context }) }],
  });
  ensureStrategyOutput(inference.output);
  const policyDecision = validatePolicy({
    context,
    strategy: inference.output,
    permissions: { executionApproved: true, paused: false },
    policy: options.policy || {},
  });
  const proof = await uploadPredictionStrategyProof({ context, strategy: inference.output, policyDecision, traceId: inference.traceId }, {
    zeroGStorage: options.zeroGStorage,
    zeroGDA: options.zeroGDA,
    publishDA: options.publishDA ?? true,
  });
  const adapterIntent = policyDecision.approved
    ? new PredictionMarketAdapter({ adapterAddress: options.adapterAddress }).buildIntent({ context, policyDecision, allocationUsd: options.allocationUsd || 50 })
    : null;
  const reputation = new AgentReputationService();
  reputation.recordStrategyOutcome({
    agentId: options.agentId || "prediction-agent",
    strategyId: inference.traceId,
    type: "prediction",
    policyApproved: policyDecision.approved,
    userAdoption: adapterIntent ? 1 : 0,
  });
  return { eventContext, context, inference, policyDecision, proof, adapterIntent, reputation: reputation.updateAgentReputation(options.agentId || "prediction-agent") };
}

function demoRouter() {
  const store = new MemoryIntelligenceStore({ encryptionKey: "clusterfi-free-v1-demo-key" });
  store.setAgentConfig({ userId: "demo-user", agentId: "defi-agent", mode: "BYOK", primaryProvider: "mock", fallbackProviders: [] });
  store.setAgentConfig({ userId: "demo-user", agentId: "prediction-agent", mode: "BYOK", primaryProvider: "mock", fallbackProviders: [] });
  return createIntelligenceRouter({
    store,
    zeroGStorage: new MockZeroGProvider({ namespace: "clusterfi-free-v1" }),
    managedProviders: { mock: new MockProvider() },
  });
}

function ensureStrategyOutput(output) {
  const validation = validateStrategyOutput(output);
  if (!validation.ok) {
    throw new Error(`Strategy output missing fields: ${validation.missing.join(", ")}`);
  }
}
