import hre from "hardhat";
import fs from "fs";

async function main() {
    console.log("=== 1. Confirm Environment ===");
    console.log("Networks configured:", Object.keys(hre.config.networks));
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);
    const bal = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance (ETH):", hre.ethers.formatEther(bal));

    const zeroGExists = fs.existsSync("deployments/0g-testnet.json");
    const mantleExists = fs.existsSync("deployments/mantleSepolia.json");
    console.log("deployments/0g-testnet.json exists:", zeroGExists);
    console.log("deployments/mantleSepolia.json exists:", mantleExists);

    if (!zeroGExists) return;

    console.log("\n=== 2. Confirm 0G contract addresses ===");
    const deployData = JSON.parse(fs.readFileSync("deployments/0g-testnet.json", "utf8"));
    const c = deployData.contracts;
    console.log("AgentNFT:", c.agentNFT);
    console.log("SkillNFT:", c.skillNFT);
    console.log("ClusterNFT:", c.clusterNFT);
    console.log("Identity Registry:", c.identityRegistry);
    console.log("Reputation Registry:", c.reputationRegistry);
    console.log("Validation Registry:", c.validationRegistry);
    console.log("ERC6551 Registry:", deployData.registry);
    console.log("ERC6551 Account Impl:", c.accountImplementation);

    console.log("\n=== 3. Diagnose ERC6551 registry issue ===");
    const registryAddress = deployData.registry;
    const code = await hre.ethers.provider.getCode(registryAddress);
    console.log("ERC6551 Registry code length:", code.length);
    if (code === "0x") {
        console.log("RESULT: No code deployed at ERC6551 registry on 0G Testnet!");
    } else {
        console.log("RESULT: Code exists.");
    }

    // Try account() call
    const registryABI = [
        "function account(address implementation, uint256 chainId, address tokenContract, uint256 tokenId, uint256 salt) external view returns (address)",
        "function createAccount(address implementation, uint256 chainId, address tokenContract, uint256 tokenId, uint256 salt, bytes initData) external returns (address)"
    ];
    const registryContract = new hre.ethers.Contract(registryAddress, registryABI, deployer);

    try {
        const expectedAccount = await registryContract.account(
            c.accountImplementation,
            16602,
            c.agentNFT,
            1,
            0
        );
        console.log("account(...) returned:", expectedAccount);
    } catch(e) {
        console.log("account(...) call failed:", e.message);
    }

    console.log("\n=== 4. Diagnose AgentNFT.mintAgent revert ===");
    const agentNFT = await hre.ethers.getContractAt("AgentNFT", c.agentNFT);
    try {
        await agentNFT.mintAgent.staticCall(deployer.address, "test-uri", 0);
        console.log("mintAgent staticCall SUCCESS");
    } catch (e) {
        console.log("mintAgent staticCall REVERTED.");
        console.log("Error logic:", e.reason || e.message);
    }

    console.log("\n=== 5. Confirm ERC8004 path separately ===");
    const identityReg = await hre.ethers.getContractAt("AgentIdentityRegistry", c.identityRegistry);
    try {
        const isTrusted = await identityReg.trustedCallers(deployer.address);
        console.log("Deployer trusted caller status on IdentityRegistry:", isTrusted);
        // Add deployer as trusted for test if possible
        if (!isTrusted) {
            // Might fail if not owner
            // await identityReg.setTrustedCaller(deployer.address, true);
        }
        await identityReg.registerIdentity.staticCall(deployer.address);
        console.log("registerIdentity staticCall SUCCESS - ERC8004 is callable");
    } catch (e) {
        console.log("registerIdentity REVERTED:", e.reason || e.message);
    }
}

main().catch(console.error);
