import "dotenv/config";
import {
  defillama,
  prediction,
  news,
  onchain,
  validatePolicy,
  uploadDefiStrategyProof,
  uploadPredictionStrategyProof,
  uploadPolicyDecisionProof,
  AgentReputationService,
  DeFiYieldAdapter,
  linkStrategyToSovereignAccount,
} from "../packages/intelligence/index.js";
import { runFreeDefiFlow, runFreePredictionFlow } from "../packages/intelligence/demo-flows.js";

const command = process.argv[2];
const args = parseArgs(process.argv.slice(3));

try {
  const result = await run(command);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}

async function run(name) {
  switch (name) {
    case "defi:market-context":
      return defillama.buildDefiMarketContext({
        chain: args.chain || "Ethereum",
        asset: args.asset || "USDC",
        protocol: args.protocol || null,
        minTvlUsd: Number(args.minTvlUsd || 1_000_000),
      });
    case "defi:yield-analysis":
      return runFreeDefiFlow({ chain: args.chain, asset: args.asset, protocol: args.protocol, taskType: "defi-yield-analysis", publishDA: args.publishDA === "true" });
    case "defi:risk-review":
      return runFreeDefiFlow({ chain: args.chain, asset: args.asset, protocol: args.protocol, taskType: "defi-risk-review", publishDA: args.publishDA === "true" });
    case "prediction:search":
      return prediction.searchPredictionMarkets(args.query || "bitcoin", { limit: Number(args.limit || 10) });
    case "prediction:thesis":
      return runFreePredictionFlow({ query: args.query || "bitcoin", taskType: "prediction-market-thesis", publishDA: args.publishDA === "true" });
    case "prediction:risk-review":
      return runFreePredictionFlow({ query: args.query || "bitcoin", taskType: "prediction-market-risk-review", publishDA: args.publishDA === "true" });
    case "policy:validate": {
      const context = args.kind === "prediction"
        ? await prediction.buildPredictionMarketContext({ query: args.query || "bitcoin", limit: 3 })
        : await defillama.buildDefiMarketContext({ chain: args.chain || "Ethereum", asset: args.asset || "USDC", protocol: args.protocol || null });
      return validatePolicy({
        context,
        strategy: { riskScore: Number(args.riskScore || 45), strategyPlan: { allocationUsd: Number(args.allocationUsd || 100) } },
        permissions: { executionApproved: args.executionApproved !== "false", paused: args.paused === "true" },
      });
    }
    case "proof:upload":
      return uploadPolicyDecisionProof({ demo: true, command: name, createdAt: new Date().toISOString() }, { publishDA: args.publishDA === "true" });
    case "reputation:update": {
      const service = new AgentReputationService();
      service.recordStrategyOutcome({
        agentId: args.agentId || "demo-agent",
        strategyId: args.strategyId || "demo-strategy",
        policyApproved: args.policyApproved !== "false",
        pnlUsd: Number(args.pnlUsd || 0),
        predictionCorrect: args.predictionCorrect === undefined ? undefined : args.predictionCorrect === "true",
        userAdoption: Number(args.userAdoption || 1),
      });
      return service.updateAgentReputation(args.agentId || "demo-agent");
    }
    case "sovereign:flow": {
      const flow = await runFreeDefiFlow({ chain: args.chain, asset: args.asset, protocol: args.protocol, publishDA: args.publishDA === "true" });
      const intent = flow.adapterIntent || new DeFiYieldAdapter().buildIntent({
        context: flow.context,
        policyDecision: { approved: true },
        allocationUsd: 100,
      });
      return linkStrategyToSovereignAccount({
        sovereignAccount: args.sovereignAccount || "demo-sovereign-account",
        adapterIntent: intent,
        proofURI: flow.proof.proofURI,
        userApproval: args.userApproval === "true",
      });
    }
    case "news:context":
      return news.buildNewsContext({ query: args.query || "crypto", rssFeeds: (args.rss || "").split(",").filter(Boolean) });
    case "onchain:chain-state":
      return onchain.getChainState({ chain: args.chain || "ethereum", rpcUrl: args.rpcUrl });
    case "defi:proof":
      return uploadDefiStrategyProof({ demo: "defi", createdAt: new Date().toISOString() }, { publishDA: args.publishDA === "true" });
    case "prediction:proof":
      return uploadPredictionStrategyProof({ demo: "prediction", createdAt: new Date().toISOString() }, { publishDA: args.publishDA === "true" });
    default:
      throw new Error(`Unknown free v1 demo command: ${name}`);
  }
}

function parseArgs(values) {
  const parsed = {};
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
