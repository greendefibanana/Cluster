import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("Bidding Board Functional Test", function () {
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
      agentNFT,
      swarmNFT,
      paymentToken,
      jobMarket,
      performanceRank
    };
  }

  async function mintAgent(agentNFT, owner, name = "Alpha", role = "quant") {
    const salt = ethers.keccak256(ethers.toUtf8Bytes(`${name}-${role}-${owner.address}-${Math.random()}`));
    const tx = await agentNFT.mintAgent(owner.address, name, role, `${name} description`, salt);
    await tx.wait();
    const agentId = (await agentNFT.nextTokenId()) - 1n;
    const tba = await agentNFT.tbas(agentId);
    return { agentId, tba };
  }

  it("should allow creating an open job, placing bids, and accepting a bid", async function () {
    const { agentNFT, jobMarket, paymentToken, client, provider, evaluator } = await deployFixture();
    
    // 1. Client creates an open job
    const budget = ethers.parseUnits("100", 18);
    const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 3600);
    
    await (await jobMarket.connect(client).createOpenJob(
        evaluator.address,
        budget,
        expiry,
        "Analyze BNB trends"
    )).wait();
    
    const jobId = 1n;
    let job = await jobMarket.jobs(jobId);
    expect(job.client).to.equal(client.address);
    expect(job.providerKind).to.equal(2n); // None
    
    // 2. Provider (with an agent) places a bid
    const { agentId, tba } = await mintAgent(agentNFT, provider, "Sleuth", "analyst");
    
    await expect(jobMarket.connect(provider).placeBid(jobId, 0, agentId))
        .to.emit(jobMarket, "BidPlaced")
        .withArgs(jobId, 0n, agentId);
    
    const bids = await jobMarket.getBids(jobId);
    expect(bids.length).to.equal(1);
    expect(bids[0].providerId).to.equal(agentId);
    
    // 3. Client accepts the bid
    await expect(jobMarket.connect(client).acceptBid(jobId, 0))
        .to.emit(jobMarket, "BidAccepted")
        .withArgs(jobId, 0n, agentId);
    
    job = await jobMarket.jobs(jobId);
    expect(job.providerKind).to.equal(0n); // Agent
    expect(job.providerId).to.equal(agentId);
    
    // 4. Client funds the job
    await (await paymentToken.connect(client).approve(await jobMarket.getAddress(), budget)).wait();
    await (await jobMarket.connect(client).fund(jobId, budget)).wait();
    
    expect(job.status).to.equal(0n); // status updated in fund
    const updatedJob = await jobMarket.jobs(jobId);
    expect(updatedJob.status).to.equal(1n); // Funded
    
    // 5. Provider submits and evaluator completes
    await (await jobMarket.connect(provider).submit(jobId, "ipfs://result")).wait();
    await (await jobMarket.connect(evaluator).complete(jobId, "great work")).wait();
    
    expect(await paymentToken.balanceOf(tba)).to.equal(budget);
  });

  it("should reject bids from non-owners", async function () {
    const { agentNFT, jobMarket, client, provider, outsider, evaluator } = await deployFixture();
    
    const budget = ethers.parseUnits("100", 18);
    const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 3600);
    await jobMarket.connect(client).createOpenJob(evaluator.address, budget, expiry, "Open Job");
    
    const { agentId } = await mintAgent(agentNFT, provider);
    
    await expect(jobMarket.connect(outsider).placeBid(1, 0, agentId))
        .to.be.revertedWith("not agent owner");
  });

  it("should reject acceptBid from non-clients", async function () {
    const { agentNFT, jobMarket, client, provider, evaluator } = await deployFixture();
    
    const budget = ethers.parseUnits("100", 18);
    const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 3600);
    await jobMarket.connect(client).createOpenJob(evaluator.address, budget, expiry, "Open Job");
    
    const { agentId } = await mintAgent(agentNFT, provider);
    await jobMarket.connect(provider).placeBid(1, 0, agentId);
    
    await expect(jobMarket.connect(provider).acceptBid(1, 0))
        .to.be.revertedWith("not client");
  });
});
