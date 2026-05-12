import { randomUUID } from "crypto";
import { createZeroGProvider } from "./zeroGProvider.js";
import { createZeroGDAProvider } from "./zeroG/daProvider.js";

const roles = {
  creator: "creator",
  quant: "quant",
  sleuth: "sleuth",
  marketing: "marketing",
  prediction: "prediction",
};

export class ClusterFiCoordinator {
  constructor({ zeroGProvider = createZeroGProvider("mock"), zeroGDAProvider = createZeroGDAProvider("mock"), intelligenceRouter = null, userId = "demo-user" } = {}) {
    this.zeroG = zeroGProvider;
    this.zeroGDA = zeroGDAProvider;
    this.intelligenceRouter = intelligenceRouter;
    this.userId = userId;
    this.sessions = [];
    this.actionLogs = [];
  }

  createSession(name, agents) {
    const session = {
      id: randomUUID(),
      name,
      agents,
      tasks: [],
      createdAt: new Date().toISOString(),
    };
    this.sessions.push(session);
    return session;
  }

  log(session, actor, action, payload) {
    const entry = {
      id: randomUUID(),
      sessionId: session.id,
      actor,
      action,
      payload,
      createdAt: new Date().toISOString(),
    };
    this.actionLogs.push(entry);
    session.tasks.push(entry);
    return entry;
  }

  async runMemeLaunchWorkflow({ clusterId = "cluster-1", agents = defaultAgents(), trend = "AI x meme rotation" } = {}) {
    const session = this.createSession("Meme Launch Workflow", agents);
    const strategyId = `meme-${randomUUID()}`;
    const sleuth = agents.find((agent) => agent.role === roles.sleuth);
    const creator = agents.find((agent) => agent.role === roles.creator);
    const marketing = agents.find((agent) => agent.role === roles.marketing);

    const alpha = await this.runIntelligenceTask({
      agent: sleuth,
      clusterId,
      workflowId: session.id,
      taskType: "sleuth-alpha",
      prompt: `Find a meme-market alpha thesis for this trend: ${trend}`,
    });
    this.log(session, sleuth, "find-trend", { trend, alpha: alpha.output });
    const concept = {
      name: "Proof of Meme",
      ticker: "POM",
      thesis: alpha.output?.thesis || `${trend} has strong social velocity`,
      confidence: alpha.output?.confidence || 0.72,
    };
    this.log(session, creator, "generate-concept", concept);
    const campaignResult = await this.runIntelligenceTask({
      agent: marketing,
      clusterId,
      workflowId: session.id,
      taskType: "marketing",
      prompt: `Create a Farcaster-ready campaign for ${JSON.stringify(concept)}`,
    });
    const campaign = {
      post: campaignResult.output?.posts?.[0] || "$POM packages agent-verified meme flow into a testnet launch.",
      campaignTitle: campaignResult.output?.campaignTitle || "Proof of Meme Launch",
      channels: ["feed", "farcaster"],
    };
    this.log(session, marketing, "create-campaign", campaign);

    const proof = await this.zeroG.uploadStrategyProof(strategyId, { workflow: "meme-launch", clusterId, alpha, concept, campaign, session });
    await this.zeroGDA.publishAgentActivityLog({ workflow: "meme-launch", strategyId, sessionId: session.id, proofURI: proof.uri });
    const feedPost = this.feedEvent({
      actorType: "cluster",
      actorId: clusterId,
      actionType: "CREATE_MEME",
      title: "Cluster launched a meme strategy",
      body: campaign.post,
      strategyId,
      instrumentType: "meme",
      proofURI: proof.uri,
      riskScore: 74,
    });
    return { workflow: "meme-launch", strategyId, session, proof, feedPost };
  }

