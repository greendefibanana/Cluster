import fs from "fs";
import path from "path";
import { ClusterFiCoordinator, defaultAgents } from "../gateway/openClawCoordinator.js";
import { MockZeroGProvider } from "../gateway/zeroGProvider.js";

async function main() {
  const coordinator = new ClusterFiCoordinator({ zeroGProvider: new MockZeroGProvider() });
  const agents = defaultAgents();
  const events = [
    (await coordinator.runMemeLaunchWorkflow({ agents })).feedPost,
    (await coordinator.runLpYieldWorkflow({ agents })).feedPost,
    (await coordinator.runPredictionMarketWorkflow({ agents })).feedPost,
  ];
  fs.mkdirSync(path.join(process.cwd(), "deployments"), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), "deployments", "seed-feed-events.json"), JSON.stringify(events, null, 2));
  console.log(JSON.stringify(events, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
