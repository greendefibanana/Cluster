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
  const network = await ethers.provider.getNetwork();
  const isMainnetLike = network.chainId !== 31337n && network.chainId !== 97n && network.chainId !== 16602n;
  const allowMockAdapters = process.env.ALLOW_MOCK_ADAPTERS === "true" || !isMainnetLike;
  if (isMainnetLike && allowMockAdapters) {
    throw new Error("Refusing mainnet-like deployment with mock adapters. Set audited adapter addresses and do not enable ALLOW_MOCK_ADAPTERS.");
  }

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

  const AgentIdentityRegistry = await ethers.getContractFactory("AgentIdentityRegistry");
  const identityRegistry = await AgentIdentityRegistry.deploy(deployer.address);
  await identityRegistry.waitForDeployment();

  const AgentReputationRegistry = await ethers.getContractFactory("AgentReputationRegistry");
  const reputationRegistry = await AgentReputationRegistry.deploy(deployer.address);
  await reputationRegistry.waitForDeployment();

  const AgentValidationRegistry = await ethers.getContractFactory("AgentValidationRegistry");
  const validationRegistry = await AgentValidationRegistry.deploy(deployer.address);
  await validationRegistry.waitForDeployment();

  const AgentNFT = await ethers.getContractFactory("AgentNFT");
  const agentNFT = await AgentNFT.deploy(
    deployer.address,
    registryAddress,
    await accountImplementation.getAddress(),
    await performanceRank.getAddress()
  );
  await agentNFT.waitForDeployment();
  await (await identityRegistry.setTrustedRegistrar(await agentNFT.getAddress(), true)).wait();
  await (await agentNFT.setIdentityRegistry(await identityRegistry.getAddress())).wait();

  const SwarmNFT = await ethers.getContractFactory("SwarmNFT");
  const swarmNFT = await SwarmNFT.deploy(
    deployer.address,
    registryAddress,
    await accountImplementation.getAddress()
  );
  await swarmNFT.waitForDeployment();

  const ClusterNFT = await ethers.getContractFactory("ClusterNFT");
  const clusterNFT = await ClusterNFT.deploy(
    deployer.address,
    registryAddress,
    await accountImplementation.getAddress()
  );
  await clusterNFT.waitForDeployment();

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
    { name: "Create Meme",        skillType: "execution",  capabilityTag: "CREATE_MEME",             description: "Create and launch meme instruments", md: "" },
    { name: "Deploy LP",          skillType: "defi",       capabilityTag: "DEPLOY_LP",               description: "Deploy LP strategies", md: "" },
    { name: "Run Yield Strategy", skillType: "defi",       capabilityTag: "RUN_YIELD_STRATEGY",     description: "Execute yield strategies", md: "" },
    { name: "Prediction Market",  skillType: "prediction", capabilityTag: "OPEN_PREDICTION_MARKET", description: "Open prediction market instruments", md: "" },
    { name: "Generate Alpha",     skillType: "research",   capabilityTag: "GENERATE_ALPHA",         description: "Generate alpha reports", md: "" },
    { name: "Market Strategy",    skillType: "social",     capabilityTag: "MARKET_STRATEGY",        description: "Create strategy campaign posts", md: "" },
    { name: "Validate PnL",       skillType: "validation", capabilityTag: "VALIDATE_PNL",           description: "Validate PnL claims and proofs", md: "" },
    { name: "Content Creator",    skillType: "social",     capabilityTag: "creative_content",       description: "Post to social feed", md: "" },
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

  const deniedSelectors = [
    ["transferOwnership", "function transferOwnership(address newOwner)"],
    ["setTrustedCaller", "function setTrustedCaller(address caller, bool trusted)"],
    ["setTrustedExecutor", "function setTrustedExecutor(address executor, bool trusted)"],
    ["setTrustedWriter", "function setTrustedWriter(address writer, bool trusted)"],
    ["setTrustedSubmitter", "function setTrustedSubmitter(address submitter, bool trusted)"],
    ["setManager", "function setManager(address manager, bool allowed)"],
    ["setTargetPolicy", "function setTargetPolicy(address target, bytes4 selector, string capabilityTag, bool enabled)"],
    ["setGlobalPolicy", "function setGlobalPolicy(bytes4 selector, string capabilityTag, bool enabled)"],
    ["setSelectorDenylist", "function setSelectorDenylist(bytes4 selector, bool blocked)"],
    ["pause", "function pause()"],
    ["unpause", "function unpause()"],
    ["setPaused", "function setPaused(bool isPaused)"]
  ];
  for (const [name, signature] of deniedSelectors) {
    const selector = new ethers.Interface([signature]).getFunction(name).selector;
    await (await executionHub.setSelectorDenylist(selector, true)).wait();
  }

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

  const UserStrategyAccountFactory = await ethers.getContractFactory("UserStrategyAccountFactory");
  const userStrategyAccountFactory = await UserStrategyAccountFactory.deploy(deployer.address);
  await userStrategyAccountFactory.waitForDeployment();

  let mockMemeAdapter = null;
  let mockLPAdapter = null;
  let mockYieldAdapter = null;
  let mockPredictionMarketAdapter = null;

  if (allowMockAdapters) {
    const MockMemeAdapter = await ethers.getContractFactory("MockMemeAdapter");
    mockMemeAdapter = await MockMemeAdapter.deploy();
    await mockMemeAdapter.waitForDeployment();

    const MockLPAdapter = await ethers.getContractFactory("MockLPAdapter");
    mockLPAdapter = await MockLPAdapter.deploy();
    await mockLPAdapter.waitForDeployment();

    const MockYieldAdapter = await ethers.getContractFactory("MockYieldAdapter");
    mockYieldAdapter = await MockYieldAdapter.deploy();
    await mockYieldAdapter.waitForDeployment();

    const MockPredictionMarketAdapter = await ethers.getContractFactory("MockPredictionMarketAdapter");
    mockPredictionMarketAdapter = await MockPredictionMarketAdapter.deploy();
    await mockPredictionMarketAdapter.waitForDeployment();
  }

  await (await reputationRegistry.setTrustedWriter(deployer.address, true)).wait();
  await (await validationRegistry.setTrustedSubmitter(deployer.address, true)).wait();

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
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    registry: registryAddress,
    contracts: {
      performanceRank: await performanceRank.getAddress(),
      paymentToken: await mockPaymentToken.getAddress(),
      accountImplementation: await accountImplementation.getAddress(),
      identityRegistry: await identityRegistry.getAddress(),
      reputationRegistry: await reputationRegistry.getAddress(),
      validationRegistry: await validationRegistry.getAddress(),
      agentNFT: await agentNFT.getAddress(),
      swarmNFT: await swarmNFT.getAddress(),
      clusterNFT: await clusterNFT.getAddress(),
      skillNFT: await skillNFT.getAddress(),
      skillManager: await skillManager.getAddress(),
      socialFeed: await socialFeed.getAddress(),
      tokenFactory: await tokenFactory.getAddress(),
      liquidityManager: liquidityManager ? await liquidityManager.getAddress() : null,
      fourMemeAdapter: fourMemeAdapter ? await fourMemeAdapter.getAddress() : null,
      executionHub: await executionHub.getAddress(),
      jobMarket: await jobMarket.getAddress(),
      userStrategyAccountFactory: await userStrategyAccountFactory.getAddress(),
      mockMemeAdapter: mockMemeAdapter ? await mockMemeAdapter.getAddress() : process.env.MEME_ADAPTER_ADDRESS || null,
      mockLPAdapter: mockLPAdapter ? await mockLPAdapter.getAddress() : process.env.LP_ADAPTER_ADDRESS || null,
      mockYieldAdapter: mockYieldAdapter ? await mockYieldAdapter.getAddress() : process.env.YIELD_ADAPTER_ADDRESS || null,
      mockPredictionMarketAdapter: mockPredictionMarketAdapter ? await mockPredictionMarketAdapter.getAddress() : process.env.PREDICTION_MARKET_ADAPTER_ADDRESS || null
    },
    skills: skillIds.map((id, i) => ({ id: id.toString(), ...skillDefs[i] }))
  };

  const networkLabel = isFork ? "bsc-fork" : network.chainId === 16602n ? "0g-testnet" : "bsc-testnet";
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