  async runLpYieldWorkflow({ clusterId = "cluster-1", agents = defaultAgents(), pair = "BNB/USDT" } = {}) {
    const session = this.createSession("LP/Yield Workflow", agents);
    const strategyId = `yield-${randomUUID()}`;
    const quant = agents.find((agent) => agent.role === roles.quant);
    const strategy = await this.runIntelligenceTask({
      agent: quant,
      clusterId,
      workflowId: session.id,
      taskType: "quant-strategy",
      prompt: `Evaluate a ${pair} LP/yield opportunity with non-custodial Sovereign Accounts.`,
    });
    this.log(session, quant, "evaluate-opportunity", { pair, strategy: strategy.output });
    const proof = await this.zeroG.uploadStrategyProof(strategyId, { workflow: "lp-yield", pair, strategy, session });
    const pnl = await this.runIntelligenceTask({
      agent: quant,
      clusterId,
      workflowId: session.id,
      taskType: "pnl-report",
      prompt: `Prepare a demo PnL report for strategy ${strategyId}, pair ${pair}, TVL 88000 mUSD, PnL 1240.`,
      metadata: { strategyId },
    });
    const pnlProof = await this.zeroG.uploadPnLProof(strategyId, { pnl: pnl.output, currency: "mUSD" });
    await this.zeroGDA.publishStrategyExecutionLog({ workflow: "lp-yield", strategyId, proofURI: proof.uri, pnlProofURI: pnlProof.uri });
    const reputationEvent = { subjectType: "cluster", subjectId: clusterId, strategyId, eventType: "PNL_UPDATE", scoreDelta: 8, proofURI: pnlProof.uri };
    const feedPost = this.feedEvent({
      actorType: "cluster",
      actorId: clusterId,
      actionType: "RUN_YIELD_STRATEGY",
      title: `Quant agent opened ${pair} LP strategy`,
      body: `${strategy.output?.strategyName || "LP strategy"} proof uploaded to 0G storage and PnL tracking started.`,
      strategyId,
      instrumentType: "yield",
      proofURI: proof.uri,
      pnl: 1240,
      tvl: 88000,
      riskScore: 46,
    });
    return { workflow: "lp-yield", strategyId, session, proof, pnlProof, reputationEvent, feedPost };
  }

  async runPredictionMarketWorkflow({ clusterId = "cluster-1", agents = defaultAgents(), question = "Will BNB outperform ETH this week?" } = {}) {
    const session = this.createSession("Prediction Market Workflow", agents);
    const strategyId = `prediction-${randomUUID()}`;
    const prediction = agents.find((agent) => agent.role === roles.prediction);
    const sleuth = agents.find((agent) => agent.role === roles.sleuth);
    const thesis = await this.runIntelligenceTask({
      agent: prediction || sleuth,
      clusterId,
      workflowId: session.id,
      taskType: "sleuth-alpha",
      prompt: `Create a proof-backed prediction thesis for this market question: ${question}`,
    });
    this.log(session, sleuth, "collect-evidence", { question, thesis: thesis.output });
    this.log(session, prediction, "create-thesis", { question, thesis: thesis.output?.thesis, confidence: thesis.output?.confidence });
    const proof = await this.zeroG.uploadStrategyProof(strategyId, { workflow: "prediction-market", question, thesis, session });
    const validation = await this.zeroG.uploadSocialFeedProof(strategyId, { claimType: "MARKET_THESIS", question, status: "pending" });
    await this.zeroGDA.publishFeedProofBatch({ workflow: "prediction-market", strategyId, proofURI: proof.uri, validationURI: validation.uri });
    const feedPost = this.feedEvent({
      actorType: "cluster",
      actorId: clusterId,
      actionType: "OPEN_PREDICTION_MARKET",
      title: "Prediction agent opened a market",
      body: question,
      strategyId,
      instrumentType: "prediction",
      proofURI: validation.uri,
      riskScore: 62,
    });
    return { workflow: "prediction-market", strategyId, session, proof, validation, feedPost };
  }

  async runSleuthAlphaWorkflow({ clusterId = "cluster-1", agents = defaultAgents(), context = "Farcaster meme liquidity rotation" } = {}) {
    const session = this.createSession("Sleuth Alpha Workflow", agents);
    const sleuth = agents.find((agent) => agent.role === roles.sleuth);
    const alpha = await this.runIntelligenceTask({
      agent: sleuth,
      clusterId,
      workflowId: session.id,
      taskType: "sleuth-alpha",
      prompt: `Generate a ClusterFi alpha report from this context: ${context}`,
    });
    this.log(session, sleuth, "generate-alpha", alpha.output);
    const proof = await this.zeroG.uploadAlphaReport(`alpha-${session.id}`, { workflow: "sleuth-alpha", alpha, session });
    await this.zeroGDA.publishAgentActivityLog({ workflow: "sleuth-alpha", sessionId: session.id, proofURI: proof.uri });
    const feedPost = this.feedEvent({
      actorType: "agent",
      actorId: sleuth.id,
      actionType: "GENERATE_ALPHA",
      title: "Sleuth agent found alpha",
      body: alpha.output?.thesis || "New alpha report generated.",
      strategyId: `alpha-${session.id}`,
      instrumentType: alpha.output?.suggestedInstrumentType || "meme",
      proofURI: proof.uri,
      riskScore: Math.round((1 - Number(alpha.output?.confidence || 0.5)) * 100),
    });
    return { workflow: "sleuth-alpha", session, alpha, proof, feedPost };
  }

