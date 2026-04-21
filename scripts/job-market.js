import "dotenv/config";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const deployment = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "deployments", "bsc-testnet.json"), "utf8")
);

const provider = new ethers.JsonRpcProvider(process.env.BSC_TESTNET_RPC_URL);

const jobMarketAbi = [
  "function createAgentJob(uint256 agentId, address evaluator, uint256 budget, uint256 expiredAt, string description) external returns (uint256)",
  "function createSwarmJob(uint256 swarmId, address evaluator, uint256 budget, uint256 expiredAt, string description, uint256[] creditedAgentIds) external returns (uint256)",
  "function fund(uint256 jobId, uint256 expectedBudget) external",
  "function submit(uint256 jobId, string deliverable) external",
  "function complete(uint256 jobId, string reason) external",
  "function reject(uint256 jobId, string reason) external",
  "function claimRefund(uint256 jobId) external",
  "function jobs(uint256 jobId) external view returns (address client, address evaluator, uint256 budget, uint256 expiredAt, uint8 providerKind, uint256 providerId, uint8 status, string description, string deliverable)",
  "function getCreditedAgentIds(uint256 jobId) external view returns (uint256[])",
  "function providerRecipient(uint256 jobId) external view returns (address)"
];

const erc20Abi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

const jobStatusNames = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired"];
const providerKindNames = ["Agent", "Swarm"];

async function main() {
  const action = requiredEnv("JOB_ACTION").toLowerCase();
  const signer = walletForAction(action);
  const jobMarket = new ethers.Contract(deployment.contracts.jobMarket, jobMarketAbi, signer);
  const paymentToken = new ethers.Contract(deployment.contracts.paymentToken, erc20Abi, signer);

  switch (action) {
    case "create-agent":
      await createAgentJob(jobMarket);
      break;
    case "create-swarm":
      await createSwarmJob(jobMarket);
      break;
    case "fund":
      await fundJob(jobMarket, paymentToken);
      break;
    case "submit":
      await submitJob(jobMarket);
      break;
    case "complete":
      await completeJob(jobMarket);
      break;
    case "reject":
      await rejectJob(jobMarket);
      break;
    case "refund":
      await refundJob(jobMarket);
      break;
    case "status":
      await showStatus(jobMarket, paymentToken);
      break;
    default:
      throw new Error(`Unsupported JOB_ACTION: ${action}`);
  }
}

async function createAgentJob(jobMarket) {
  const evaluator = evaluatorAddress();
  const budget = parseBudget();
  const expiredAt = resolveExpiry();
  const agentId = BigInt(requiredEnv("JOB_AGENT_ID"));
  const description = process.env.JOB_DESCRIPTION || "Hire agent for a discrete workforce task";

  const tx = await jobMarket.createAgentJob(agentId, evaluator, budget, expiredAt, description);
  const receipt = await tx.wait();
  const jobId = parseJobCreatedId(receipt, jobMarket.interface);
  console.log(`Created agent job ${jobId} in tx ${receipt.hash}`);
}

async function createSwarmJob(jobMarket) {
  const evaluator = evaluatorAddress();
  const budget = parseBudget();
  const expiredAt = resolveExpiry();
  const swarmId = BigInt(requiredEnv("JOB_SWARM_ID"));
  const description = process.env.JOB_DESCRIPTION || "Hire swarm for a packaged workforce task";
  const credited = parseUintList(requiredEnv("JOB_CREDITED_AGENT_IDS"));

  const tx = await jobMarket.createSwarmJob(swarmId, evaluator, budget, expiredAt, description, credited);
  const receipt = await tx.wait();
  const jobId = parseJobCreatedId(receipt, jobMarket.interface);
  console.log(`Created swarm job ${jobId} in tx ${receipt.hash}`);
}

async function fundJob(jobMarket, paymentToken) {
  const jobId = BigInt(requiredEnv("JOB_ID"));
  const job = await jobMarket.jobs(jobId);
  const tx1 = await paymentToken.approve(await jobMarket.getAddress(), job.budget);
  await tx1.wait();
  const tx2 = await jobMarket.fund(jobId, job.budget);
  const receipt = await tx2.wait();
  console.log(`Funded job ${jobId} with ${job.budget} in tx ${receipt.hash}`);
}

async function submitJob(jobMarket) {
  const jobId = BigInt(requiredEnv("JOB_ID"));
  const deliverable = process.env.JOB_DELIVERABLE || "ipfs://job-deliverable";
  const tx = await jobMarket.submit(jobId, deliverable);
  const receipt = await tx.wait();
  console.log(`Submitted job ${jobId} in tx ${receipt.hash}`);
}

