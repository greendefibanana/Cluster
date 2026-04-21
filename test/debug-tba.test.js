import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("Execution Hub Debug v2", function () {
  it("traces factory deployToken call isolation", async function () {
    const [deployer] = await ethers.getSigners();

    const R = await (await ethers.getContractFactory("MockERC6551Registry")).deploy();
    const I = await (await ethers.getContractFactory("ERC6551AgentAccount")).deploy();
    const P = await (await ethers.getContractFactory("PerformanceRank")).deploy(deployer.address);
    const A = await (await ethers.getContractFactory("AgentNFT")).deploy(
      deployer.address, await R.getAddress(), await I.getAddress(), await P.getAddress()
    );
    const S = await (await ethers.getContractFactory("SwarmNFT")).deploy(
      deployer.address, await R.getAddress(), await I.getAddress()
    );
    const K = await (await ethers.getContractFactory("SkillNFT")).deploy(deployer.address);
    const M = await (await ethers.getContractFactory("AgentSkillManager")).deploy(
      await A.getAddress(), await K.getAddress(), await P.getAddress()
    );
    await (await K.setManager(await M.getAddress(), true)).wait();
    const F = await (await ethers.getContractFactory("WorkerTokenFactory")).deploy();
    const H = await (await ethers.getContractFactory("AgentExecutionHub")).deploy(
      await A.getAddress(), await S.getAddress(), await M.getAddress()
    );
    await (await H.setTargetPolicy(
      await F.getAddress(),
      F.interface.getFunction("deployToken").selector,
      "deployer",
      true
    )).wait();

    // Mint master (1) and worker (2)
    await (await A.mintAgent(deployer.address, "M", "o", "d", ethers.keccak256(ethers.toUtf8Bytes("m")))).wait();
    await (await A.mintAgent(deployer.address, "W", "d", "d", ethers.keccak256(ethers.toUtf8Bytes("w")))).wait();
    const masterTba = await A.tbas(1n);
    const workerTba = await A.tbas(2n);

    const skillId = await K.nextSkillId();
    await (await K.defineSkill("Token Deployer", "deployer", "deployer", "deployer", "# deployer")).wait();
    await (await K.mintSkill(deployer.address, skillId, 1)).wait();
    await (await K.setApprovalForAll(await M.getAddress(), true)).wait();
    await (await M.equipSkill(2n, skillId, 1)).wait();

    await (await A.transferFrom(deployer.address, masterTba, 2n)).wait();

    const tbaAbi = [
      "function owner() view returns (address)",
      "function executors(address) view returns (bool)",
      "function setExecutor(address, bool)",
      "function execute(address, uint256, bytes calldata, uint8) payable returns (bytes)"
    ];
    const masterTbaC = new ethers.Contract(masterTba, tbaAbi, deployer);
    const workerTbaC = new ethers.Contract(workerTba, tbaAbi, deployer);

    await (await masterTbaC.setExecutor(await H.getAddress(), true)).wait();
    await (await F.setTrustedCaller(workerTba, true)).wait();

    // Test 1: Direct factory call from deployer (should work, deployer is owner)
    console.log("Test 1: Direct factory call from deployer");
    const token1 = await F.deployToken.staticCall("T1", "T1", 1000n, deployer.address);
    console.log("  Direct call OK, token would be:", token1);

    // Test 2: Worker TBA directly calls factory
    // First, deployer needs to be able to call workerTba.execute() — but deployer is NOT the worker owner!
    // Worker is owned by masterTba. So we need to go through masterTba.
    console.log("\nTest 2: master TBA → worker TBA → factory");
    const deployCall = new ethers.Interface([
      "function deployToken(string name, string symbol, uint256 supply, address tokenOwner) returns (address)"
    ]).encodeFunctionData("deployToken", ["T2", "T2", 1000n, workerTba]);
    
    const innerCall = new ethers.Interface(tbaAbi).encodeFunctionData(
      "execute", [await F.getAddress(), 0, deployCall, 0]
    );

    try {
      const tx = await masterTbaC.execute(workerTba, 0, innerCall, 0);
      await tx.wait();
      console.log("  ✓ master → worker → factory works!");
    } catch (e) {
      console.log("  ✗ Failed:", e.message?.substring(0, 200));
    }

    // Test 3: Same thing through the hub
    console.log("\nTest 3: hub → master TBA → worker TBA → factory");
    try {
      const tx = await H.executeWorkerAction(
        1n, masterTba, 2n, workerTba,
        await F.getAddress(), 0, deployCall
      );
      await tx.wait();
      console.log("  ✓ hub execution works!");
    } catch (e) {
      console.log("  ✗ Failed:", e.message?.substring(0, 200));
    }
  });
});
