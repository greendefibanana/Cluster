import fs from "fs";
import path from "path";
import hre from "hardhat";

const { ethers, network } = hre;

const EXPLORER = "https://chainscan.0g.ai";

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);

  // ── Preflight ──────────────────────────────────────────────────────────────
  console.log("=== 0G MAINNET PREFLIGHT ===");
  console.log(`Network:   ${network.name}`);
  console.log(`Chain ID:  ${chainId}`);
  console.log(`Deployer:  ${deployer.address}`);

  if (chainId !== 16661) {
    throw new Error(`Expected chain 16661 (0G Mainnet), got ${chainId}. Aborting.`);
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance:   ${ethers.formatEther(balance)} 0G`);
  if (balance < ethers.parseEther("0.05")) {
    throw new Error(`Insufficient balance: ${ethers.formatEther(balance)} 0G. Need at least 0.05 0G.`);
  }

  // ── Deploy ─────────────────────────────────────────────────────────────────
  console.log("\n=== DEPLOYING 0G MAINNET REGISTRIES ===");
  console.log("Scope: IdentityRegistry, ReputationRegistry, ValidationRegistry");
  console.log("NOT deploying: AgentNFT, ERC6551, Sovereign Accounts");

  const AgentIdentityRegistry = await ethers.getContractFactory("AgentIdentityRegistry");
  console.log("Deploying AgentIdentityRegistry...");
  const identityRegistry = await AgentIdentityRegistry.deploy(deployer.address);
  await identityRegistry.waitForDeployment();
  const identityAddr = await identityRegistry.getAddress();
  console.log(`AgentIdentityRegistry: ${identityAddr}`);
  console.log(`  Explorer: ${EXPLORER}/address/${identityAddr}`);

  const AgentReputationRegistry = await ethers.getContractFactory("AgentReputationRegistry");
  console.log("Deploying AgentReputationRegistry...");
  const reputationRegistry = await AgentReputationRegistry.deploy(deployer.address);
  await reputationRegistry.waitForDeployment();
  const reputationAddr = await reputationRegistry.getAddress();
  console.log(`AgentReputationRegistry: ${reputationAddr}`);
  console.log(`  Explorer: ${EXPLORER}/address/${reputationAddr}`);

  const AgentValidationRegistry = await ethers.getContractFactory("AgentValidationRegistry");
  console.log("Deploying AgentValidationRegistry...");
  const validationRegistry = await AgentValidationRegistry.deploy(deployer.address);
  await validationRegistry.waitForDeployment();
  const validationAddr = await validationRegistry.getAddress();
  console.log(`AgentValidationRegistry: ${validationAddr}`);
  console.log(`  Explorer: ${EXPLORER}/address/${validationAddr}`);

  // ── Set up permissions ────────────────────────────────────────────────────
  console.log("\n=== SETTING UP PERMISSIONS ===");
  const tx1 = await reputationRegistry.setTrustedWriter(deployer.address, true);
  await tx1.wait();
  console.log("ReputationRegistry: deployer set as trusted writer");

  const tx2 = await validationRegistry.setTrustedSubmitter(deployer.address, true);
  await tx2.wait();
  console.log("ValidationRegistry: deployer set as trusted submitter");

  const tx3 = await identityRegistry.setTrustedRegistrar(deployer.address, true);
  await tx3.wait();
  console.log("IdentityRegistry: deployer set as trusted registrar");

  // ── Save deployment ───────────────────────────────────────────────────────
  const deployment = {
    network: "0g-mainnet",
    chainId: chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    explorer: EXPLORER,
    contracts: {
      identityRegistry: identityAddr,
      reputationRegistry: reputationAddr,
      validationRegistry: validationAddr,
    },
    explorerLinks: {
      identityRegistry: `${EXPLORER}/address/${identityAddr}`,
      reputationRegistry: `${EXPLORER}/address/${reputationAddr}`,
      validationRegistry: `${EXPLORER}/address/${validationAddr}`,
    },
    notes: [
      "AgentNFT/ERC6551 NOT deployed on 0G (handled by Mantle Sepolia)",
      "Mantle AgentNFT: 0x3fBD3191f6a7a7537971C1809570E04A8DE14b44",
      "Mantle TBA: 0xBe9cd56F9aD6e49eC5B7DA9307fF186Fa57fBd81",
    ],
  };

  const outPath = path.join(process.cwd(), "deployments", "0g-mainnet.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment saved to: ${outPath}`);
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
