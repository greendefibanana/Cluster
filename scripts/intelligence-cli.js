import "dotenv/config";
import { createIntelligenceRouter } from "../gateway/intelligence/router.js";
import { JsonIntelligenceStore } from "../gateway/intelligence/store.js";
import { createZeroGStorageProvider } from "../gateway/zeroG/storageProvider.js";
import { createZeroGDAProvider } from "../gateway/zeroG/daProvider.js";
import { ClusterFiCoordinator, defaultAgents } from "../gateway/openClawCoordinator.js";

const command = process.argv[2];
const args = parseArgs(process.argv.slice(3));
const store = new JsonIntelligenceStore();
const router = createIntelligenceRouter({ store });
const userId = args.user || args.userId || "demo-user";
const agentId = args.agent || args.agentId || "agent-1";

try {
  const result = await run(command);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

async function run(name) {
  switch (name) {
    case "setup-managed-user":
      store.upsertUser({ id: userId, walletAddress: args.wallet || null });
      store.setAgentConfig({
        userId,
        agentId,
        mode: "MANAGED",
        primaryProvider: args.provider || "dgrid",
        fallbackProviders: (args.fallback || "0g-compute,mock").split(","),
        model: args.model || "openai/gpt-4o-mini",
        personality: args.personality || "capital markets operator",
        riskProfile: args.risk || "moderate",
        systemPrompt: args.systemPrompt || "You are a ClusterFi agent. Return structured, verifiable capital markets intelligence.",
      });
      return { user: userId, agent: agentId, mode: "MANAGED" };
    case "add-credits":
      return { credits: store.addCredits(userId, Number(args.amount || 10)) };
    case "set-agent-managed":
      return { config: store.setAgentConfig({ userId, agentId, mode: "MANAGED", primaryProvider: args.provider || "dgrid", fallbackProviders: (args.fallback || "0g-compute,mock").split(","), model: args.model || "openai/gpt-4o-mini" }) };
    case "set-agent-byok":
      if (!args.provider || !args.apiKey) throw new Error("--provider and --apiKey are required for BYOK");
      store.storeProviderCredential({ userId, agentId, provider: args.provider, apiKey: args.apiKey, endpointUrl: args.endpointUrl || null });
      return { config: store.setAgentConfig({ userId, agentId, mode: "BYOK", primaryProvider: args.provider, fallbackProviders: (args.fallback || "").split(",").filter(Boolean), model: args.model || "custom" }) };
    case "test-provider":
      return router.healthCheck(args.provider || "mock", args.mode || "MANAGED", userId, agentId);
    case "run-sleuth-alpha":
      return runInference("sleuth-alpha", args.prompt || "Find alpha in Farcaster meme and LP rotation.");
    case "run-quant-strategy":
      return runInference("quant-strategy", args.prompt || "Design a non-custodial LP/yield strategy with risk limits.");
    case "run-pnl-report":
      return runInference("pnl-report", args.prompt || "Explain PnL, TVL, drawdown, and validation inputs for strategy demo-yield.");
    case "show-usage":
      return { usage: store.getUsageEvents({ userId }) };
    case "show-balance":
      return { credits: store.getCredits(userId) };
    case "0g-upload-proof":
      return createZeroGStorageProvider(args.mode || "mock").uploadValidationProof(args.claim || "demo-claim", { userId, agentId, payload: args.payload || "demo-proof" });
    case "0g-read-proof": {
      if (!args.uri) throw new Error("--uri required");
      return createZeroGStorageProvider("mock").readZeroGObject(args.uri);
    }
    case "0g-publish-activity":
      return createZeroGDAProvider(args.mode || "mock").publishAgentActivityLog({ userId, agentId, action: args.action || "demo-activity" });
    case "workflow-sleuth-alpha":
      return coordinator().runSleuthAlphaWorkflow({ agents: defaultAgents(), context: args.prompt });
    default:
      throw new Error(`Unknown intelligence command: ${name}`);
  }
}

function runInference(taskType, prompt) {
  return router.runAgentInference({
    userId,
    agentId,
    taskType,
    providerMode: args.mode || undefined,
    provider: args.provider,
    model: args.model,
    messages: [{ role: "user", content: prompt }],
  });
}

function coordinator() {
  return new ClusterFiCoordinator({
    intelligenceRouter: router,
    userId,
    zeroGProvider: createZeroGStorageProvider(process.env.ZERO_G_PROVIDER || "mock"),
    zeroGDAProvider: createZeroGDAProvider(process.env.ZERO_G_DA_PROVIDER || "mock"),
  });
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