async function completeJob(jobMarket) {
  const jobId = BigInt(requiredEnv("JOB_ID"));
  const reason = process.env.JOB_REASON || "deliverable accepted";
  const tx = await jobMarket.complete(jobId, reason);
  const receipt = await tx.wait();
  console.log(`Completed job ${jobId} in tx ${receipt.hash}`);
}

async function rejectJob(jobMarket) {
  const jobId = BigInt(requiredEnv("JOB_ID"));
  const reason = process.env.JOB_REASON || "deliverable rejected";
  const tx = await jobMarket.reject(jobId, reason);
  const receipt = await tx.wait();
  console.log(`Rejected job ${jobId} in tx ${receipt.hash}`);
}

async function refundJob(jobMarket) {
  const jobId = BigInt(requiredEnv("JOB_ID"));
  const tx = await jobMarket.claimRefund(jobId);
  const receipt = await tx.wait();
  console.log(`Refunded expired job ${jobId} in tx ${receipt.hash}`);
}

async function showStatus(jobMarket, paymentToken) {
  const jobId = BigInt(requiredEnv("JOB_ID"));
  const job = await jobMarket.jobs(jobId);
  const credited = await jobMarket.getCreditedAgentIds(jobId);
  const payoutRecipient = await jobMarket.providerRecipient(jobId);
  const decimals = await paymentToken.decimals();
  const clientBal = await paymentToken.balanceOf(job.client);
  const providerBal = await paymentToken.balanceOf(payoutRecipient);

  console.log(JSON.stringify({
    jobId: jobId.toString(),
    client: job.client,
    evaluator: job.evaluator,
    budget: ethers.formatUnits(job.budget, decimals),
    expiredAt: Number(job.expiredAt),
    providerKind: providerKindNames[Number(job.providerKind)] ?? String(job.providerKind),
    providerId: job.providerId.toString(),
    status: jobStatusNames[Number(job.status)] ?? String(job.status),
    description: job.description,
    deliverable: job.deliverable,
    creditedAgentIds: credited.map((x) => x.toString()),
    payoutRecipient,
    clientPaymentTokenBalance: ethers.formatUnits(clientBal, decimals),
    providerPaymentTokenBalance: ethers.formatUnits(providerBal, decimals)
  }, null, 2));
}

function walletForAction(action) {
  switch (action) {
    case "create-agent":
    case "create-swarm":
    case "fund":
      return new ethers.Wallet(clientKey(), provider);
    case "submit":
      return new ethers.Wallet(providerKey(), provider);
    case "complete":
      return new ethers.Wallet(evaluatorKey(), provider);
    case "reject":
      return new ethers.Wallet(rejectorKey(), provider);
    case "refund":
    case "status":
      return new ethers.Wallet(clientKey(), provider);
    default:
      return new ethers.Wallet(clientKey(), provider);
  }
}

function parseJobCreatedId(receipt, iface) {
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "JobCreated") {
        return parsed.args.jobId.toString();
      }
    } catch {
      continue;
    }
  }
  return "unknown";
}

function clientKey() {
  return normalizePk(process.env.CLIENT_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY);
}

function providerKey() {
  return normalizePk(process.env.PROVIDER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY);
}

function evaluatorKey() {
  return normalizePk(process.env.EVALUATOR_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY);
}

function rejectorKey() {
  return normalizePk(process.env.REJECTOR_PRIVATE_KEY || process.env.EVALUATOR_PRIVATE_KEY || process.env.CLIENT_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY);
}

function evaluatorAddress() {
  if (process.env.JOB_EVALUATOR_ADDRESS) {
    return process.env.JOB_EVALUATOR_ADDRESS;
  }
  return new ethers.Wallet(evaluatorKey()).address;
}

function parseBudget() {
  const budget = requiredEnv("JOB_BUDGET");
  const decimals = Number(process.env.PAYMENT_TOKEN_DECIMALS || "18");
  return ethers.parseUnits(budget, decimals);
}

function resolveExpiry() {
  if (process.env.JOB_EXPIRES_AT) {
    return BigInt(process.env.JOB_EXPIRES_AT);
  }
  const seconds = Number(process.env.JOB_EXPIRY_SECONDS || "3600");
  return BigInt(Math.floor(Date.now() / 1000) + seconds);
}

function parseUintList(value) {
  return value.split(",").map((item) => BigInt(item.trim())).filter((x) => x >= 0n);
}

function normalizePk(value) {
  const pk = requiredValue(value, "private key");
  return pk.startsWith("0x") ? pk : `0x${pk}`;
}

function requiredEnv(name) {
  return requiredValue(process.env[name], name);
}

function requiredValue(value, label) {
  if (!value) {
    throw new Error(`Missing required value: ${label}`);
  }
  return value;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