  async runMarketingCampaignWorkflow({ clusterId = "cluster-1", agents = defaultAgents(), strategy = "non-custodial agent LP strategy" } = {}) {
    const session = this.createSession("Marketing Campaign Workflow", agents);
    const marketing = agents.find((agent) => agent.role === roles.marketing);
    const campaign = await this.runIntelligenceTask({
      agent: marketing,
      clusterId,
      workflowId: session.id,
      taskType: "marketing",
      prompt: `Create a Farcaster-native campaign for: ${strategy}`,
    });
    this.log(session, marketing, "create-campaign", campaign.output);
    const proof = await this.zeroG.uploadSocialFeedProof(`campaign-${session.id}`, { workflow: "marketing", campaign, session });
    return { workflow: "marketing", session, campaign, proof };
  }

  async runPnlUpdateWorkflow({ clusterId = "cluster-1", agents = defaultAgents(), strategyId = "yield-demo" } = {}) {
    const session = this.createSession("PnL Update Workflow", agents);
    const quant = agents.find((agent) => agent.role === roles.quant);
    const pnl = await this.runIntelligenceTask({
      agent: quant,
      clusterId,
      workflowId: session.id,
      taskType: "pnl-report",
      prompt: `Explain and validate PnL for ${strategyId} with TVL 50000 and PnL 420.`,
      metadata: { strategyId },
    });
    this.log(session, quant, "validate-pnl", pnl.output);
    const proof = await this.zeroG.uploadPnLProof(strategyId, { workflow: "pnl-update", pnl, session });
    await this.zeroGDA.publishReputationBatch({ workflow: "pnl-update", strategyId, proofURI: proof.uri });
    return { workflow: "pnl-update", session, pnl, proof };
  }

  async runIntelligenceTask({ agent, clusterId, workflowId, taskType, prompt, metadata = {} }) {
    if (!this.intelligenceRouter) {
      return { output: fallbackIntelligenceOutput(taskType, prompt), provider: "local-fallback", usage: { totalTokens: 0 }, traceId: null };
    }
    return this.intelligenceRouter.runAgentInference({
      userId: this.userId,
      agentId: agent?.id || "agent-unknown",
      clusterId,
      workflowId,
      taskType,
      messages: [{ role: "user", content: prompt }],
      metadata,
    });
  }

  feedEvent({ actorType, actorId, actionType, title, body, strategyId, instrumentType, proofURI, pnl = 0, tvl = 0, riskScore = 50 }) {
    return {
      id: randomUUID(),
      actorType,
      actorId,
      actionType,
      title,
      body,
      strategyId,
      instrumentType,
      chainId: 97,
      contractAddress: null,
      proofURI,
      pnl,
      tvl,
      riskScore,
      createdAt: new Date().toISOString(),
    };
  }
}

function fallbackIntelligenceOutput(taskType, prompt) {
  if (taskType === "sleuth-alpha") {
    return {
      thesis: prompt,
      confidence: 0.66,
      sources: ["local-workflow"],
      riskFactors: ["mocked intelligence"],
      suggestedInstrumentType: "meme",
      proofSummary: "Local fallback output; no provider call was made.",
    };
  }
  if (taskType === "quant-strategy") {
    return {
      strategyName: "Local LP Fallback",
      instrumentType: "yield",
      expectedReturn: "demo only",
      riskScore: 50,
      allocationPlan: [],
      executionSteps: [],
      exitConditions: [],
    };
  }
  if (taskType === "pnl-report") {
    return {
      strategyId: "fallback",
      pnl: 0,
      tvl: 0,
      drawdown: 0,
      performanceSummary: "Local fallback PnL.",
      validationInputs: [],
    };
  }
  if (taskType === "marketing") {
    return {
      campaignTitle: "ClusterFi Strategy Update",
      posts: [prompt],
      targetAudience: "ClusterFi users",
      hooks: ["agent alpha"],
      assetsPrompt: "ClusterFi feed card",
    };
  }
  return { content: prompt };
}

export function defaultAgents() {
  return [
    { id: "agent-1", name: "Sight-3", role: roles.sleuth, skills: ["GENERATE_ALPHA"] },
    { id: "agent-2", name: "MintMuse", role: roles.creator, skills: ["CREATE_MEME"] },
    { id: "agent-3", name: "Nexus Quant", role: roles.quant, skills: ["DEPLOY_LP", "RUN_YIELD_STRATEGY", "VALIDATE_PNL"] },
    { id: "agent-4", name: "Hype Relay", role: roles.marketing, skills: ["MARKET_STRATEGY"] },
    { id: "agent-5", name: "Odds Oracle", role: roles.prediction, skills: ["OPEN_PREDICTION_MARKET"] },
  ];
}
