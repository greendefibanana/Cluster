import fs from "fs";
import path from "path";
import hre from "hardhat";

const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("Missing deployer signer. Set DEPLOYER_PRIVATE_KEY in .env before running deploy:bsc-testnet.");
  }
  const registryAddress = process.env.ERC6551_REGISTRY || "0x000000006551c19487814612e58FE06813775758";
  const pancakeRouter = process.env.PANCAKE_ROUTER_V2;
  const isFork = process.env.IS_FORK === "true";

  console.log(`Deploying with ${deployer.address}`);

  const PerformanceRank = await ethers.getContractFactory("PerformanceRank");
  const performanceRank = await PerformanceRank.deploy(deployer.address);
  await performanceRank.waitForDeployment();

  const MockPaymentToken = await ethers.getContractFactory("MockPaymentToken");
  const mockPaymentToken = await MockPaymentToken.deploy(
    deployer.address,
    ethers.parseUnits("10000000", 18)
  );
  await mockPaymentToken.waitForDeployment();

  const ERC6551AgentAccount = await ethers.getContractFactory("ERC6551AgentAccount");
  const accountImplementation = await ERC6551AgentAccount.deploy();
  await accountImplementation.waitForDeployment();

  const AgentNFT = await ethers.getContractFactory("AgentNFT");
  const agentNFT = await AgentNFT.deploy(
    deployer.address,
    registryAddress,
    await accountImplementation.getAddress(),
    await performanceRank.getAddress()
  );
  await agentNFT.waitForDeployment();

  const SwarmNFT = await ethers.getContractFactory("SwarmNFT");
  const swarmNFT = await SwarmNFT.deploy(
    deployer.address,
    registryAddress,
    await accountImplementation.getAddress()
  );
  await swarmNFT.waitForDeployment();

  const SkillNFT = await ethers.getContractFactory("SkillNFT");
  const skillNFT = await SkillNFT.deploy(deployer.address);
  await skillNFT.waitForDeployment();

  const AgentSkillManager = await ethers.getContractFactory("AgentSkillManager");
  const skillManager = await AgentSkillManager.deploy(
    await agentNFT.getAddress(),
    await skillNFT.getAddress(),
    await performanceRank.getAddress()
  );
  await skillManager.waitForDeployment();
  await (await skillNFT.setManager(await skillManager.getAddress(), true)).wait();

  // ── Define demo skills and enable public minting ──
  const skillDefs = [
    { name: "Deployer",        skillType: "execution", capabilityTag: "deployer",         description: "Deploy ERC-20 tokens",     md: "" },
    { name: "LP Manager",      skillType: "defi",      capabilityTag: "lp_management",    description: "Manage PancakeSwap LP",    md: "" },
    { name: "Meme Launcher",   skillType: "execution", capabilityTag: "meme_launcher",    description: "Launch memes on Four.meme", md: "" },
    { name: "Content Creator", skillType: "social",    capabilityTag: "creative_content", description: "Post to social feed",      md: "" },
  ];
  const skillIds = [];
  for (const s of skillDefs) {
    const tx = await skillNFT.defineSkill(s.name, s.skillType, s.capabilityTag, s.description, s.md);
    const rc = await tx.wait();
    const ev = rc.logs.find(l => l.fragment?.name === "SkillDefined");
    const id = ev ? ev.args[0] : await skillNFT.nextSkillId() - 1n;
    skillIds.push(id);
    await (await skillNFT.setPublicMintable(id, true)).wait();
    console.log(`Defined skill #${id}: ${s.capabilityTag} (public mint enabled)`);
  }

  const AgentSocialFeed = await ethers.getContractFactory("AgentSocialFeed");
  const socialFeed = await AgentSocialFeed.deploy(await agentNFT.getAddress(), await skillManager.getAddress());
  await socialFeed.waitForDeployment();

  const WorkerTokenFactory = await ethers.getContractFactory("WorkerTokenFactory");
  const tokenFactory = await WorkerTokenFactory.deploy();
  await tokenFactory.waitForDeployment();

  let liquidityManager = null;
  if (pancakeRouter) {
    const PancakeLiquidityManager = await ethers.getContractFactory("PancakeLiquidityManager");
    liquidityManager = await PancakeLiquidityManager.deploy(pancakeRouter);
    await liquidityManager.waitForDeployment();
  }

  // ── Four.meme Adapter ──
  let fourMemeAdapter = null;
  if (isFork) {
    const FourMemeAdapter = await ethers.getContractFactory("FourMemeAdapter");
    fourMemeAdapter = await FourMemeAdapter.deploy();
    await fourMemeAdapter.waitForDeployment();
    console.log(`FourMemeAdapter deployed at ${await fourMemeAdapter.getAddress()}`);
  }

  const AgentExecutionHub = await ethers.getContractFactory("AgentExecutionHub");
  const executionHub = await AgentExecutionHub.deploy(
    await agentNFT.getAddress(),
    await swarmNFT.getAddress(),
    await skillManager.getAddress()
  );
  await executionHub.waitForDeployment();

  // ── Policies: WorkerTokenFactory ──
  await (await executionHub.setTargetPolicy(
    await tokenFactory.getAddress(),
    tokenFactory.interface.getFunction("deployToken").selector,
    "deployer",
    true
  )).wait();

  // ── Policies: FourMemeAdapter ──
  if (fourMemeAdapter) {
    await (await executionHub.setTargetPolicy(
      await fourMemeAdapter.getAddress(),
      fourMemeAdapter.interface.getFunction("launchMeme").selector,
      "meme_launcher",
      true
    )).wait();
    console.log("ExecutionHub policy set for FourMemeAdapter.launchMeme → meme_launcher");
  }

  const AgentJobMarket = await ethers.getContractFactory("AgentJobMarket");
  const jobMarket = await AgentJobMarket.deploy(
    await mockPaymentToken.getAddress(),
    await agentNFT.getAddress(),
    await swarmNFT.getAddress(),
    await performanceRank.getAddress()
  );
  await jobMarket.waitForDeployment();

  await (await performanceRank.setTrustedExecutor(await jobMarket.getAddress(), true)).wait();

  if (liquidityManager) {
    const approveSelector = new ethers.Interface([
      "function approve(address spender, uint256 amount) external returns (bool)"
    ]).getFunction("approve").selector;

    await (await executionHub.setGlobalPolicy(approveSelector, "lp_management", true)).wait();
    await (await executionHub.setTargetPolicy(
      await liquidityManager.getAddress(),
      liquidityManager.interface.getFunction("seedLiquidityWithNative").selector,
      "lp_management",
      true
    )).wait();
  }

  const deployment = {
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    registry: registryAddress,
    contracts: {
      performanceRank: await performanceRank.getAddress(),
      paymentToken: await mockPaymentToken.getAddress(),
      accountImplementation: await accountImplementation.getAddress(),
      agentNFT: await agentNFT.getAddress(),
      swarmNFT: await swarmNFT.getAddress(),
      skillNFT: await skillNFT.getAddress(),
      skillManager: await skillManager.getAddress(),
      socialFeed: await socialFeed.getAddress(),
      tokenFactory: await tokenFactory.getAddress(),
      liquidityManager: liquidityManager ? await liquidityManager.getAddress() : null,
      fourMemeAdapter: fourMemeAdapter ? await fourMemeAdapter.getAddress() : null,
      executionHub: await executionHub.getAddress(),
      jobMarket: await jobMarket.getAddress()
    },
    skills: skillIds.map((id, i) => ({ id: id.toString(), ...skillDefs[i] }))
  };

  const networkLabel = isFork ? "bsc-fork" : "bsc-testnet";
  fs.mkdirSync(path.join(process.cwd(), "deployments"), { recursive: true });
  fs.writeFileSync(
    path.join(process.cwd(), "deployments", `${networkLabel}.json`),
    JSON.stringify(deployment, null, 2)
  );

  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
