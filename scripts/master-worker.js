import "dotenv/config";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const executionHubAbi = [
  "function executeWorkerAction(uint256 masterAgentId, address masterTba, uint256 workerAgentId, address workerTba, address target, uint256 value, bytes data) external returns (bytes)",
  "function executeSwarmWorkerAction(uint256 swarmId, address swarmTba, uint256 workerAgentId, address workerTba, address target, uint256 value, bytes data) external returns (bytes)"
];
const tokenFactoryAbi = [
  "function deployToken(string name, string symbol, uint256 supply, address tokenOwner) external returns (address)"
];
const liquidityManagerAbi = [
  "function seedLiquidityWithNative(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountNativeMin, address lpRecipient, uint256 deadline) external payable returns (uint256,uint256,uint256)"
];

function loadDeployment() {
  const deploymentFile = path.join(process.cwd(), "deployments", "bsc-testnet.json");
  return JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
}

async function main() {
  const deployment = loadDeployment();
  const provider = new ethers.JsonRpcProvider(process.env.BSC_TESTNET_RPC_URL);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const executionHub = new ethers.Contract(deployment.contracts.executionHub, executionHubAbi, wallet);
  const tokenFactory = new ethers.Interface(tokenFactoryAbi);
  const tokenFactoryEvent = new ethers.Interface([
    "event WorkerTokenDeployed(address indexed token, address indexed owner, string name, string symbol, uint256 supply)"
  ]);
  const liquidityManager = deployment.contracts.liquidityManager ? new ethers.Interface(liquidityManagerAbi) : null;

  const masterAgentId = BigInt(process.env.MASTER_AGENT_ID);
  const masterTba = process.env.MASTER_TBA;
  const swarmId = process.env.SWARM_ID ? BigInt(process.env.SWARM_ID) : null;
  const swarmTba = process.env.SWARM_TBA || null;
  const workerIds = (process.env.WORKER_AGENT_IDS || "").split(",").filter(Boolean).map((x) => BigInt(x.trim()));
  const workerTbas = (process.env.WORKER_TBAS || "").split(",").filter(Boolean).map((x) => x.trim());

  if (workerIds.length !== workerTbas.length) {
    throw new Error("WORKER_AGENT_IDS and WORKER_TBAS length mismatch");
  }

  for (let i = 0; i < workerIds.length; i += 1) {
    const workerAgentId = workerIds[i];
    const workerTba = workerTbas[i];

    const deployTokenCall = tokenFactory.encodeFunctionData("deployToken", [
      `Worker ${workerAgentId} Alpha Token`,
      `W${workerAgentId}`,
      ethers.parseUnits("1000000", 18),
      workerTba
    ]);

    const deployTx = swarmId !== null && swarmTba
      ? await executionHub.executeSwarmWorkerAction(
          swarmId,
          swarmTba,
          workerAgentId,
          workerTba,
          deployment.contracts.tokenFactory,
          0,
          deployTokenCall
        )
      : await executionHub.executeWorkerAction(
          masterAgentId,
          masterTba,
          workerAgentId,
          workerTba,
          deployment.contracts.tokenFactory,
          0,
          deployTokenCall
        );
    const deployReceipt = await deployTx.wait();
    console.log(`Worker ${workerAgentId} deployed token in tx ${deployReceipt.hash}`);

    if (liquidityManager && process.env.PANCAKE_ROUTER_V2) {
      const tokenAddress = extractTokenAddress(deployReceipt.logs, deployment.contracts.tokenFactory, tokenFactoryEvent);
      if (!tokenAddress) {
        console.log(`Skipping liquidity for worker ${workerAgentId}; token address not parsed`);
        continue;
      }

      const approveIface = new ethers.Interface(["function approve(address spender, uint256 amount) external returns (bool)"]);
      const approveData = approveIface.encodeFunctionData("approve", [
        deployment.contracts.liquidityManager,
        ethers.parseUnits("100000", 18)
      ]);

      await (swarmId !== null && swarmTba
        ? await executionHub.executeSwarmWorkerAction(
            swarmId,
            swarmTba,
            workerAgentId,
            workerTba,
            tokenAddress,
            0,
            approveData
          )
        : await executionHub.executeWorkerAction(
            masterAgentId,
            masterTba,
            workerAgentId,
            workerTba,
            tokenAddress,
            0,
            approveData
          )).wait();

      const seedCall = liquidityManager.encodeFunctionData("seedLiquidityWithNative", [
        tokenAddress,
        ethers.parseUnits("100000", 18),
        0,
        0,
        workerTba,
        BigInt(Math.floor(Date.now() / 1000) + 1800)
      ]);

      const seedTx = swarmId !== null && swarmTba
        ? await executionHub.executeSwarmWorkerAction(
            swarmId,
            swarmTba,
            workerAgentId,
            workerTba,
            deployment.contracts.liquidityManager,
            ethers.parseEther("0.05"),
            seedCall
          )
        : await executionHub.executeWorkerAction(
            masterAgentId,
            masterTba,
            workerAgentId,
            workerTba,
            deployment.contracts.liquidityManager,
            ethers.parseEther("0.05"),
            seedCall
          );
      const seedReceipt = await seedTx.wait();
      console.log(`Worker ${workerAgentId} seeded liquidity in tx ${seedReceipt.hash}`);
    }
  }
}

function extractTokenAddress(logs, factoryAddress, tokenFactoryEvent) {
  for (const log of logs) {
    if (log.address?.toLowerCase() === factoryAddress.toLowerCase()) {
      try {
        const parsed = tokenFactoryEvent.parseLog(log);
        return parsed.args.token;
      } catch {
        continue;
      }
    }
  }
  return null;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
