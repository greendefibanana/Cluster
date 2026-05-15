import hre from "hardhat";
import fs from "fs";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const deployData = JSON.parse(fs.readFileSync("deployments/0g-testnet.json", "utf8"));
    const c = deployData.contracts;

    console.log("\n=== 4. Diagnose AgentNFT.mintAgent revert ===");
    const agentNFT = await hre.ethers.getContractAt("AgentNFT", c.agentNFT);
    try {
        const salt = hre.ethers.id("test-salt");
        // address to, string name, string role, string description, bytes32 salt
        await agentNFT.mintAgent.staticCall(deployer.address, "Test Agent", "Role", "Description", salt);
        console.log("mintAgent staticCall SUCCESS");
    } catch (e) {
        console.log("mintAgent staticCall REVERTED.");
        // Try to decode the custom error or reason
        console.log("Error logic:", e.reason || e.message);
    }

    console.log("\n=== 5. Confirm ERC8004 path separately ===");
    const identityReg = await hre.ethers.getContractAt("AgentIdentityRegistry", c.identityRegistry);
    try {
        const isTrusted = await identityReg.trustedRegistrars(deployer.address);
        console.log("Deployer trusted registrar status:", isTrusted);

        // Try to register agent directly using deployer (it should be owner so it's allowed)
        await identityReg.registerAgent.staticCall(
            999, // agentId
            c.agentNFT, 
            deployer.address, // fake tba
            deployer.address, // owner
            "Role",
            "metadataURI",
            "zeroGStorageURI"
        );
        console.log("registerAgent staticCall SUCCESS - ERC8004 is callable by deployer");
    } catch (e) {
        console.log("registerAgent REVERTED:", e.reason || e.message);
    }
}

main().catch(console.error);
