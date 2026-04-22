import fs from "fs";
import path from "path";
import hre from "hardhat";

const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("Missing deployer signer.");
  }

  const deploymentPath = path.join(process.cwd(), "deployments", "bsc-testnet.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  console.log(`Deploying AgentJobMarket with ${deployer.address}`);

  const AgentJobMarket = await ethers.getContractFactory("AgentJobMarket");
  const jobMarket = await AgentJobMarket.deploy(
    deployment.contracts.paymentToken,
    deployment.contracts.agentNFT,
    deployment.contracts.swarmNFT,
    deployment.contracts.performanceRank
  );
  await jobMarket.waitForDeployment();

  const newAddress = await jobMarket.getAddress();
  console.log(`New AgentJobMarket deployed at: ${newAddress}`);

  // 1. Authorize the new market in PerformanceRank
  const PerformanceRank = await ethers.getContractAt("PerformanceRank", deployment.contracts.performanceRank);
  console.log("Authorizing new JobMarket in PerformanceRank...");
  await (await PerformanceRank.setTrustedExecutor(newAddress, true)).wait();

  // 2. Update deployment JSON
  deployment.contracts.jobMarket = newAddress;
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("Updated deployments/bsc-testnet.json");

  // 3. Update Frontend .env (Optional but helpful if I can find it)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
