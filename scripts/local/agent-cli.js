import "dotenv/config";
import { runLocalDefiE2E, runLocalPredictionE2E } from "./harness.js";
import { uploadPolicyDecisionProof } from "../../packages/intelligence/proofs/index.js";
import { AgentReputationService } from "../../packages/intelligence/reputation/index.js";
import { createLocalZeroGProvider } from "../../gateway/zeroG/localProvider.js";

const command = process.argv[2] || commandFromLifecycle("demo:agent:") || "defi-yield";
const mode = process.env.TEST_MODE || "MOCK_ONLY";
const requireRealAI = process.env.REQUIRE_REAL_AI === "true";

const result = await run(command);
console.log(JSON.stringify({ command, mode, ...result }, null, 2));

async function run(name) {
  switch (name) {
    case "defi-yield":
      return runLocalDefiE2E({ mode, requireRealAI });
    case "prediction-thesis":
      return runLocalPredictionE2E({ mode, requireRealAI });
    case "policy-check": {
      const flow = await runLocalDefiE2E({ mode, requireRealAI: false });
      return { approved: flow.policyDecision.approved, policyDecision: flow.policyDecision, proofURI: flow.proofURI };
    }
    case "proof-upload": {
      const zeroGStorage = createLocalZeroGProvider();
      const proof = await uploadPolicyDecisionProof({ local: true, command: name, createdAt: new Date().toISOString() }, { zeroGStorage, publishDA: false });
      return { proofURI: proof.proofURI, rootHash: proof.rootHash };
    }
    case "reputation-update": {
      const service = new AgentReputationService();
      service.recordStrategyOutcome({ agentId: "local-agent", strategyId: "local-strategy", policyApproved: true, pnlUsd: 100, userAdoption: 1 });
      return service.updateAgentReputation("local-agent");
    }
    default:
      throw new Error(`Unknown local agent command: ${name}`);
  }
}

function commandFromLifecycle(prefix) {
  const event = process.env.npm_lifecycle_event || "";
  return event.startsWith(prefix) ? event.slice(prefix.length) : null;
}
