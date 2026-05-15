import fs from "fs";
import path from "path";
import hre from "hardhat";

const { ethers, network } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  console.log(`Deploying Agent Stack to ${network.name} (${chainId}) from ${deployer.address}`);

  // 1. Deploy Mock ERC6551 Registry (since canonical isn't there or we want our own)
  const MockERC6551Registry = await ethers.getContractFactory("MockERC6551Registry");
  const registry = await MockERC6551Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("MockERC6551Registry deployed to:", registryAddress);

  const PerformanceRank = await ethers.getContractFactory("PerformanceRank");
  const performanceRank = await PerformanceRank.deploy(deployer.address);
  await performanceRank.waitForDeployment();
  console.log("PerformanceRank deployed");

  const MockPaymentToken = await ethers.getContractFactory("MockPaymentToken");
  const mockPaymentToken = await MockPaymentToken.deploy(
    deployer.address,
    ethers.parseUnits("10000000", 18)
  );
  await mockPaymentToken.waitForDeployment();
  console.log("MockPaymentToken deployed");

  const ERC6551AgentAccount = await ethers.getContractFactory("ERC6551AgentAccount");
  const accountImplementation = await ERC6551AgentAccount.deploy();
  await accountImplementation.waitForDeployment();
  const accountImplAddress = await accountImplementation.getAddress();
  console.log("ERC6551AgentAccount deployed:", accountImplAddress);

  const AgentIdentityRegistry = await ethers.getContractFactory("AgentIdentityRegistry");
  const identityRegistry = await AgentIdentityRegistry.deploy(deployer.address);
  await identityRegistry.waitForDeployment();
  console.log("AgentIdentityRegistry deployed");

  const AgentReputationRegistry = await ethers.getContractFactory("AgentReputationRegistry");
  const reputationRegistry = await AgentReputationRegistry.deploy(deployer.address);
  await reputationRegistry.waitForDeployment();
  console.log("AgentReputationRegistry deployed");

  const AgentValidationRegistry = await ethers.getContractFactory("AgentValidationRegistry");
  const validationRegistry = await AgentValidationRegistry.deploy(deployer.address);
  await validationRegistry.waitForDeployment();
  console.log("AgentValidationRegistry deployed");

  const AgentNFT = await ethers.getContractFactory("AgentNFT");
  const agentNFT = await AgentNFT.deploy(
    deployer.address,
    registryAddress,
    accountImplAddress,
    await performanceRank.getAddress()
  );
  await agentNFT.waitForDeployment();
  console.log("AgentNFT deployed");
  await (await identityRegistry.setTrustedRegistrar(await agentNFT.getAddress(), true)).wait();
  await (await agentNFT.setIdentityRegistry(await identityRegistry.getAddress())).wait();
  console.log("AgentNFT configured");

  const SwarmNFT = await ethers.getContractFactory("SwarmNFT");
  const swarmNFT = await SwarmNFT.deploy(
    deployer.address,
    registryAddress,
    accountImplAddress
  );
  await swarmNFT.waitForDeployment();
  console.log("SwarmNFT deployed");

  const ClusterNFT = await ethers.getContractFactory("ClusterNFT");
  const clusterNFT = await ClusterNFT.deploy(
    deployer.address,
    registryAddress,
    accountImplAddress
  );
  await clusterNFT.waitForDeployment();
  console.log("ClusterNFT deployed");

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
  }

  const AgentSocialFeed = await ethers.getContractFactory("AgentSocialFeed");
  const socialFeed = await AgentSocialFeed.deploy(await agentNFT.getAddress(), await skillManager.getAddress());
  await socialFeed.waitForDeployment();

  const WorkerTokenFactory = await ethers.getContractFactory("WorkerTokenFactory");
  const tokenFactory = await WorkerTokenFactory.deploy();
  await tokenFactory.waitForDeployment();

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

  await (await executionHub.setTargetPolicy(
    await tokenFactory.getAddress(),
    tokenFactory.interface.getFunction("deployToken").selector,
    "deployer",
    true
  )).wait();

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

  // Load existing mantleSepolia.json
  const deployPath = path.join(process.cwd(), "deployments", `${network.name}.json`);
  let deployment = {};
  if (fs.existsSync(deployPath)) {
    deployment = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  }

  // Merge in new registry and agent stack
  deployment.registry = registryAddress;
  deployment.contracts = deployment.contracts || {};
  Object.assign(deployment.contracts, {
    performanceRank: await performanceRank.getAddress(),
    paymentToken: await mockPaymentToken.getAddress(),
    accountImplementation: accountImplAddress,
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
    executionHub: await executionHub.getAddress(),
    jobMarket: await jobMarket.getAddress(),
    userStrategyAccountFactory: await userStrategyAccountFactory.getAddress(),
  });
  deployment.skills = skillIds.map((id, i) => ({ id: id.toString(), ...skillDefs[i] }));

  fs.writeFileSync(deployPath, JSON.stringify(deployment, null, 2));
  console.log("Agent stack deployed and merged into", deployPath);
  console.log("AgentNFT Address:", deployment.contracts.agentNFT);
  console.log("Registry Address:", deployment.registry);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
