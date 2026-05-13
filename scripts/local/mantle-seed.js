import "dotenv/config";
import { seedLocalMantle } from "./harness.js";

const result = await seedLocalMantle();
console.log(JSON.stringify({
  deployment: result.deployment,
  seeded: {
    agentId: result.seeded.agentId.toString(),
    agentTba: result.seeded.agentTba,
    clusterId: result.seeded.clusterId.toString(),
    clusterTba: result.seeded.clusterTba,
    sovereignAccount: result.seeded.sovereignAccountAddress,
    depositAmount: result.seeded.depositAmount.toString(),
  },
}, null, 2));
