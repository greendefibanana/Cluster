import { expect } from "chai";
import hre from "hardhat";
import { MockZeroGProvider } from "../gateway/zeroGProvider.js";

const { ethers } = hre;

describe("ClusterFi architecture migration", function () {
  async function deployFixture() {
    const [deployer, user, agentOwner, validator, outsider] = await ethers.getSigners();

    const MockRegistry = await ethers.getContractFactory("MockERC6551Registry");
    const registry = await MockRegistry.deploy();
    await registry.waitForDeployment();

    const PerformanceRank = await ethers.getContractFactory("PerformanceRank");
    const performanceRank = await PerformanceRank.deploy(deployer.address);
    await performanceRank.waitForDeployment();

    const AccountImpl = await ethers.getContractFactory("ERC6551AgentAccount");
    const accountImplementation = await AccountImpl.deploy();
    await accountImplementation.waitForDeployment();

    const Identity = await ethers.getContractFactory("AgentIdentityRegistry");
    const identity = await Identity.deploy(deployer.address);
    await identity.waitForDeployment();

    const Reputation = await ethers.getContractFactory("AgentReputationRegistry");
    const reputation = await Reputation.deploy(deployer.address);
    await reputation.waitForDeployment();

    const Validation = await ethers.getContractFactory("AgentValidationRegistry");
    const validation = await Validation.deploy(deployer.address);
    await validation.waitForDeployment();

    const AgentNFT = await ethers.getContractFactory("AgentNFT");
    const agentNFT = await AgentNFT.deploy(
      deployer.address,
      await registry.getAddress(),
      await accountImplementation.getAddress(),
      await performanceRank.getAddress()
    );
    await agentNFT.waitForDeployment();
    await (await identity.setTrustedRegistrar(await agentNFT.getAddress(), true)).wait();
    await (await agentNFT.setIdentityRegistry(await identity.getAddress())).wait();

    const ClusterNFT = await ethers.getContractFactory("ClusterNFT");
    const clusterNFT = await ClusterNFT.deploy(
      deployer.address,
      await registry.getAddress(),
      await accountImplementation.getAddress()
    );
    await clusterNFT.waitForDeployment();

    const SkillNFT = await ethers.getContractFactory("SkillNFT");
    const skillNFT = await SkillNFT.deploy(deployer.address);
    await skillNFT.waitForDeployment();

    const SkillManager = await ethers.getContractFactory("AgentSkillManager");
    const skillManager = await SkillManager.deploy(
      await agentNFT.getAddress(),
      await skillNFT.getAddress(),
      await performanceRank.getAddress()
    );
    await skillManager.waitForDeployment();
    await (await skillNFT.setManager(await skillManager.getAddress(), true)).wait();

    const SocialFeed = await ethers.getContractFactory("AgentSocialFeed");
    const socialFeed = await SocialFeed.deploy(await agentNFT.getAddress(), await skillManager.getAddress());
    await socialFeed.waitForDeployment();

    const MockPaymentToken = await ethers.getContractFactory("MockPaymentToken");
    const paymentToken = await MockPaymentToken.deploy(user.address, ethers.parseUnits("1000000", 18));
    await paymentToken.waitForDeployment();

    const Factory = await ethers.getContractFactory("UserStrategyAccountFactory");
    const accountFactory = await Factory.deploy(deployer.address);
    await accountFactory.waitForDeployment();

    const MockMemeAdapter = await ethers.getContractFactory("MockMemeAdapter");
    const memeAdapter = await MockMemeAdapter.deploy();
    await memeAdapter.waitForDeployment();

    const MockLPAdapter = await ethers.getContractFactory("MockLPAdapter");
    const lpAdapter = await MockLPAdapter.deploy();
    await lpAdapter.waitForDeployment();

    const MockYieldAdapter = await ethers.getContractFactory("MockYieldAdapter");
    const yieldAdapter = await MockYieldAdapter.deploy();
    await yieldAdapter.waitForDeployment();

    const MockPredictionMarketAdapter = await ethers.getContractFactory("MockPredictionMarketAdapter");
    const predictionAdapter = await MockPredictionMarketAdapter.deploy();
    await predictionAdapter.waitForDeployment();

    return {
      deployer,
      user,
      agentOwner,
      validator,
      outsider,
      identity,
      reputation,
      validation,
      agentNFT,
      clusterNFT,
      skillNFT,
      skillManager,
      socialFeed,
      paymentToken,
      accountFactory,
      memeAdapter,
      lpAdapter,
      yieldAdapter,
      predictionAdapter,
    };
  }

  async function mintAgent(agentNFT, owner, name = "Nexus", role = "quant") {
    const salt = ethers.keccak256(ethers.toUtf8Bytes(`${name}-${role}-${owner.address}`));
    await (await agentNFT.mintAgent(owner.address, name, role, `${name} description`, salt)).wait();
    const agentId = (await agentNFT.nextTokenId()) - 1n;
    return { agentId, tba: await agentNFT.tbas(agentId) };
  }

  async function mintCluster(clusterNFT, owner, name = "Alpha Cluster") {
    const salt = ethers.keccak256(ethers.toUtf8Bytes(`${name}-${owner.address}`));
    await (await clusterNFT.mintCluster(
      owner.address,
      name,
      "meme-yield",
      "Coordinates agent capital markets workflows",
      "0g://clusterfi/cluster-memory",
      salt
    )).wait();
    const clusterId = (await clusterNFT.nextTokenId()) - 1n;
    return { clusterId, tba: await clusterNFT.tbas(clusterId) };
  }

  async function defineAndEquipSkill(skillNFT, skillManager, agentNFT, owner, agentId, capability) {
    const skillId = await skillNFT.nextSkillId();
    await (await skillNFT.defineSkill(capability, "execution", capability, `${capability} skill`, "# Skill")).wait();
    await (await skillNFT.mintSkill(owner.address, skillId, 1)).wait();
    await (await skillNFT.connect(owner).setApprovalForAll(await skillManager.getAddress(), true)).wait();
    await (await skillManager.connect(owner).equipSkill(agentId, skillId, 1)).wait();
    expect(await skillNFT.balanceOf(await agentNFT.tbas(agentId), skillId)).to.equal(1n);
    return skillId;
  }

  function encodeIntent(adapter, asset, amount, receiver, maxSlippageBps, action, proofURI = "0g://proof") {
    const intent = ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(address asset,uint256 amount,address receiver,uint256 maxSlippageBps,bytes32 action,string proofURI)"],
      [[asset, amount, receiver, maxSlippageBps, action, proofURI]]
    );
    return adapter.interface.encodeFunctionData("execute", [intent]);
  }

  it("mints an agent TBA and registers identity on mint", async function () {
    const { identity, agentNFT, agentOwner, outsider } = await deployFixture();
    const { agentId, tba } = await mintAgent(agentNFT, agentOwner, "Oracle", "sleuth");

    const registered = await identity.getAgent(await agentNFT.getAddress(), agentId);
    expect(registered.agentId).to.equal(agentId);
    expect(registered.agentNft).to.equal(await agentNFT.getAddress());
    expect(registered.tba).to.equal(tba);
    expect(registered.owner).to.equal(agentOwner.address);
    expect(registered.role).to.equal("sleuth");
    expect(registered.status).to.equal(1n);

    await (await agentNFT.connect(agentOwner).transferFrom(agentOwner.address, outsider.address, agentId)).wait();
    const transferred = await identity.getAgent(await agentNFT.getAddress(), agentId);
    expect(transferred.owner).to.equal(outsider.address);
  });

  it("equips ERC1155 skills into the agent TBA and gates feed creation", async function () {
    const { agentNFT, skillNFT, skillManager, socialFeed, agentOwner } = await deployFixture();
    const { agentId } = await mintAgent(agentNFT, agentOwner, "Creator", "creator");

    const strategyId = ethers.keccak256(ethers.toUtf8Bytes("meme-strategy"));
    await expect(
      socialFeed.connect(agentOwner).createFeedEvent({
        actorType: "agent",
        actorId: agentId,
        actionType: "CREATE_MEME",
        title: "Creator launched a meme strategy",
        body: "Proof-backed post",
        strategyId,
        instrumentType: "meme",
        chainId: 97,
        contractAddress: ethers.ZeroAddress,
        proofURI: "0g://proof",
        pnl: 0,
        tvl: 0,
        riskScore: 50,
        createdAt: 0,
      })
    ).to.be.revertedWith("creative content skill required");

    await defineAndEquipSkill(skillNFT, skillManager, agentNFT, agentOwner, agentId, "creative_content");

    await expect(
      socialFeed.connect(agentOwner).createFeedEvent({
        actorType: "agent",
        actorId: agentId,
        actionType: "CREATE_MEME",
        title: "Creator launched a meme strategy",
        body: "Proof-backed post",
        strategyId,
        instrumentType: "meme",
        chainId: 97,
        contractAddress: ethers.ZeroAddress,
        proofURI: "0g://proof",
        pnl: 0,
        tvl: 0,
        riskScore: 50,
        createdAt: 0,
      })
    ).to.emit(socialFeed, "FeedEventCreated");
    expect(await socialFeed.totalFeedEvents()).to.equal(1n);
  });

  it("lets clusters own multiple agent NFTs through a cluster TBA", async function () {
    const { agentNFT, clusterNFT, agentOwner, deployer } = await deployFixture();
    const one = await mintAgent(agentNFT, deployer, "Sleuth", "sleuth");
    const two = await mintAgent(agentNFT, deployer, "Quant", "quant");
    const cluster = await mintCluster(clusterNFT, agentOwner);

    await (await agentNFT.connect(deployer).transferFrom(deployer.address, cluster.tba, one.agentId)).wait();
    await (await agentNFT.connect(deployer).transferFrom(deployer.address, cluster.tba, two.agentId)).wait();

    expect(await clusterNFT.ownerOf(cluster.clusterId)).to.equal(agentOwner.address);
    expect(await agentNFT.ownerOf(one.agentId)).to.equal(cluster.tba);
    expect(await agentNFT.ownerOf(two.agentId)).to.equal(cluster.tba);
  });

  it("records reputation events and proof-backed validation claims", async function () {
    const { reputation, validation, validator } = await deployFixture();
    const strategyId = ethers.keccak256(ethers.toUtf8Bytes("yield-1"));
    const claimHash = ethers.keccak256(ethers.toUtf8Bytes("pnl claim"));

    await expect(
      reputation.recordEvent(0, 1, strategyId, "PNL_UPDATE", 12, 1000, 5000, "0g://pnl-proof")
    ).to.emit(reputation, "ReputationRecorded");
    expect(await reputation.totalEvents()).to.equal(1n);

    await expect(
      validation.submitClaim(claimHash, 0, 1, strategyId, "VALIDATE_PNL", "0g://validation", validator.address)
    ).to.emit(validation, "ClaimSubmitted");
    await expect(validation.connect(validator).updateClaimStatus(claimHash, 1)).to.emit(validation, "ClaimStatusUpdated");

    const claim = await validation.getClaim(claimHash);
    expect(claim.status).to.equal(1n);
  });

  it("creates isolated non-custodial Sovereign Accounts and enforces adapter safety", async function () {
    const { user, agentOwner, outsider, paymentToken, accountFactory, yieldAdapter, lpAdapter } = await deployFixture();
    const strategyId = ethers.keccak256(ethers.toUtf8Bytes("yield-strategy"));
    const amount = ethers.parseUnits("100", 18);
    const predicted = await accountFactory.predictAccountAddress(
      user.address,
      agentOwner.address,
      strategyId,
      await paymentToken.getAddress()
    );

    await expect(accountFactory.connect(outsider).createStrategyAccount(
      user.address,
      agentOwner.address,
      strategyId,
      {
        asset: await paymentToken.getAddress(),
        maxAllocation: amount,
        maxSlippageBps: 100,
        allowedAdapters: [await yieldAdapter.getAddress()],
      }
    )).to.be.revertedWith("user authorization required");

    await (await accountFactory.connect(user).createStrategyAccount(
      user.address,
      agentOwner.address,
      strategyId,
      {
        asset: await paymentToken.getAddress(),
        maxAllocation: amount,
        maxSlippageBps: 100,
        allowedAdapters: [await yieldAdapter.getAddress()],
      }
    )).wait();

    const account = await ethers.getContractAt("UserStrategyAccount", predicted);
    await (await paymentToken.connect(user).approve(predicted, amount)).wait();
    await (await account.connect(user).deposit(amount)).wait();
    expect(await paymentToken.balanceOf(predicted)).to.equal(amount);

    const yieldAction = ethers.keccak256(ethers.toUtf8Bytes("RUN_YIELD_STRATEGY"));
    const executeData = encodeIntent(
      yieldAdapter,
      await paymentToken.getAddress(),
      ethers.parseUnits("25", 18),
      predicted,
      50,
      yieldAction
    );
    await expect(account.connect(agentOwner).executeStrategy(await yieldAdapter.getAddress(), executeData))
      .to.emit(account, "StrategyExecuted");

    const maliciousData = encodeIntent(
      yieldAdapter,
      await paymentToken.getAddress(),
      ethers.parseUnits("1", 18),
      agentOwner.address,
      50,
      yieldAction
    );
    await expect(account.connect(agentOwner).executeStrategy(await yieldAdapter.getAddress(), maliciousData))
      .to.be.revertedWith("unauthorized receiver");

    await expect(account.connect(agentOwner).executeStrategy(await lpAdapter.getAddress(), executeData))
      .to.be.revertedWith("adapter not allowed");

    await (await account.connect(user).pause()).wait();
    await expect(account.connect(agentOwner).executeStrategy(await yieldAdapter.getAddress(), executeData))
      .to.be.revertedWith("account paused");
    await (await account.connect(user).resume()).wait();

    await (await account.connect(user).revokeExecutor()).wait();
    await expect(account.connect(agentOwner).executeStrategy(await yieldAdapter.getAddress(), executeData))
      .to.be.revertedWith("not executor");

    await (await account.connect(user).setApprovedExecutor(agentOwner.address)).wait();
    await expect(account.connect(outsider).withdraw(1)).to.be.revertedWith("not owner");
    await (await account.connect(user).close()).wait();
    expect(await paymentToken.balanceOf(predicted)).to.equal(0n);
  });

  it("mocks 0G uploads with stable 0g URIs", async function () {
    const zeroG = new MockZeroGProvider({ namespace: "test" });
    const upload = await zeroG.uploadStrategyProof("strategy-1", { pnl: 42 });
    expect(upload.provider).to.equal("mock-0g");
    expect(upload.uri).to.match(/^0g:\/\/test\/strategy-proof\//);
    expect(upload.rootHash).to.have.length(64);
  });
});
