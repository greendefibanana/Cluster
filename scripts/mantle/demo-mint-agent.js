import fs from "fs";
import path from "path";
import hre from "hardhat";

const { ethers, network } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployPath = path.join(process.cwd(), "deployments", `${network.name}.json`);
  if (!fs.existsSync(deployPath)) {
    throw new Error(`Deployment not found at ${deployPath}`);
  }
  const deployment = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  
  const registry = await ethers.getContractAt("MockERC6551Registry", deployment.registry);
  const agentNFT = await ethers.getContractAt("AgentNFT", deployment.contracts.agentNFT);
  const identityReg = await ethers.getContractAt("AgentIdentityRegistry", deployment.contracts.identityRegistry);

  console.log(`Minting Agent on ${network.name} via AgentNFT at ${deployment.contracts.agentNFT}`);
  
  const salt = ethers.id("test-agent-salt-" + Date.now());
  const tx = await agentNFT.mintAgent(
    deployer.address,
    "Mantle Sleuth",
    "On-chain Analyst",
    "Analyzes Mantle testnet transactions",
    salt
  );
  const receipt = await tx.wait();
  console.log(`Mint TX Hash: ${receipt.hash}`);

  // Find AgentMinted event to get agentId and TBA
  const event = receipt.logs.find((l) => {
    try {
      const parsed = agentNFT.interface.parseLog(l);
      return parsed.name === "AgentMinted";
    } catch (e) {
      return false;
    }
  });

  if (!event) {
    throw new Error("AgentMinted event not found");
  }

  const parsedEvent = agentNFT.interface.parseLog(event);
  const agentId = parsedEvent.args.agentId;
  const tba = parsedEvent.args.tba;
  
  console.log(`Agent Minted: ID ${agentId}`);
  console.log(`Created ERC6551 TBA: ${tba}`);

  // Verify Identity Registry Entry
  const identity = await identityReg.getAgent(deployment.contracts.agentNFT, agentId);
  console.log("Identity Registry Entry Owner:", identity.owner);

  // Update ZeroG storage URI (simulate 0G proof upload attachment)
  const existingProofURI = "0g://clusterfi-demo/validation-proof/84b1ec9c74220f27545546f90ee2b0c11e06c51e1e3c921901973acc7e14c591";
  const updateTx = await identityReg.updateZeroGStorageURI(deployment.contracts.agentNFT, agentId, existingProofURI);
  await updateTx.wait();

  const identityUpdated = await identityReg.getAgent(deployment.contracts.agentNFT, agentId);
  console.log("Attached 0G Proof URI:", identityUpdated.zeroGStorageURI);
  console.log("SUCCESS: Mantle mint smoke test completed!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
