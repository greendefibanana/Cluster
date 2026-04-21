/**
 * fork-demo.js — End-to-end Clustr demo on a BNB mainnet fork.
 *
 * What it does:
 * 1. Deploys all Clustr contracts (via the existing deploy logic)
 * 2. Patches Four.meme's factory with MockFourMemeFactory
 * 3. Mints a master agent + worker agent (anyone can do this now)
 * 4. Acquires & equips skills (deployer, meme_launcher, lp_management)
 * 5. Worker deploys a meme token via WorkerTokenFactory through ExecutionHub
 * 6. Worker launches a meme on Four.meme (via FourMemeAdapter) through ExecutionHub
 * 7. Worker seeds PancakeSwap V2 liquidity through ExecutionHub
 *
 * Usage:
 *   Terminal 1:  npx hardhat node --fork https://bsc-dataseed1.binance.org
 *   Terminal 2:  npx hardhat run scripts/fork-demo.js --network bscFork
 */
import fs from "fs";
import path from "path";
import hre from "hardhat";

const { ethers } = hre;

const FOUR_MEME_FACTORY = "0x5c952063c7fc8610FFDB798152D69F0B9550762b";
const PANCAKE_ROUTER_V2 = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n🚀 Fork demo starting with ${deployer.address}`);
  console.log(`   Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB\n`);

  // ────────────────────────────────────────────────────────
  // 1. DEPLOY ALL CONTRACTS
  // ────────────────────────────────────────────────────────
  console.log("═══ Step 1: Deploying Clustr contracts ═══");

  const registryAddress = "0x000000006551c19487814612e58FE06813775758";

  const PerformanceRank = await ethers.getContractFactory("PerformanceRank");
  const performanceRank = await PerformanceRank.deploy(deployer.address);
  await performanceRank.waitForDeployment();

  const MockPaymentToken = await ethers.getContractFactory("MockPaymentToken");
  const mockPaymentToken = await MockPaymentToken.deploy(deployer.address, ethers.parseUnits("10000000", 18));
  await mockPaymentToken.waitForDeployment();

  const ERC6551AgentAccount = await ethers.getContractFactory("ERC6551AgentAccount");
  const accountImpl = await ERC6551AgentAccount.deploy();
  await accountImpl.waitForDeployment();

  const AgentNFT = await ethers.getContractFactory("AgentNFT");
  const agentNFT = await AgentNFT.deploy(deployer.address, registryAddress, await accountImpl.getAddress(), await performanceRank.getAddress());
  await agentNFT.waitForDeployment();

  const SwarmNFT = await ethers.getContractFactory("SwarmNFT");
  const swarmNFT = await SwarmNFT.deploy(deployer.address, registryAddress, await accountImpl.getAddress());
  await swarmNFT.waitForDeployment();

  const SkillNFT = await ethers.getContractFactory("SkillNFT");
  const skillNFT = await SkillNFT.deploy(deployer.address);
  await skillNFT.waitForDeployment();

  const AgentSkillManager = await ethers.getContractFactory("AgentSkillManager");
  const skillManager = await AgentSkillManager.deploy(await agentNFT.getAddress(), await skillNFT.getAddress(), await performanceRank.getAddress());
  await skillManager.waitForDeployment();
  await (await skillNFT.setManager(await skillManager.getAddress(), true)).wait();

  const WorkerTokenFactory = await ethers.getContractFactory("WorkerTokenFactory");
  const tokenFactory = await WorkerTokenFactory.deploy();
  await tokenFactory.waitForDeployment();

  const PancakeLiquidityManager = await ethers.getContractFactory("PancakeLiquidityManager");
  const liquidityManager = await PancakeLiquidityManager.deploy(PANCAKE_ROUTER_V2);
  await liquidityManager.waitForDeployment();

  const FourMemeAdapter = await ethers.getContractFactory("FourMemeAdapter");
  const fourMemeAdapter = await FourMemeAdapter.deploy();
  await fourMemeAdapter.waitForDeployment();

  const AgentExecutionHub = await ethers.getContractFactory("AgentExecutionHub");
  const executionHub = await AgentExecutionHub.deploy(await agentNFT.getAddress(), await swarmNFT.getAddress(), await skillManager.getAddress());
  await executionHub.waitForDeployment();

  const AgentJobMarket = await ethers.getContractFactory("AgentJobMarket");
  const jobMarket = await AgentJobMarket.deploy(await mockPaymentToken.getAddress(), await agentNFT.getAddress(), await swarmNFT.getAddress(), await performanceRank.getAddress());
  await jobMarket.waitForDeployment();
  await (await performanceRank.setTrustedExecutor(await jobMarket.getAddress(), true)).wait();

  console.log("   ✅ All core contracts deployed\n");

  // ────────────────────────────────────────────────────────
  // 2. DEFINE SKILLS + SET POLICIES
  // ────────────────────────────────────────────────────────
  console.log("═══ Step 2: Defining skills & policies ═══");

  const skillDefs = [
    { name: "Deployer",        type: "execution", tag: "deployer",         desc: "Deploy ERC-20 tokens" },
    { name: "LP Manager",      type: "defi",      tag: "lp_management",    desc: "Manage PancakeSwap LP" },
    { name: "Meme Launcher",   type: "execution", tag: "meme_launcher",    desc: "Launch memes on Four.meme" },
    { name: "Content Creator", type: "social",    tag: "creative_content", desc: "Post to social feed" },
  ];

  const skillIds = [];
  for (const s of skillDefs) {
    const tx = await skillNFT.defineSkill(s.name, s.type, s.tag, s.desc, "");
    await tx.wait();
    const id = (await skillNFT.nextSkillId()) - 1n;
    skillIds.push(id);
    await (await skillNFT.setPublicMintable(id, true)).wait();
    console.log(`   Skill #${id}: ${s.tag} ✅`);
  }

  // Policies
  await (await executionHub.setTargetPolicy(
    await tokenFactory.getAddress(),
    tokenFactory.interface.getFunction("deployToken").selector,
    "deployer", true
  )).wait();

  await (await executionHub.setTargetPolicy(
    await fourMemeAdapter.getAddress(),
    fourMemeAdapter.interface.getFunction("launchMeme").selector,
    "meme_launcher", true
  )).wait();

  const approveSelector = new ethers.Interface([
    "function approve(address spender, uint256 amount) external returns (bool)"
  ]).getFunction("approve").selector;
  await (await executionHub.setGlobalPolicy(approveSelector, "lp_management", true)).wait();

  await (await executionHub.setTargetPolicy(
    await liquidityManager.getAddress(),
    liquidityManager.interface.getFunction("seedLiquidityWithNative").selector,
    "lp_management", true
  )).wait();

  console.log("   ✅ All policies set\n");

  // ────────────────────────────────────────────────────────
  // 3. PATCH FOUR.MEME FACTORY ON FORK
  // ────────────────────────────────────────────────────────
  console.log("═══ Step 3: Patching Four.meme factory ═══");

  const MockFourMemeFactory = await ethers.getContractFactory("MockFourMemeFactory");
  const mockFourMeme = await MockFourMemeFactory.deploy();
  await mockFourMeme.waitForDeployment();
  const mockCode = await ethers.provider.getCode(await mockFourMeme.getAddress());

  await hre.network.provider.send("hardhat_setCode", [FOUR_MEME_FACTORY, mockCode]);
  console.log(`   ✅ Four.meme factory patched at ${FOUR_MEME_FACTORY}\n`);

  // ────────────────────────────────────────────────────────
  // 4. MINT AGENTS (permissionless — anyone can do this!)
  // ────────────────────────────────────────────────────────
  console.log("═══ Step 4: Minting master + worker agents ═══");

  const salt1 = ethers.keccak256(ethers.toUtf8Bytes("master-agent-1"));
  const tx1 = await agentNFT.mintAgent(deployer.address, "Clustr Alpha", "orchestrator", "Master orchestration agent", salt1);
  const rc1 = await tx1.wait();
  const masterAgentId = 1n;
  const masterTba = await agentNFT.tbas(masterAgentId);
  console.log(`   Master Agent #${masterAgentId} → TBA: ${masterTba}`);

  // Transfer worker to master's TBA (so master owns worker)
  const salt2 = ethers.keccak256(ethers.toUtf8Bytes("worker-agent-1"));
  const tx2 = await agentNFT.mintAgent(deployer.address, "MemeBot", "meme-deployer", "Worker that deploys memes and manages LP", salt2);
  const rc2 = await tx2.wait();
  const workerAgentId = 2n;
  const workerTba = await agentNFT.tbas(workerAgentId);
  console.log(`   Worker Agent #${workerAgentId} → TBA: ${workerTba}`);

  // Transfer worker NFT to master TBA (establishing ownership hierarchy)
  await (await agentNFT.transferFrom(deployer.address, masterTba, workerAgentId)).wait();
  console.log(`   ✅ Worker transferred to Master TBA (ownership hierarchy set)\n`);

  // ────────────────────────────────────────────────────────
  // 5. ACQUIRE & EQUIP SKILLS
  // ────────────────────────────────────────────────────────
  console.log("═══ Step 5: Equipping worker with skills ═══");

  // Public mint skills (anyone can do this)
  const deployerSkillId = skillIds[0];   // deployer
  const lpSkillId = skillIds[1];         // lp_management
  const memeSkillId = skillIds[2];       // meme_launcher

  await (await skillNFT.publicMintSkill(deployerSkillId, 1)).wait();
  await (await skillNFT.publicMintSkill(lpSkillId, 1)).wait();
  await (await skillNFT.publicMintSkill(memeSkillId, 1)).wait();
  console.log("   Minted 3 skill SFTs (deployer, lp_management, meme_launcher)");

  // Approve skillManager to transfer
  await (await skillNFT.setApprovalForAll(await skillManager.getAddress(), true)).wait();

  // Equip: deployer needs to own agent to equip — but worker is now owned by masterTba.
  // We need to call equipSkill as the master TBA owner. Since deployer owns masterAgentId
  // which owns workerAgentId (via TBA), we need master TBA to call equipSkill.
  // Actually — equipSkill checks ownerOf(agentId) == msg.sender.
  // ownerOf(workerAgentId) == masterTba (not deployer).
  // So we equip skills to the master agent instead, or we mint the worker to deployer first,
  // equip, then transfer. Let's use the master agent directly since it has 1 slot.
  //
  // Better approach: mint worker to deployer, equip skills, THEN transfer to masterTba.
  // Let's re-order: transfer worker back, equip, then re-transfer.

  // Actually the simplest approach: we need 3 skills on the worker, but a fresh agent
  // has only 1 slot (level 1, score 0). Let's boost the score first.
  // Alternatively, equip to master and use master directly.
  //
  // For the demo, let's boost worker score so it has enough slots, then equip.

  // Boost worker score (deployer is owner, can set trusted executor)
  await (await performanceRank.setTrustedExecutor(deployer.address, true)).wait();
  await (await performanceRank.increaseScore(workerAgentId, 100, "demo bootstrap")).wait();
  console.log("   Worker score boosted to 100 (level 11, 2 skill slots)");

  // We need 3 slots → score must give level 21+ → score ≥ 200
  await (await performanceRank.increaseScore(workerAgentId, 200, "demo bootstrap extra")).wait();
  // level = 1 + (300/10) = 31, slots = 1 + ((31-1)/10) = 4
  console.log("   Worker score boosted to 300 (level 31, 4 skill slots)");

  // Transfer worker back to deployer temporarily for skill equipping
  // We need masterTba to execute this. Use executionHub or direct call.
  // masterTba.execute(agentNFT, 0, transferFrom(masterTba, deployer, workerAgentId), 0)
  const transferCalldata = agentNFT.interface.encodeFunctionData("transferFrom", [masterTba, deployer.address, workerAgentId]);
  const accountAbi = ["function execute(address to, uint256 value, bytes calldata data, uint8 operation) external payable returns (bytes memory)"];
  const masterAccount = new ethers.Contract(masterTba, accountAbi, deployer);
  await (await masterAccount.execute(await agentNFT.getAddress(), 0, transferCalldata, 0)).wait();
  console.log("   Worker temporarily transferred back to deployer for skill equipping");

  // Now deployer owns worker, can equip
  await (await skillManager.equipSkill(workerAgentId, deployerSkillId, 1)).wait();
  console.log("   ✅ Equipped: deployer");
  await (await skillManager.equipSkill(workerAgentId, memeSkillId, 1)).wait();
  console.log("   ✅ Equipped: meme_launcher");
  await (await skillManager.equipSkill(workerAgentId, lpSkillId, 1)).wait();
  console.log("   ✅ Equipped: lp_management");

  // Transfer worker back to master TBA
  await (await agentNFT.transferFrom(deployer.address, masterTba, workerAgentId)).wait();
  console.log("   ✅ Worker transferred back to Master TBA\n");

  // ────────────────────────────────────────────────────────
  // 6. DEMO: Deploy meme token via WorkerTokenFactory
  // ────────────────────────────────────────────────────────
  console.log("═══ Step 6: Agent deploys meme token via WorkerTokenFactory ═══");

  const deployTokenCalldata = tokenFactory.interface.encodeFunctionData("deployToken", [
    "ClustrDog", "CDOG", ethers.parseUnits("1000000000", 18), workerTba
  ]);

  const result1 = await executionHub.executeWorkerAction.staticCall(
    masterAgentId, masterTba, workerAgentId, workerTba,
    await tokenFactory.getAddress(), 0, deployTokenCalldata
  );
  const tx6 = await executionHub.executeWorkerAction(
    masterAgentId, masterTba, workerAgentId, workerTba,
    await tokenFactory.getAddress(), 0, deployTokenCalldata
  );
  const rc6 = await tx6.wait();

  // Decode the returned token address from the nested call result
  const decodedResult = ethers.AbiCoder.defaultAbiCoder().decode(["bytes"], result1);
  const innerResult = ethers.AbiCoder.defaultAbiCoder().decode(["bytes"], decodedResult[0]);
  const memeTokenAddr = ethers.AbiCoder.defaultAbiCoder().decode(["address"], innerResult[0])[0];
  console.log(`   ✅ ClustrDog (CDOG) deployed at: ${memeTokenAddr}`);

  const memeToken = await ethers.getContractAt("ERC20", memeTokenAddr);
  const workerBalance = await memeToken.balanceOf(workerTba);
  console.log(`   Worker TBA balance: ${ethers.formatUnits(workerBalance, 18)} CDOG\n`);

  // ────────────────────────────────────────────────────────
  // 7. DEMO: Launch meme on Four.meme (patched factory)
  // ────────────────────────────────────────────────────────
  console.log("═══ Step 7: Agent launches meme on Four.meme ═══");

  const launchMemeCalldata = fourMemeAdapter.interface.encodeFunctionData("launchMeme", [
    "ForkPepe", "FPEPE", "ipfs://QmDemo...", "0x"  // empty signature — mock accepts anything
  ]);

  const tx7 = await executionHub.executeWorkerAction(
    masterAgentId, masterTba, workerAgentId, workerTba,
    await fourMemeAdapter.getAddress(), 0, launchMemeCalldata
  );
  const rc7 = await tx7.wait();
  // Find MemeLaunched event
  const memeLaunchedEvent = rc7.logs.find(l => {
    try { return fourMemeAdapter.interface.parseLog(l)?.name === "MemeLaunched"; } catch { return false; }
  });
  if (memeLaunchedEvent) {
    const parsed = fourMemeAdapter.interface.parseLog(memeLaunchedEvent);
    console.log(`   ✅ ForkPepe (FPEPE) launched at: ${parsed.args.token}`);
  } else {
    console.log("   ✅ Four.meme launch tx confirmed (check logs for token address)");
  }
  console.log("");

  // ────────────────────────────────────────────────────────
  // 8. DEMO: Seed PancakeSwap LP
  // ────────────────────────────────────────────────────────
  console.log("═══ Step 8: Agent seeds PancakeSwap V2 liquidity ═══");

  // Fund worker TBA with BNB for LP
  await (await deployer.sendTransaction({ to: workerTba, value: ethers.parseEther("1.0") })).wait();
  console.log("   Funded worker TBA with 1 BNB");

  // Step 8a: Worker approves LiquidityManager to spend CDOG
  const approveAmount = ethers.parseUnits("100000000", 18); // 100M CDOG
  const approveCalldata = memeToken.interface.encodeFunctionData("approve", [
    await liquidityManager.getAddress(), approveAmount
  ]);

  await (await executionHub.executeWorkerAction(
    masterAgentId, masterTba, workerAgentId, workerTba,
    memeTokenAddr, 0, approveCalldata
  )).wait();
  console.log("   Worker approved LiquidityManager for 100M CDOG");

  // Step 8b: Worker seeds liquidity (CDOG + BNB)
  const seedAmount = ethers.parseUnits("50000000", 18); // 50M CDOG
  const bnbAmount = ethers.parseEther("0.5");
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  const seedCalldata = liquidityManager.interface.encodeFunctionData("seedLiquidityWithNative", [
    memeTokenAddr, seedAmount, 0, 0, workerTba, deadline
  ]);

  try {
    await (await executionHub.executeWorkerAction(
      masterAgentId, masterTba, workerAgentId, workerTba,
      await liquidityManager.getAddress(), bnbAmount, seedCalldata
    )).wait();
    console.log(`   ✅ Liquidity seeded: 50M CDOG + 0.5 BNB on PancakeSwap V2\n`);
  } catch (err) {
    console.log(`   ⚠️  LP seeding reverted (PancakeSwap may need WBNB pair init on fork): ${err.message?.slice(0, 100)}\n`);
  }

  // ────────────────────────────────────────────────────────
  // 9. SAVE DEPLOYMENT
  // ────────────────────────────────────────────────────────
  const deployment = {
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    registry: registryAddress,
    contracts: {
      performanceRank: await performanceRank.getAddress(),
      paymentToken: await mockPaymentToken.getAddress(),
      accountImplementation: await accountImpl.getAddress(),
      agentNFT: await agentNFT.getAddress(),
      swarmNFT: await swarmNFT.getAddress(),
      skillNFT: await skillNFT.getAddress(),
      skillManager: await skillManager.getAddress(),
      tokenFactory: await tokenFactory.getAddress(),
      liquidityManager: await liquidityManager.getAddress(),
      fourMemeAdapter: await fourMemeAdapter.getAddress(),
      executionHub: await executionHub.getAddress(),
      jobMarket: await jobMarket.getAddress(),
    },
    demo: {
      masterAgentId: masterAgentId.toString(),
      masterTba,
      workerAgentId: workerAgentId.toString(),
      workerTba,
      memeToken: memeTokenAddr,
    }
  };

  fs.mkdirSync(path.join(process.cwd(), "deployments"), { recursive: true });
  fs.writeFileSync(
    path.join(process.cwd(), "deployments", "bsc-fork.json"),
    JSON.stringify(deployment, null, 2)
  );

  console.log("═══ ✅ DEMO COMPLETE ═══");
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
