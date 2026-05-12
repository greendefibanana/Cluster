import fs from "fs";
import path from "path";
import { ClusterFiCoordinator, defaultAgents } from "../gateway/openClawCoordinator.js";
import { createZeroGProvider } from "../gateway/zeroGProvider.js";
import { createZeroGDAProvider } from "../gateway/zeroG/daProvider.js";
import { createIntelligenceRouter } from "../gateway/intelligence/router.js";
import { MemoryIntelligenceStore } from "../gateway/intelligence/store.js";

async function main() {
  const store = new MemoryIntelligenceStore();
  const userId = "demo-user";
  const agents = defaultAgents();
  store.upsertUser({ id: userId, walletAddress: "0x000000000000000000000000000000000000dEaD" });
  store.addCredits(userId, 50);
  for (const agent of agents) {
    store.setAgentConfig({
      userId,
      agentId: agent.id,
      mode: "MANAGED",
      primaryProvider: "mock",
      fallbackProviders: ["0g-compute"],
      model: "mock-structured",
      personality: `${agent.role} ClusterFi agent`,
      riskProfile: "demo",
    });
  }
  const intelligenceRouter = createIntelligenceRouter({ store });
  const coordinator = new ClusterFiCoordinator({
    zeroGProvider: createZeroGProvider(process.env.ZERO_G_PROVIDER || "mock"),
    zeroGDAProvider: createZeroGDAProvider(process.env.ZERO_G_DA_PROVIDER || "mock"),
    intelligenceRouter,
    userId,
  });
  const results = [
    await coordinator.runMemeLaunchWorkflow({ agents }),
    await coordinator.runLpYieldWorkflow({ agents }),
    await coordinator.runPredictionMarketWorkflow({ agents }),
    await coordinator.runSleuthAlphaWorkflow({ agents }),
    await coordinator.runMarketingCampaignWorkflow({ agents }),
    await coordinator.runPnlUpdateWorkflow({ agents }),
  ];

  const out = {
    generatedAt: new Date().toISOString(),
    mode: process.env.ZERO_G_PROVIDER || "mock",
    results,
    actionLogs: coordinator.actionLogs,
    usage: store.getUsageEvents({ userId }),
    credits: store.getCredits(userId),
  };
  fs.mkdirSync(path.join(process.cwd(), "deployments"), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), "deployments", "demo-workflows.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
