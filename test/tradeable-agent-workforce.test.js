import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("Tradeable Agent Workforce", function () {
  async function deployFixture() {
    const [deployer, client, provider, evaluator, outsider] = await ethers.getSigners();

    const MockRegistry = await ethers.getContractFactory("MockERC6551Registry");
    const registry = await MockRegistry.deploy();
    await registry.waitForDeployment();

    const PerformanceRank = await ethers.getContractFactory("PerformanceRank");
    const performanceRank = await PerformanceRank.deploy(deployer.address);
    await performanceRank.waitForDeployment();

    const AccountImpl = await ethers.getContractFactory("ERC6551AgentAccount");
    const accountImplementation = await AccountImpl.deploy();
    await accountImplementation.waitForDeployment();

    const AgentNFT = await ethers.getContractFactory("AgentNFT");
    const agentNFT = await AgentNFT.deploy(
      deployer.address,
      await registry.getAddress(),
      await accountImplementation.getAddress(),
      await performanceRank.getAddress()
    );
    await agentNFT.waitForDeployment();

    const SwarmNFT = await ethers.getContractFactory("SwarmNFT");
    const swarmNFT = await SwarmNFT.deploy(
      deployer.address,
      await registry.getAddress(),
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

    const AgentSocialFeed = await ethers.getContractFactory("AgentSocialFeed");
    const socialFeed = await AgentSocialFeed.deploy(await agentNFT.getAddress(), await skillManager.getAddress());
    await socialFeed.waitForDeployment();

    const AgentExecutionHub = await ethers.getContractFactory("AgentExecutionHub");
    const executionHub = await AgentExecutionHub.deploy(
      await agentNFT.getAddress(),
      await swarmNFT.getAddress(),
      await skillManager.getAddress()
    );
    await executionHub.waitForDeployment();

    const MockPaymentToken = await ethers.getContractFactory("MockPaymentToken");
    const paymentToken = await MockPaymentToken.deploy(client.address, ethers.parseUnits("1000000", 18));
    await paymentToken.waitForDeployment();

    const AgentJobMarket = await ethers.getContractFactory("AgentJobMarket");
    const jobMarket = await AgentJobMarket.deploy(
      await paymentToken.getAddress(),
      await agentNFT.getAddress(),
      await swarmNFT.getAddress(),
      await performanceRank.getAddress()
    );
    await jobMarket.waitForDeployment();

    await (await performanceRank.setTrustedExecutor(await jobMarket.getAddress(), true)).wait();

    return {
      deployer,
      client,
      provider,
      evaluator,
      outsider,
      registry,
      performanceRank,
      accountImplementation,
      agentNFT,
      swarmNFT,
      skillNFT,
      skillManager,
      socialFeed,
      executionHub,
      paymentToken,
      jobMarket
    };
  }

  async function mintAgent(agentNFT, owner, name = "Alpha", role = "quant") {
    const salt = ethers.keccak256(ethers.toUtf8Bytes(`${name}-${role}-${owner.address}`));
    const tx = await agentNFT.mintAgent(owner.address, name, role, `${name} description`, salt);
    await tx.wait();
    const agentId = (await agentNFT.nextTokenId()) - 1n;
    const tba = await agentNFT.tbas(agentId);
    return { agentId, tba };
  }

  async function mintSwarm(swarmNFT, owner, name = "Swarm A") {
    const salt = ethers.keccak256(ethers.toUtf8Bytes(`${name}-${owner.address}`));
    const tx = await swarmNFT.mintSwarm(owner.address, name, "market-neutral", `${name} description`, salt);
    await tx.wait();
    const swarmId = (await swarmNFT.nextTokenId()) - 1n;
    const tba = await swarmNFT.tbas(swarmId);
    return { swarmId, tba };
  }

  async function defineSkill(skillNFT, to, name, skillType, capability, markdown, amount = 1n) {
    const skillId = await skillNFT.nextSkillId();
    const defineTx = await skillNFT.defineSkill(name, skillType, capability, `${name} description`, markdown);
    await defineTx.wait();
    await (await skillNFT.mintSkill(to.address, skillId, amount)).wait();
    return skillId;
  }

  it("mints agents and swarms with TBAs", async function () {
    const { agentNFT, swarmNFT, provider } = await deployFixture();

    const { agentId, tba: agentTba } = await mintAgent(agentNFT, provider);
    const { swarmId, tba: swarmTba } = await mintSwarm(swarmNFT, provider);

    expect(await agentNFT.ownerOf(agentId)).to.equal(provider.address);
    expect(await swarmNFT.ownerOf(swarmId)).to.equal(provider.address);
    expect(agentTba).to.properAddress;
    expect(swarmTba).to.properAddress;
  });

  it("equips skills, enforces capability gating, and allows posting", async function () {
    const { agentNFT, skillNFT, skillManager, socialFeed, provider } = await deployFixture();
    const { agentId, tba } = await mintAgent(agentNFT, provider, "Creator", "content");

    const creativeSkillId = await defineSkill(
      skillNFT,
      provider,
      "Creative Content",
      "creative",
      "creative_content",
      "# Creative skill"
    );

    await (await skillNFT.connect(provider).setApprovalForAll(await skillManager.getAddress(), true)).wait();

    await expect(socialFeed.connect(provider).post(agentId, "ipfs://post")).to.be.revertedWith("creative content skill required");

    await (await skillManager.connect(provider).equipSkill(agentId, creativeSkillId, 1)).wait();

    expect(await skillNFT.balanceOf(tba, creativeSkillId)).to.equal(1n);
    expect(await skillManager.canPost(agentId)).to.equal(true);

    await expect(socialFeed.connect(provider).post(agentId, "ipfs://post")).to.emit(socialFeed, "Posted");
  });

  it("enforces slot limits and increases capacity with score", async function () {
    const { agentNFT, skillNFT, skillManager, performanceRank, provider, deployer } = await deployFixture();
    const { agentId } = await mintAgent(agentNFT, provider, "Slotter", "ops");

    const skillOne = await defineSkill(skillNFT, provider, "Skill One", "quant", "quant_ops", "# one");
    const skillTwo = await defineSkill(skillNFT, provider, "Skill Two", "lp", "lp_management", "# two");

    await (await skillNFT.connect(provider).setApprovalForAll(await skillManager.getAddress(), true)).wait();
    await (await skillManager.connect(provider).equipSkill(agentId, skillOne, 1)).wait();

    await expect(skillManager.connect(provider).equipSkill(agentId, skillTwo, 1)).to.be.revertedWith("no free skill slots");

    await (await performanceRank.connect(deployer).increaseScore(agentId, 100, "level up")).wait();
    expect(await skillManager.skillSlots(agentId)).to.equal(2n);

    await (await skillManager.connect(provider).equipSkill(agentId, skillTwo, 1)).wait();
    expect(await skillManager.equippedSkillCount(agentId)).to.equal(2n);
  });

  it("unequips skills, returns inventory, and removes gated capability", async function () {
    const { agentNFT, skillNFT, skillManager, socialFeed, provider } = await deployFixture();
    const { agentId, tba } = await mintAgent(agentNFT, provider, "Unequipper", "content");

    const creativeSkillId = await defineSkill(
      skillNFT,
      provider,
      "Creative Content",
      "creative",
      "creative_content",
      "# Creative skill"
    );

    await (await skillNFT.connect(provider).setApprovalForAll(await skillManager.getAddress(), true)).wait();
    await (await skillManager.connect(provider).equipSkill(agentId, creativeSkillId, 1)).wait();

    expect(await skillNFT.balanceOf(tba, creativeSkillId)).to.equal(1n);
    expect(await skillManager.canPost(agentId)).to.equal(true);

    await (await skillManager.connect(provider).unequipSkill(agentId, creativeSkillId, 1, provider.address)).wait();

    expect(await skillNFT.balanceOf(tba, creativeSkillId)).to.equal(0n);
    expect(await skillNFT.balanceOf(provider.address, creativeSkillId)).to.equal(1n);
    expect(await skillManager.equippedSkillCount(agentId)).to.equal(0n);
    expect(await skillManager.canPost(agentId)).to.equal(false);
    await expect(socialFeed.connect(provider).post(agentId, "ipfs://post")).to.be.revertedWith("creative content skill required");
  });

  it("assigns worker custody to the swarm TBA", async function () {
    const { agentNFT, swarmNFT, provider, deployer } = await deployFixture();

    const { agentId: workerAgentId } = await mintAgent(agentNFT, deployer, "Worker", "lp");
    const { swarmId, tba: swarmTba } = await mintSwarm(swarmNFT, provider, "Execution Swarm");

    await (await agentNFT.connect(deployer).transferFrom(deployer.address, swarmTba, workerAgentId)).wait();

    expect(await swarmNFT.ownerOf(swarmId)).to.equal(provider.address);
    expect(await agentNFT.ownerOf(workerAgentId)).to.equal(swarmTba);
  });

  it("settles an agent job and pays the agent TBA", async function () {
    const { agentNFT, jobMarket, paymentToken, performanceRank, client, provider, evaluator } = await deployFixture();
    const { agentId, tba } = await mintAgent(agentNFT, provider, "Jobber", "quant");

    const budget = ethers.parseUnits("100", 18);
    const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 3600);

    await (await paymentToken.connect(client).approve(await jobMarket.getAddress(), budget)).wait();
    await (await jobMarket.connect(client).createAgentJob(agentId, evaluator.address, budget, expiry, "Do a task")).wait();
    const jobId = 1n;

    await (await jobMarket.connect(client).fund(jobId, budget)).wait();
    await (await jobMarket.connect(provider).submit(jobId, "ipfs://deliverable")).wait();
    await (await jobMarket.connect(evaluator).complete(jobId, "approved")).wait();

    expect(await paymentToken.balanceOf(tba)).to.equal(budget);
    expect(await performanceRank.intelligenceScore(agentId)).to.equal(10n);

    const job = await jobMarket.jobs(jobId);
    expect(job.status).to.equal(3n);
  });

  it("settles a swarm job and credits worker agents", async function () {
    const { agentNFT, swarmNFT, jobMarket, paymentToken, performanceRank, client, provider, evaluator, deployer } = await deployFixture();

    const { agentId: workerOneId } = await mintAgent(agentNFT, deployer, "Worker1", "ops");
    const { agentId: workerTwoId } = await mintAgent(agentNFT, deployer, "Worker2", "ops");
    const { swarmId, tba: swarmTba } = await mintSwarm(swarmNFT, provider, "Commerce Swarm");

    await (await agentNFT.connect(deployer).transferFrom(deployer.address, swarmTba, workerOneId)).wait();
    await (await agentNFT.connect(deployer).transferFrom(deployer.address, swarmTba, workerTwoId)).wait();

    const budget = ethers.parseUnits("250", 18);
    const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 3600);

    await (await paymentToken.connect(client).approve(await jobMarket.getAddress(), budget)).wait();
    await (await jobMarket.connect(client).createSwarmJob(
      swarmId,
      evaluator.address,
      budget,
      expiry,
      "Run the swarm",
      [workerOneId, workerTwoId]
    )).wait();

    const jobId = 1n;
    await (await jobMarket.connect(client).fund(jobId, budget)).wait();
    await (await jobMarket.connect(provider).submit(jobId, "ipfs://swarm-deliverable")).wait();
    await (await jobMarket.connect(evaluator).complete(jobId, "accepted")).wait();

    expect(await paymentToken.balanceOf(swarmTba)).to.equal(budget);
    expect(await performanceRank.intelligenceScore(workerOneId)).to.equal(4n);
    expect(await performanceRank.intelligenceScore(workerTwoId)).to.equal(4n);
  });
});
