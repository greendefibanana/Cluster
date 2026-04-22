import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("Clustr Functional Audit", function () {
  // ===========================================================
  // Shared fixture — mirrors the deploy script exactly
  // ===========================================================
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

    await (await executionHub.setTargetPolicy(
      await tokenFactory.getAddress(),
      tokenFactory.interface.getFunction("deployToken").selector,
      "deployer",
      true
    )).wait();

    await (await performanceRank.setTrustedExecutor(await jobMarket.getAddress(), true)).wait();

    // Allow token factory to be called by anyone (for testing, factory already allows owner)
    // Factory owner is deployer, so deployer can call directly

    return {
      deployer, client, provider, evaluator, outsider,
      registry, performanceRank, accountImplementation,
      agentNFT, swarmNFT, skillNFT, skillManager,
      socialFeed, tokenFactory, executionHub, paymentToken, jobMarket
    };
  }

  // ===========================================================
  // Helpers
  // ===========================================================
  async function mintAgent(agentNFT, owner, name = "Alpha", role = "quant") {
    const salt = ethers.keccak256(ethers.toUtf8Bytes(`${name}-${role}-${owner.address}-${Date.now()}-${Math.random()}`));
    const tx = await agentNFT.mintAgent(owner.address, name, role, `${name} description`, salt);
    await tx.wait();
    const agentId = (await agentNFT.nextTokenId()) - 1n;
    const tba = await agentNFT.tbas(agentId);
    return { agentId, tba };
  }

  async function mintSwarm(swarmNFT, owner, name = "Swarm A") {
    const salt = ethers.keccak256(ethers.toUtf8Bytes(`${name}-${owner.address}-${Date.now()}-${Math.random()}`));
    const tx = await swarmNFT.mintSwarm(owner.address, name, "market-neutral", `${name} description`, salt);
    await tx.wait();
    const swarmId = (await swarmNFT.nextTokenId()) - 1n;
    const tba = await swarmNFT.tbas(swarmId);
    return { swarmId, tba };
  }

  async function defineSkill(skillNFT, to, name, skillType, capability, markdown, amount = 1n) {
    const skillId = await skillNFT.nextSkillId();
    await (await skillNFT.defineSkill(name, skillType, capability, `${name} desc`, markdown)).wait();
    await (await skillNFT.mintSkill(to.address, skillId, amount)).wait();
    return skillId;
  }

  function getTbaContract(tbaAddress, signer) {
    const tbaAbi = [
      "function setExecutor(address executor, bool allowed) external",
      "function execute(address to, uint256 value, bytes calldata data, uint8 operation) payable returns (bytes)",
      "function executors(address executor) view returns (bool)"
    ];
    return new ethers.Contract(tbaAddress, tbaAbi, signer);
  }

  // Set execution hub as an executor on a TBA so the hub can call execute() on it
  async function authorizeTbaExecutor(tbaAddress, executorAddress, ownerSigner) {
    const tba = getTbaContract(tbaAddress, ownerSigner);
    await (await tba.setExecutor(executorAddress, true)).wait();
  }

  // ============================================================
  //  1. AGENT EXECUTION HUB — Master → Worker Delegation
  // ============================================================
  describe("AgentExecutionHub — Master/Worker Execution", function () {
    it("master owner can execute a worker action via the hub", async function () {
      const { agentNFT, skillNFT, skillManager, executionHub, tokenFactory, performanceRank, deployer } = await deployFixture();

      // Mint master and worker agents (both owned by deployer initially)
      const master = await mintAgent(agentNFT, deployer, "Master", "orchestrator");
      const worker = await mintAgent(agentNFT, deployer, "Worker", "deployer");

      const deployerSkillId = await defineSkill(
        skillNFT,
        deployer,
        "Token Deployer",
        "deployer",
        "deployer",
        "# deployer"
      );
      await (await skillNFT.connect(deployer).setApprovalForAll(await skillManager.getAddress(), true)).wait();
      await (await skillManager.connect(deployer).equipSkill(worker.agentId, deployerSkillId, 1)).wait();

      // Transfer worker into master's TBA (worker is now owned by master TBA)
      await (await agentNFT.connect(deployer).transferFrom(deployer.address, master.tba, worker.agentId)).wait();
      expect(await agentNFT.ownerOf(worker.agentId)).to.equal(master.tba);

      // Encode a WorkerTokenFactory.deployToken call for the worker to execute
      const factoryIface = new ethers.Interface([
        "function deployToken(string name, string symbol, uint256 supply, address tokenOwner) returns (address)"
      ]);
      const deployTokenCall = factoryIface.encodeFunctionData("deployToken", [
        "TestWorkerCoin",
        "TWC",
        ethers.parseUnits("1000000", 18),
        worker.tba
      ]);

      // Allow the token factory to be called by worker TBA — factory requires owner or trusted caller
      await (await tokenFactory.setTrustedCaller(worker.tba, true)).wait();

      // Authorize the execution hub as an executor on the master TBA
      // (hub calls masterTba.execute() which requires msg.sender == owner || executors[msg.sender])
      await authorizeTbaExecutor(master.tba, await executionHub.getAddress(), deployer);

      // Execute worker action via the execution hub (deployer owns master, master owns worker)
      const tx = await executionHub.connect(deployer).executeWorkerAction(
        master.agentId,
        master.tba,
        worker.agentId,
        worker.tba,
        await tokenFactory.getAddress(),
        0,
        deployTokenCall
      );
      const receipt = await tx.wait();

      // Verify the execution emits WorkerExecution event
      await expect(tx).to.emit(executionHub, "WorkerExecution")
        .withArgs(master.agentId, worker.agentId, await tokenFactory.getAddress(), deployTokenCall);

      // Execution no longer auto-awards score; only evaluated flows should update rank.
      expect(await performanceRank.intelligenceScore(worker.agentId)).to.equal(0n);
      expect(await performanceRank.intelligenceScore(master.agentId)).to.equal(0n);

      // Verify the token was actually deployed by checking the factory event
      const factoryEvent = new ethers.Interface([
        "event WorkerTokenDeployed(address indexed token, address indexed owner, string name, string symbol, uint256 supply)"
      ]);
      let tokenAddress = null;
      for (const log of receipt.logs) {
        try {
          const parsed = factoryEvent.parseLog(log);
          if (parsed) {
            tokenAddress = parsed.args.token;
            break;
          }
        } catch {}
      }
      expect(tokenAddress).to.not.be.null;

      // Verify the deployed token exists and has correct owner
      const WorkerToken = await ethers.getContractFactory("WorkerToken");
      const tokenContract = WorkerToken.attach(tokenAddress);
      expect(await tokenContract.balanceOf(worker.tba)).to.equal(ethers.parseUnits("1000000", 18));
    });

    it("rejects execution if caller is not the master owner", async function () {
      const { agentNFT, executionHub, deployer, outsider } = await deployFixture();

      const master = await mintAgent(agentNFT, deployer, "Master", "orchestrator");
      const worker = await mintAgent(agentNFT, deployer, "Worker", "ops");
      await (await agentNFT.connect(deployer).transferFrom(deployer.address, master.tba, worker.agentId)).wait();

      await expect(
        executionHub.connect(outsider).executeWorkerAction(
          master.agentId, master.tba, worker.agentId, worker.tba,
          ethers.ZeroAddress, 0, "0x"
        )
      ).to.be.revertedWith("caller is not master owner");
    });

    it("rejects execution if worker is not owned by master TBA", async function () {
      const { agentNFT, executionHub, deployer } = await deployFixture();

      const master = await mintAgent(agentNFT, deployer, "Master", "orchestrator");
      const worker = await mintAgent(agentNFT, deployer, "Worker", "ops");
      // DON'T transfer worker to master TBA

      await expect(
        executionHub.connect(deployer).executeWorkerAction(
          master.agentId, master.tba, worker.agentId, worker.tba,
          ethers.ZeroAddress, 0, "0x"
        )
      ).to.be.revertedWith("worker not owned by master");
    });

    it("rejects execution with invalid master TBA", async function () {
      const { agentNFT, executionHub, deployer } = await deployFixture();

      const master = await mintAgent(agentNFT, deployer, "Master", "orchestrator");
      const worker = await mintAgent(agentNFT, deployer, "Worker", "ops");
      await (await agentNFT.connect(deployer).transferFrom(deployer.address, master.tba, worker.agentId)).wait();

      await expect(
        executionHub.connect(deployer).executeWorkerAction(
          master.agentId, ethers.ZeroAddress, worker.agentId, worker.tba,
          ethers.ZeroAddress, 0, "0x"
        )
      ).to.be.revertedWith("invalid master TBA");
    });

    it("rejects score farming through non-contract targets", async function () {
      const { agentNFT, executionHub, performanceRank, deployer, outsider } = await deployFixture();

      const master = await mintAgent(agentNFT, deployer, "Master", "orchestrator");
      const worker = await mintAgent(agentNFT, deployer, "Worker", "ops");
      await (await agentNFT.connect(deployer).transferFrom(deployer.address, master.tba, worker.agentId)).wait();
      await authorizeTbaExecutor(master.tba, await executionHub.getAddress(), deployer);

      await expect(
        executionHub.connect(deployer).executeWorkerAction(
          master.agentId,
          master.tba,
          worker.agentId,
          worker.tba,
          outsider.address,
          0,
          "0x"
        )
      ).to.be.revertedWith("target must be contract");

      expect(await performanceRank.intelligenceScore(master.agentId)).to.equal(0n);
      expect(await performanceRank.intelligenceScore(worker.agentId)).to.equal(0n);
    });
  });

  // ============================================================
  //  2. SWARM EXECUTION HUB — Swarm → Worker Delegation
  // ============================================================
  describe("AgentExecutionHub — Swarm/Worker Execution", function () {
    it("swarm owner can execute a worker action via swarm delegation", async function () {
      const { agentNFT, swarmNFT, skillNFT, skillManager, executionHub, tokenFactory, performanceRank, deployer } = await deployFixture();

      const worker = await mintAgent(agentNFT, deployer, "SwarmWorker", "deployer");
      const swarm = await mintSwarm(swarmNFT, deployer, "Test Swarm");

      const deployerSkillId = await defineSkill(
        skillNFT,
        deployer,
        "Token Deployer",
        "deployer",
        "deployer",
        "# deployer"
      );
      await (await skillNFT.connect(deployer).setApprovalForAll(await skillManager.getAddress(), true)).wait();
      await (await skillManager.connect(deployer).equipSkill(worker.agentId, deployerSkillId, 1)).wait();

      // Transfer worker into swarm TBA
      await (await agentNFT.connect(deployer).transferFrom(deployer.address, swarm.tba, worker.agentId)).wait();
      expect(await agentNFT.ownerOf(worker.agentId)).to.equal(swarm.tba);

      // Allow factory calls from worker TBA
      await (await tokenFactory.setTrustedCaller(worker.tba, true)).wait();

      // Authorize the execution hub on the swarm TBA
      await authorizeTbaExecutor(swarm.tba, await executionHub.getAddress(), deployer);

      const factoryIface = new ethers.Interface([
        "function deployToken(string name, string symbol, uint256 supply, address tokenOwner) returns (address)"
      ]);
      const deployTokenCall = factoryIface.encodeFunctionData("deployToken", [
        "SwarmCoin", "SWC", ethers.parseUnits("500000", 18), worker.tba
      ]);

      const tx = await executionHub.connect(deployer).executeSwarmWorkerAction(
        swarm.swarmId, swarm.tba, worker.agentId, worker.tba,
        await tokenFactory.getAddress(), 0, deployTokenCall
      );
      await tx.wait();

      await expect(tx).to.emit(executionHub, "SwarmWorkerExecution")
        .withArgs(swarm.swarmId, worker.agentId, await tokenFactory.getAddress(), deployTokenCall);

      expect(await performanceRank.intelligenceScore(worker.agentId)).to.equal(0n);
    });

    it("rejects execution when the worker lacks the required capability", async function () {
      const { agentNFT, executionHub, tokenFactory, deployer } = await deployFixture();

      const master = await mintAgent(agentNFT, deployer, "Master", "orchestrator");
      const worker = await mintAgent(agentNFT, deployer, "Worker", "deployer");
      await (await agentNFT.connect(deployer).transferFrom(deployer.address, master.tba, worker.agentId)).wait();
      await authorizeTbaExecutor(master.tba, await executionHub.getAddress(), deployer);
      await (await tokenFactory.setTrustedCaller(worker.tba, true)).wait();

      const deployTokenCall = new ethers.Interface([
        "function deployToken(string name, string symbol, uint256 supply, address tokenOwner) returns (address)"
      ]).encodeFunctionData("deployToken", ["NoSkill", "NSK", 1000n, worker.tba]);

      await expect(
        executionHub.connect(deployer).executeWorkerAction(
          master.agentId,
          master.tba,
          worker.agentId,
          worker.tba,
          await tokenFactory.getAddress(),
          0,
          deployTokenCall
        )
      ).to.be.revertedWith("missing required capability");
    });

    it("rejects execution for unconfigured actions even when the target is trusted", async function () {
      const { agentNFT, executionHub, tokenFactory, deployer } = await deployFixture();

      const master = await mintAgent(agentNFT, deployer, "Master", "orchestrator");
      const worker = await mintAgent(agentNFT, deployer, "Worker", "deployer");
      await (await agentNFT.connect(deployer).transferFrom(deployer.address, master.tba, worker.agentId)).wait();
      await authorizeTbaExecutor(master.tba, await executionHub.getAddress(), deployer);

      const unauthorizedCall = tokenFactory.interface.encodeFunctionData("setTrustedCaller", [
        worker.tba,
        true
      ]);

      await expect(
        executionHub.connect(deployer).executeWorkerAction(
          master.agentId,
          master.tba,
          worker.agentId,
          worker.tba,
          await tokenFactory.getAddress(),
          0,
          unauthorizedCall
        )
      ).to.be.revertedWith("action not allowed");
    });

    it("rejects swarm execution if caller is not swarm owner", async function () {
      const { agentNFT, swarmNFT, executionHub, deployer, outsider } = await deployFixture();

      const worker = await mintAgent(agentNFT, deployer, "SwarmWorker", "ops");
      const swarm = await mintSwarm(swarmNFT, deployer, "Test Swarm");
      await (await agentNFT.connect(deployer).transferFrom(deployer.address, swarm.tba, worker.agentId)).wait();

      await expect(
        executionHub.connect(outsider).executeSwarmWorkerAction(
          swarm.swarmId, swarm.tba, worker.agentId, worker.tba,
          ethers.ZeroAddress, 0, "0x"
        )
      ).to.be.revertedWith("caller is not swarm owner");
    });

    it("rejects swarm execution if worker is not owned by swarm TBA", async function () {
      const { agentNFT, swarmNFT, executionHub, deployer } = await deployFixture();

      const worker = await mintAgent(agentNFT, deployer, "SwarmWorker", "ops");
      const swarm = await mintSwarm(swarmNFT, deployer, "Test Swarm");
      // DON'T transfer worker into swarm

      await expect(
        executionHub.connect(deployer).executeSwarmWorkerAction(
          swarm.swarmId, swarm.tba, worker.agentId, worker.tba,
          ethers.ZeroAddress, 0, "0x"
        )
      ).to.be.revertedWith("worker not owned by swarm");
    });

    it("rejects swarm score farming through non-contract targets", async function () {
      const { agentNFT, swarmNFT, executionHub, performanceRank, deployer, outsider } = await deployFixture();

      const worker = await mintAgent(agentNFT, deployer, "SwarmWorker", "ops");
      const swarm = await mintSwarm(swarmNFT, deployer, "Test Swarm");
      await (await agentNFT.connect(deployer).transferFrom(deployer.address, swarm.tba, worker.agentId)).wait();
      await authorizeTbaExecutor(swarm.tba, await executionHub.getAddress(), deployer);

      await expect(
        executionHub.connect(deployer).executeSwarmWorkerAction(
          swarm.swarmId,
          swarm.tba,
          worker.agentId,
          worker.tba,
          outsider.address,
          0,
          "0x"
        )
      ).to.be.revertedWith("target must be contract");

      expect(await performanceRank.intelligenceScore(worker.agentId)).to.equal(0n);
    });
  });

  // ============================================================
  //  3. ERC-6551 EXECUTOR LIFECYCLE
  // ============================================================
  describe("ERC6551AgentAccount — Executor Lifecycle", function () {
    it("invalidates old executor approvals after agent ownership transfer", async function () {
      const { agentNFT, tokenFactory, deployer, provider, outsider } = await deployFixture();

      const agent = await mintAgent(agentNFT, deployer, "Transferable", "ops");
      const tbaAsOutsider = getTbaContract(agent.tba, outsider);
      const factoryIface = new ethers.Interface([
        "function deployToken(string name, string symbol, uint256 supply, address tokenOwner) returns (address)"
      ]);

      await authorizeTbaExecutor(agent.tba, outsider.address, deployer);
      await (await tokenFactory.setTrustedCaller(agent.tba, true)).wait();
      expect(await tbaAsOutsider.executors(outsider.address)).to.equal(true);

      const initialCall = factoryIface.encodeFunctionData("deployToken", [
        "BeforeTransfer",
        "BFR",
        1000n,
        agent.tba
      ]);
      await expect(
        tbaAsOutsider.execute(await tokenFactory.getAddress(), 0, initialCall, 0)
      ).to.not.be.reverted;

      await (await agentNFT.connect(deployer).transferFrom(deployer.address, provider.address, agent.agentId)).wait();

      expect(await tbaAsOutsider.executors(outsider.address)).to.equal(false);

      const staleCall = factoryIface.encodeFunctionData("deployToken", [
        "AfterTransfer",
        "AFT",
        1000n,
        agent.tba
      ]);
      await expect(
        tbaAsOutsider.execute(await tokenFactory.getAddress(), 0, staleCall, 0)
      ).to.be.revertedWith("not authorized");

      await authorizeTbaExecutor(agent.tba, outsider.address, provider);
      expect(await tbaAsOutsider.executors(outsider.address)).to.equal(true);

      const renewedCall = factoryIface.encodeFunctionData("deployToken", [
        "RenewedAccess",
        "NEW",
        1000n,
        agent.tba
      ]);
      await expect(
        tbaAsOutsider.execute(await tokenFactory.getAddress(), 0, renewedCall, 0)
      ).to.not.be.reverted;
    });
  });

  // ============================================================
  //  4. JOB REJECTION + REFUND FLOW
  // ============================================================
  describe("AgentJobMarket — Rejection Flows", function () {
    it("client can reject an Open job (no funds involved)", async function () {
      const { agentNFT, jobMarket, client, evaluator, provider } = await deployFixture();
      const { agentId } = await mintAgent(agentNFT, provider, "Jobber", "quant");

      const budget = ethers.parseUnits("100", 18);
      const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 3600);
      await (await jobMarket.connect(client).createAgentJob(agentId, evaluator.address, budget, expiry, "Task")).wait();

      // Client rejects their own Open job
      await expect(jobMarket.connect(client).reject(1n, "changed mind"))
        .to.emit(jobMarket, "JobRejected").withArgs(1n, "changed mind");

      const job = await jobMarket.jobs(1n);
      expect(job.status).to.equal(4n); // Rejected
    });

    it("evaluator can reject a Funded job — refunds client", async function () {
      const { agentNFT, jobMarket, paymentToken, client, evaluator, provider } = await deployFixture();
      const { agentId } = await mintAgent(agentNFT, provider, "Jobber", "quant");

      const budget = ethers.parseUnits("50", 18);
      const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 3600);
      await (await paymentToken.connect(client).approve(await jobMarket.getAddress(), budget)).wait();
      await (await jobMarket.connect(client).createAgentJob(agentId, evaluator.address, budget, expiry, "Task")).wait();
      await (await jobMarket.connect(client).fund(1n, budget)).wait();

      const clientBalBefore = await paymentToken.balanceOf(client.address);

      await expect(jobMarket.connect(evaluator).reject(1n, "quality issue"))
        .to.emit(jobMarket, "JobRejected").withArgs(1n, "quality issue");

      // Verify refund
      const clientBalAfter = await paymentToken.balanceOf(client.address);
      expect(clientBalAfter - clientBalBefore).to.equal(budget);

      const job = await jobMarket.jobs(1n);
      expect(job.status).to.equal(4n); // Rejected
    });

    it("evaluator can reject a Submitted job — refunds client", async function () {
      const { agentNFT, jobMarket, paymentToken, client, evaluator, provider } = await deployFixture();
      const { agentId } = await mintAgent(agentNFT, provider, "Jobber", "quant");

      const budget = ethers.parseUnits("75", 18);
      const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 3600);
      await (await paymentToken.connect(client).approve(await jobMarket.getAddress(), budget)).wait();
      await (await jobMarket.connect(client).createAgentJob(agentId, evaluator.address, budget, expiry, "Task")).wait();
      await (await jobMarket.connect(client).fund(1n, budget)).wait();
      await (await jobMarket.connect(provider).submit(1n, "ipfs://deliverable")).wait();

      const clientBalBefore = await paymentToken.balanceOf(client.address);
      await (await jobMarket.connect(evaluator).reject(1n, "not acceptable")).wait();

      const clientBalAfter = await paymentToken.balanceOf(client.address);
      expect(clientBalAfter - clientBalBefore).to.equal(budget);
    });

    it("outsider cannot reject a job", async function () {
      const { agentNFT, jobMarket, client, evaluator, provider, outsider } = await deployFixture();
      const { agentId } = await mintAgent(agentNFT, provider, "Jobber", "quant");

      const budget = ethers.parseUnits("100", 18);
      const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 3600);
      await (await jobMarket.connect(client).createAgentJob(agentId, evaluator.address, budget, expiry, "Task")).wait();

      await expect(jobMarket.connect(outsider).reject(1n, "hacker")).to.be.revertedWith("not client");
    });
  });

  // ============================================================
  //  4. JOB EXPIRY + CLAIM REFUND
  // ============================================================
  describe("AgentJobMarket — Expiry + Refund", function () {
    it("client can claim refund after job expires", async function () {
      const { agentNFT, jobMarket, paymentToken, client, evaluator, provider } = await deployFixture();
      const { agentId } = await mintAgent(agentNFT, provider, "Jobber", "quant");

      const budget = ethers.parseUnits("200", 18);
      const block = await ethers.provider.getBlock("latest");
      const expiry = BigInt(block.timestamp + 60); // expires in 60 seconds
      await (await paymentToken.connect(client).approve(await jobMarket.getAddress(), budget)).wait();
      await (await jobMarket.connect(client).createAgentJob(agentId, evaluator.address, budget, expiry, "Urgent task")).wait();
      await (await jobMarket.connect(client).fund(1n, budget)).wait();

      // Try to claim before expiry — should fail
      await expect(jobMarket.connect(client).claimRefund(1n)).to.be.revertedWith("job not expired");

      // Fast-forward past expiry
      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine", []);

      const clientBalBefore = await paymentToken.balanceOf(client.address);
      await expect(jobMarket.connect(client).claimRefund(1n))
        .to.emit(jobMarket, "JobRefunded").withArgs(1n);

      const clientBalAfter = await paymentToken.balanceOf(client.address);
      expect(clientBalAfter - clientBalBefore).to.equal(budget);

      const job = await jobMarket.jobs(1n);
      expect(job.status).to.equal(5n); // Expired
    });

    it("non-client cannot claim refund", async function () {
      const { agentNFT, jobMarket, paymentToken, client, evaluator, provider, outsider } = await deployFixture();
      const { agentId } = await mintAgent(agentNFT, provider, "Jobber", "quant");

      const budget = ethers.parseUnits("100", 18);
      const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 60);
      await (await paymentToken.connect(client).approve(await jobMarket.getAddress(), budget)).wait();
      await (await jobMarket.connect(client).createAgentJob(agentId, evaluator.address, budget, expiry, "Task")).wait();
      await (await jobMarket.connect(client).fund(1n, budget)).wait();

      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine", []);

      await expect(jobMarket.connect(outsider).claimRefund(1n)).to.be.revertedWith("not client");
    });

    it("cannot submit to an expired job", async function () {
      const { agentNFT, jobMarket, paymentToken, client, evaluator, provider } = await deployFixture();
      const { agentId } = await mintAgent(agentNFT, provider, "Jobber", "quant");

      const budget = ethers.parseUnits("100", 18);
      const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 60);
      await (await paymentToken.connect(client).approve(await jobMarket.getAddress(), budget)).wait();
      await (await jobMarket.connect(client).createAgentJob(agentId, evaluator.address, budget, expiry, "Task")).wait();
      await (await jobMarket.connect(client).fund(1n, budget)).wait();

      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine", []);

      await expect(jobMarket.connect(provider).submit(1n, "ipfs://late")).to.be.revertedWith("job expired");
    });
  });

  // ============================================================
  //  5. PERFORMANCE RANK — Score management + access control
  // ============================================================
  describe("PerformanceRank — Score Management", function () {
    it("owner can increase and decrease scores", async function () {
      const { performanceRank, deployer } = await deployFixture();

      await (await performanceRank.increaseScore(1n, 50, "test boost")).wait();
      expect(await performanceRank.intelligenceScore(1n)).to.equal(50n);

      await (await performanceRank.decreaseScore(1n, 20, "penalty")).wait();
      expect(await performanceRank.intelligenceScore(1n)).to.equal(30n);
    });

    it("score cannot exceed MAX_SCORE (10000)", async function () {
      const { performanceRank } = await deployFixture();

      await (await performanceRank.increaseScore(1n, 10000, "max out")).wait();
      expect(await performanceRank.intelligenceScore(1n)).to.equal(10000n);

      // Adding more should cap at MAX_SCORE
      await (await performanceRank.increaseScore(1n, 500, "over max")).wait();
      expect(await performanceRank.intelligenceScore(1n)).to.equal(10000n);
    });

    it("score decrease does not underflow (floors at 0)", async function () {
      const { performanceRank } = await deployFixture();

      await (await performanceRank.increaseScore(1n, 10, "start")).wait();
      await (await performanceRank.decreaseScore(1n, 100, "big penalty")).wait();
      expect(await performanceRank.intelligenceScore(1n)).to.equal(0n);
    });

    it("untrusted caller cannot modify scores", async function () {
      const { performanceRank, outsider } = await deployFixture();

      await expect(
        performanceRank.connect(outsider).increaseScore(1n, 10, "hack")
      ).to.be.revertedWith("not authorized");

      await expect(
        performanceRank.connect(outsider).decreaseScore(1n, 10, "hack")
      ).to.be.revertedWith("not authorized");
    });

    it("trusted executor can modify scores", async function () {
      const { performanceRank, outsider } = await deployFixture();

      await (await performanceRank.setTrustedExecutor(outsider.address, true)).wait();
      await (await performanceRank.connect(outsider).increaseScore(1n, 25, "trusted")).wait();
      expect(await performanceRank.intelligenceScore(1n)).to.equal(25n);

      // Revoke trust
      await (await performanceRank.setTrustedExecutor(outsider.address, false)).wait();
      await expect(
        performanceRank.connect(outsider).increaseScore(1n, 10, "no longer trusted")
      ).to.be.revertedWith("not authorized");
    });
  });

  // ============================================================
  //  6. PAUSE / UNPAUSE BEHAVIOR
  // ============================================================
  describe("Pausability", function () {
    it("AgentJobMarket — pausing blocks job creation, funding, submission", async function () {
      const { agentNFT, jobMarket, paymentToken, client, evaluator, provider, deployer } = await deployFixture();
      const { agentId } = await mintAgent(agentNFT, provider, "PauseTest", "quant");

      // Pause the job market
      await (await jobMarket.connect(deployer).pause()).wait();

      const budget = ethers.parseUnits("100", 18);
      const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 3600);

      await expect(
        jobMarket.connect(client).createAgentJob(agentId, evaluator.address, budget, expiry, "Task")
      ).to.be.revertedWith("Pausable: paused");

      // Unpause
      await (await jobMarket.connect(deployer).unpause()).wait();

      // Should work now
      await (await jobMarket.connect(client).createAgentJob(agentId, evaluator.address, budget, expiry, "Task")).wait();
      const job = await jobMarket.jobs(1n);
      expect(job.status).to.equal(0n); // Open
    });

    it("AgentSkillManager — pausing blocks equip/unequip", async function () {
      const { agentNFT, skillNFT, skillManager, performanceRank, provider, deployer } = await deployFixture();
      const { agentId } = await mintAgent(agentNFT, provider, "PauseSkill", "ops");

      const skillId = await defineSkill(skillNFT, provider, "TestSkill", "quant", "quant_ops", "# test");
      await (await skillNFT.connect(provider).setApprovalForAll(await skillManager.getAddress(), true)).wait();

      // Pause
      await (await skillManager.connect(deployer).pause()).wait();

      await expect(
        skillManager.connect(provider).equipSkill(agentId, skillId, 1)
      ).to.be.revertedWith("Pausable: paused");

      // Unpause and equip
      await (await skillManager.connect(deployer).unpause()).wait();
      await (await skillManager.connect(provider).equipSkill(agentId, skillId, 1)).wait();
      expect(await skillManager.equippedSkillCount(agentId)).to.equal(1n);
    });

    it("only owner can pause/unpause", async function () {
      const { jobMarket, outsider } = await deployFixture();

      await expect(jobMarket.connect(outsider).pause()).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(jobMarket.connect(outsider).unpause()).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  // ============================================================
  //  7. EDGE CASES
  // ============================================================
  describe("Edge Cases", function () {
    it("cannot create a job with zero budget", async function () {
      const { agentNFT, jobMarket, client, evaluator, provider } = await deployFixture();
      const { agentId } = await mintAgent(agentNFT, provider, "EdgeAgent", "quant");

      const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 3600);
      await expect(
        jobMarket.connect(client).createAgentJob(agentId, evaluator.address, 0, expiry, "Free work")
      ).to.be.revertedWith("budget zero");
    });

    it("cannot create a job with past expiry", async function () {
      const { agentNFT, jobMarket, client, evaluator, provider } = await deployFixture();
      const { agentId } = await mintAgent(agentNFT, provider, "EdgeAgent", "quant");

      await expect(
        jobMarket.connect(client).createAgentJob(agentId, evaluator.address, 100, 1n, "Expired")
      ).to.be.revertedWith("invalid expiry");
    });

    it("evaluator cannot be the same as client", async function () {
      const { agentNFT, jobMarket, client, provider } = await deployFixture();
      const { agentId } = await mintAgent(agentNFT, provider, "EdgeAgent", "quant");

      const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 3600);
      await expect(
        jobMarket.connect(client).createAgentJob(agentId, client.address, 100, expiry, "Self eval")
      ).to.be.revertedWith("evaluator cannot be client");
    });

    it("cannot submit an empty deliverable", async function () {
      const { agentNFT, jobMarket, paymentToken, client, evaluator, provider } = await deployFixture();
      const { agentId } = await mintAgent(agentNFT, provider, "EdgeAgent", "quant");

      const budget = ethers.parseUnits("100", 18);
      const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 3600);
      await (await paymentToken.connect(client).approve(await jobMarket.getAddress(), budget)).wait();
      await (await jobMarket.connect(client).createAgentJob(agentId, evaluator.address, budget, expiry, "Task")).wait();
      await (await jobMarket.connect(client).fund(1n, budget)).wait();

      await expect(jobMarket.connect(provider).submit(1n, "")).to.be.revertedWith("empty deliverable");
    });

    it("cannot fund a job with mismatched budget", async function () {
      const { agentNFT, jobMarket, paymentToken, client, evaluator, provider } = await deployFixture();
      const { agentId } = await mintAgent(agentNFT, provider, "EdgeAgent", "quant");

      const budget = ethers.parseUnits("100", 18);
      const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 3600);
      await (await paymentToken.connect(client).approve(await jobMarket.getAddress(), budget)).wait();
      await (await jobMarket.connect(client).createAgentJob(agentId, evaluator.address, budget, expiry, "Task")).wait();

      // Try to fund with wrong amount
      await expect(
        jobMarket.connect(client).fund(1n, ethers.parseUnits("999", 18))
      ).to.be.revertedWith("budget mismatch");
    });

    it("re-equipping the same skill increases balance without using a new slot", async function () {
      const { agentNFT, skillNFT, skillManager, provider } = await deployFixture();
      const { agentId, tba } = await mintAgent(agentNFT, provider, "ReEquip", "ops");

      // Mint 3 copies of the same skill
      const skillId = await defineSkill(skillNFT, provider, "Multi", "quant", "quant_ops", "# multi", 3n);
      await (await skillNFT.connect(provider).setApprovalForAll(await skillManager.getAddress(), true)).wait();

      // Equip 1
      await (await skillManager.connect(provider).equipSkill(agentId, skillId, 1)).wait();
      expect(await skillManager.equippedSkillCount(agentId)).to.equal(1n);
      expect(await skillNFT.balanceOf(tba, skillId)).to.equal(1n);

      // Equip 1 more of the same skill — should NOT count as new slot
      await (await skillManager.connect(provider).equipSkill(agentId, skillId, 1)).wait();
      expect(await skillManager.equippedSkillCount(agentId)).to.equal(1n); // Still 1 skill type
      expect(await skillNFT.balanceOf(tba, skillId)).to.equal(2n); // But 2 copies
    });

    it("WorkerTokenFactory allows public callers", async function () {
      const { tokenFactory, outsider } = await deployFixture();

      const tx = await tokenFactory
        .connect(outsider)
        .deployToken("Public", "PUB", ethers.parseUnits("1000", 18), outsider.address);
      const receipt = await tx.wait();

      const event = receipt.logs.find((log) => log.fragment?.name === "WorkerTokenDeployed");
      expect(event).to.not.equal(undefined);
      expect(event.args.owner).to.equal(outsider.address);
    });

    it("rejects duplicate credited agents in swarm jobs", async function () {
      const { agentNFT, swarmNFT, jobMarket, client, evaluator, provider, deployer } = await deployFixture();
      const worker = await mintAgent(agentNFT, deployer, "DuplicateWorker", "ops");
      const swarm = await mintSwarm(swarmNFT, provider, "Credits Swarm");

      await (await agentNFT.connect(deployer).transferFrom(deployer.address, swarm.tba, worker.agentId)).wait();

      const budget = ethers.parseUnits("100", 18);
      const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp + 3600);

      await expect(
        jobMarket.connect(client).createSwarmJob(
          swarm.swarmId,
          evaluator.address,
          budget,
          expiry,
          "Duplicate credit attempt",
          [worker.agentId, worker.agentId]
        )
      ).to.be.revertedWith("duplicate credited agent");
    });
  });

  // ============================================================
  //  8. SKILL-GATED EXECUTION — End-to-End
  //     Agent with equipped skill → execute transaction via hub
  // ============================================================
  describe("Skill-Gated Execution — End-to-End", function () {
    it("equipped deployer agent can deploy a token via execution hub", async function () {
      const {
        agentNFT, skillNFT, skillManager, executionHub,
        tokenFactory, performanceRank, deployer
      } = await deployFixture();

      // 1. Mint a master orchestrator
      const master = await mintAgent(agentNFT, deployer, "Orchestrator", "orchestrator");

      // 2. Mint a deployer worker
      const worker = await mintAgent(agentNFT, deployer, "Deployer", "deployer");

      // 3. Define and equip a "deployer" skill on the worker
      const deployerSkillId = await defineSkill(
        skillNFT, deployer,
        "Token Deployer", "deployer", "deployer",
        "# Token Deployer\n\nCapability: deployer\n\n- Deploys BEP-20 tokens"
      );
      await (await skillNFT.connect(deployer).setApprovalForAll(await skillManager.getAddress(), true)).wait();
      await (await skillManager.connect(deployer).equipSkill(worker.agentId, deployerSkillId, 1)).wait();

      // Verify skill is equipped
      expect(await skillManager.hasCapability(worker.agentId, "deployer")).to.be.true;

      // 4. Transfer worker into master's TBA
      await (await agentNFT.connect(deployer).transferFrom(deployer.address, master.tba, worker.agentId)).wait();

      // 5. Authorize factory for worker TBA
      await (await tokenFactory.setTrustedCaller(worker.tba, true)).wait();

      // 5b. Authorize the execution hub on the master TBA
      await authorizeTbaExecutor(master.tba, await executionHub.getAddress(), deployer);

      // 6. Execute: master delegates worker to deploy a token
      const factoryIface = new ethers.Interface([
        "function deployToken(string name, string symbol, uint256 supply, address tokenOwner) returns (address)"
      ]);
      const callData = factoryIface.encodeFunctionData("deployToken", [
        "SkillDeployedToken", "SDT", ethers.parseUnits("5000000", 18), worker.tba
      ]);

      const tx = await executionHub.connect(deployer).executeWorkerAction(
        master.agentId, master.tba, worker.agentId, worker.tba,
        await tokenFactory.getAddress(), 0, callData
      );
      const receipt = await tx.wait();

      // 7. Verify token was deployed
      const factoryEvent = new ethers.Interface([
        "event WorkerTokenDeployed(address indexed token, address indexed owner, string name, string symbol, uint256 supply)"
      ]);
      let tokenAddress = null;
      for (const log of receipt.logs) {
        try {
          const parsed = factoryEvent.parseLog(log);
          if (parsed) { tokenAddress = parsed.args.token; break; }
        } catch {}
      }
      expect(tokenAddress).to.not.be.null;

      // 8. Verify the token has correct supply
      const WorkerToken = await ethers.getContractFactory("WorkerToken");
      const token = WorkerToken.attach(tokenAddress);
      expect(await token.totalSupply()).to.equal(ethers.parseUnits("5000000", 18));
      expect(await token.balanceOf(worker.tba)).to.equal(ethers.parseUnits("5000000", 18));

      // 9. Verify performance scores were updated
      expect(await performanceRank.intelligenceScore(worker.agentId)).to.equal(0n);
      expect(await performanceRank.intelligenceScore(master.agentId)).to.equal(0n);

      // 10. Verify the deployed skill is still equipped (skill lives in TBA)
      const workerTba = worker.tba;
      expect(await skillNFT.balanceOf(workerTba, deployerSkillId)).to.equal(1n);
    });

    it("equipped meme swarm can perform a full scan-concept-deploy loop on-chain", async function () {
      const {
        agentNFT, swarmNFT, skillNFT, skillManager,
        executionHub, tokenFactory, performanceRank, deployer
      } = await deployFixture();

      // 1. Define meme-loop skills
      const scoutSkillId = await defineSkill(skillNFT, deployer, "Alpha Scout", "alpha_scout", "alpha_scout", "# Scout");
      const creatorSkillId = await defineSkill(skillNFT, deployer, "Meme Creator", "meme_creator", "meme_creator", "# Creator");
      const deployerSkillId = await defineSkill(skillNFT, deployer, "Token Deployer", "deployer", "deployer", "# Deployer");

      // 2. Mint 3 worker agents
      const scout = await mintAgent(agentNFT, deployer, "Scout", "alpha_scout");
      const creator = await mintAgent(agentNFT, deployer, "Creative", "meme_creator");
      const launcher = await mintAgent(agentNFT, deployer, "Launcher", "deployer");

      // 3. Equip each with its skill
      await (await skillNFT.connect(deployer).setApprovalForAll(await skillManager.getAddress(), true)).wait();
      await (await skillManager.connect(deployer).equipSkill(scout.agentId, scoutSkillId, 1)).wait();
      await (await skillManager.connect(deployer).equipSkill(creator.agentId, creatorSkillId, 1)).wait();
      await (await skillManager.connect(deployer).equipSkill(launcher.agentId, deployerSkillId, 1)).wait();

      // Verify capabilities
      expect(await skillManager.hasCapability(scout.agentId, "alpha_scout")).to.be.true;
      expect(await skillManager.hasCapability(creator.agentId, "meme_creator")).to.be.true;
      expect(await skillManager.hasCapability(launcher.agentId, "deployer")).to.be.true;

      // 4. Mint swarm and transfer all workers into it
      const swarm = await mintSwarm(swarmNFT, deployer, "Meme Launch Swarm");
      await (await agentNFT.connect(deployer).transferFrom(deployer.address, swarm.tba, scout.agentId)).wait();
      await (await agentNFT.connect(deployer).transferFrom(deployer.address, swarm.tba, creator.agentId)).wait();
      await (await agentNFT.connect(deployer).transferFrom(deployer.address, swarm.tba, launcher.agentId)).wait();

      // Verify all workers are owned by the swarm TBA
      expect(await agentNFT.ownerOf(scout.agentId)).to.equal(swarm.tba);
      expect(await agentNFT.ownerOf(creator.agentId)).to.equal(swarm.tba);
      expect(await agentNFT.ownerOf(launcher.agentId)).to.equal(swarm.tba);

      // 5. Authorize factory for launcher TBA
      await (await tokenFactory.setTrustedCaller(launcher.tba, true)).wait();

      // 5b. Authorize execution hub on the swarm TBA
      await authorizeTbaExecutor(swarm.tba, await executionHub.getAddress(), deployer);

      // 6. Swarm owner instructs the Launcher worker to deploy a meme token
      const factoryIface = new ethers.Interface([
        "function deployToken(string name, string symbol, uint256 supply, address tokenOwner) returns (address)"
      ]);
      const deployCall = factoryIface.encodeFunctionData("deployToken", [
        "PepeVault", "PVLT", ethers.parseUnits("1000000000", 18), launcher.tba
      ]);

      const tx = await executionHub.connect(deployer).executeSwarmWorkerAction(
        swarm.swarmId, swarm.tba, launcher.agentId, launcher.tba,
        await tokenFactory.getAddress(), 0, deployCall
      );
      const receipt = await tx.wait();

      // 7. Verify token was deployed
      const factoryEvent = new ethers.Interface([
        "event WorkerTokenDeployed(address indexed token, address indexed owner, string name, string symbol, uint256 supply)"
      ]);
      let tokenAddress = null;
      for (const log of receipt.logs) {
        try {
          const parsed = factoryEvent.parseLog(log);
          if (parsed) { tokenAddress = parsed.args.token; break; }
        } catch {}
      }
      expect(tokenAddress).to.not.be.null;

      const WorkerToken = await ethers.getContractFactory("WorkerToken");
      const memeToken = WorkerToken.attach(tokenAddress);
      expect(await memeToken.symbol()).to.equal("PVLT");
      expect(await memeToken.totalSupply()).to.equal(ethers.parseUnits("1000000000", 18));
      expect(await memeToken.balanceOf(launcher.tba)).to.equal(ethers.parseUnits("1000000000", 18));

      // 8. Launcher worker got a performance boost
      expect(await performanceRank.intelligenceScore(launcher.agentId)).to.equal(0n);
    });
  });

  // ============================================================
  //  9. ON-CHAIN METADATA VERIFICATION
  // ============================================================
  describe("On-chain Metadata", function () {
    it("AgentNFT produces valid base64 tokenURI with score/level/slots", async function () {
      const { agentNFT, performanceRank, provider } = await deployFixture();
      const { agentId } = await mintAgent(agentNFT, provider, "MetaAgent", "quant");

      // Boost score to get higher level
      await (await performanceRank.increaseScore(agentId, 50, "level up")).wait();

      const uri = await agentNFT.tokenURI(agentId);
      expect(uri).to.match(/^data:application\/json;base64,/);

      const jsonStr = Buffer.from(uri.split(",")[1], "base64").toString("utf8");
      const metadata = JSON.parse(jsonStr);

      expect(metadata.name).to.include("MetaAgent");
      expect(metadata.attributes).to.be.an("array");

      const score = metadata.attributes.find(a => a.trait_type === "Intelligence Score");
      expect(score.value).to.equal("50");

      const level = metadata.attributes.find(a => a.trait_type === "Level");
      expect(level.value).to.equal("6"); // 1 + (50 / 10) = 6

      const slots = metadata.attributes.find(a => a.trait_type === "Skill Slots");
      expect(slots.value).to.equal("1"); // 1 + ((6-1) / 10) = 1

      // SVG is valid
      const svgB64 = metadata.image.split(",")[1];
      const svg = Buffer.from(svgB64, "base64").toString("utf8");
      expect(svg).to.include("<svg");
      expect(svg).to.include("MetaAgent");
    });

    it("SkillNFT produces valid URI with capability and embedded markdown", async function () {
      const { skillNFT, deployer } = await deployFixture();

      const skillId = await defineSkill(
        skillNFT, deployer,
        "Test Skill", "quant", "quant_ops",
        "# Quant Skill\n\n- Capability: quant_ops\n- Does math"
      );

      const uri = await skillNFT.uri(skillId);
      expect(uri).to.match(/^data:application\/json;base64,/);

      const metadata = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf8"));
      expect(metadata.name).to.include("Test Skill");

      const capAttr = metadata.attributes.find(a => a.trait_type === "Capability");
      expect(capAttr.value).to.equal("quant_ops");

      // Skill markdown is embedded as base64
      const md = Buffer.from(metadata.skill_md_b64, "base64").toString("utf8");
      expect(md).to.include("Quant Skill");
      expect(md).to.include("quant_ops");
    });

    it("metadata escaping preserves valid JSON for quotes, slashes, and newlines", async function () {
      const { agentNFT, skillNFT, deployer, provider } = await deployFixture();

      const trickyName = 'Meta "Agent" \\\\ Alpha';
      const trickyRole = "creative\ncontent";
      const trickyDescription = "Line 1\nLine 2 with \\ slash and \"quotes\"";
      const { agentId } = await mintAgent(agentNFT, provider, trickyName, trickyRole);

      await (await agentNFT.mintAgent(
        provider.address,
        trickyName,
        trickyRole,
        trickyDescription,
        ethers.keccak256(ethers.toUtf8Bytes(`escaped-${Date.now()}`))
      )).wait();

      const escapedAgentId = (await agentNFT.nextTokenId()) - 1n;
      const agentUri = await agentNFT.tokenURI(escapedAgentId);
      const agentMetadata = JSON.parse(Buffer.from(agentUri.split(",")[1], "base64").toString("utf8"));
      expect(agentMetadata.name).to.include(trickyName);
      expect(agentMetadata.description).to.equal(trickyDescription);

      const svg = Buffer.from(agentMetadata.image.split(",")[1], "base64").toString("utf8");
      expect(svg).to.include("&quot;");

      const skillId = await defineSkill(
        skillNFT,
        deployer,
        'Skill "Builder"',
        "ops\\flow",
        "ops_flow",
        "# Title\n\nLine with \"quotes\" and \\ slash"
      );
      const skillUri = await skillNFT.uri(skillId);
      const skillMetadata = JSON.parse(Buffer.from(skillUri.split(",")[1], "base64").toString("utf8"));
      expect(skillMetadata.name).to.include('Skill "Builder"');
      expect(skillMetadata.description).to.equal('Skill "Builder" desc');
    });
  });
});
