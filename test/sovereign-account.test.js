import { expect } from "chai";
import hre from "hardhat";
import { MockZeroGProvider } from "../gateway/zeroGProvider.js";
import { MockBridgeAdapter as JsMockBridgeAdapter } from "../gateway/crosschain/bridgeAdapters.js";
import { CrossChainIntentEngineService } from "../gateway/crosschain/intentEngine.js";

const { ethers } = hre;

describe("Mantle-native Sovereign Account layer", function () {
  async function deployFixture() {
    const [deployer, user, agent, cluster, sessionExecutor, outsider] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockPaymentToken");
    const token = await Token.deploy(user.address, ethers.parseUnits("100000", 18));
    await token.waitForDeployment();

    const Registry = await ethers.getContractFactory("SovereignAccountRegistry");
    const registry = await Registry.deploy(deployer.address);
    await registry.waitForDeployment();

    const Factory = await ethers.getContractFactory("SovereignAccountFactory");
    const factory = await Factory.deploy(deployer.address, await registry.getAddress());
    await factory.waitForDeployment();
    await (await registry.setTrustedFactory(await factory.getAddress(), true)).wait();

    const Intent = await ethers.getContractFactory("CrossChainIntentEngine");
    const intentEngine = await Intent.deploy(deployer.address, await registry.getAddress());
    await intentEngine.waitForDeployment();

    const MantleYield = await ethers.getContractFactory("MantleYieldAdapter");
    const mantleYield = await MantleYield.deploy();
    await mantleYield.waitForDeployment();

    const EthereumYield = await ethers.getContractFactory("EthereumYieldAdapter");
    const ethereumYield = await EthereumYield.deploy();
    await ethereumYield.waitForDeployment();

    const MockBridge = await ethers.getContractFactory("MockBridgeAdapter");
    const bridge = await MockBridge.deploy([5000, 5003, 1, 42161, 7565164]);
    await bridge.waitForDeployment();

    const accountAddress = await factory.predictSovereignAccount(user.address, "Primary", "moderate");
    await (await factory.connect(user).createSovereignAccount(user.address, "Primary", {
      maxAllocation: ethers.parseUnits("1000", 18),
      maxSlippageBps: 100,
      riskProfile: "moderate",
      approvedAdapters: [await mantleYield.getAddress()],
      chainIds: [5000, 1, 42161, 7565164],
    })).wait();
    const account = await ethers.getContractAt("SovereignAccount", accountAddress);

    return { deployer, user, agent, cluster, sessionExecutor, outsider, token, registry, factory, intentEngine, mantleYield, ethereumYield, bridge, account };
  }

  function adapterCall(adapter, targetChainId, asset, amount, receiver, slippageBps, action) {
    const payload = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "uint256", "address", "uint256", "bytes32"],
      [targetChainId, asset, amount, receiver, slippageBps, action],
    );
    return adapter.interface.encodeFunctionData("execute", [payload]);
  }

  async function policyProof(account, signer, executor, adapter, data, label = "strategy") {
    const block = await ethers.provider.getBlock("latest");
    const strategyId = ethers.id(label);
    const policyDecisionHash = ethers.id(`${label}:policy-approved`);
    const proofURI = `0g-local://policy/${label}`;
    const expiresAt = BigInt(block.timestamp + 3600);
    const digest = await account.policyApprovalDigest(
      executor.address || executor,
      adapter,
      data,
      strategyId,
      policyDecisionHash,
      proofURI,
      expiresAt,
    );
    const signature = await signer.signMessage(ethers.getBytes(digest));
    return { strategyId, policyDecisionHash, proofURI, expiresAt, signature };
  }

  async function intentPolicyProof(account, signer, executor, adapter, intent, label = "intent") {
    const data = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "address", "uint256", "bytes32", "address", "bytes32", "string"],
      [intent.intentEngine, intent.targetChainId, intent.asset, intent.amount, intent.strategyType, adapter, intent.riskConstraints, intent.proofURI],
    );
    return policyProof(account, signer, executor, adapter, data, label);
  }

  it("creates a user-owned Sovereign Account and registers ownership", async function () {
    const { user, registry, account } = await deployFixture();
    expect(await account.owner()).to.equal(user.address);
    expect(await registry.isSovereignAccount(await account.getAddress())).to.equal(true);
    expect(await registry.accountsByOwner(user.address)).to.deep.equal([await account.getAddress()]);
  });

  it("allows owner deposits and blocks agent withdrawals", async function () {
    const { user, agent, token, account } = await deployFixture();
    const amount = ethers.parseUnits("500", 18);
    await (await token.connect(user).approve(await account.getAddress(), amount)).wait();
    await expect(account.connect(user).deposit(await token.getAddress(), amount)).to.emit(account, "SovereignDeposited");

    await expect(account.connect(agent).withdraw(await token.getAddress(), 1n)).to.be.revertedWith("not owner");
  });

  it("allows native MNT-style deposits, withdrawals, and emergency exits", async function () {
    const { user, agent, account } = await deployFixture();
    const amount = ethers.parseEther("1.5");
    const accountAddress = await account.getAddress();

    await expect(account.connect(agent).depositNative({ value: amount })).to.be.revertedWith("not owner");
    await expect(account.connect(user).depositNative({ value: amount }))
      .to.emit(account, "SovereignDeposited")
      .withArgs(ethers.ZeroAddress, amount);
    expect(await account.balances(ethers.ZeroAddress)).to.equal(amount);
    expect(await ethers.provider.getBalance(accountAddress)).to.equal(amount);

    const withdrawAmount = ethers.parseEther("0.4");
    await expect(account.connect(agent).withdraw(ethers.ZeroAddress, withdrawAmount)).to.be.revertedWith("not owner");
    await expect(account.connect(user).withdraw(ethers.ZeroAddress, withdrawAmount))
      .to.emit(account, "SovereignWithdrawn")
      .withArgs(ethers.ZeroAddress, withdrawAmount, user.address);
    expect(await account.balances(ethers.ZeroAddress)).to.equal(amount - withdrawAmount);

    await expect(account.connect(user).emergencyExit(ethers.ZeroAddress))
      .to.emit(account, "EmergencyExit")
      .withArgs(ethers.ZeroAddress, amount - withdrawAmount, user.address);
    expect(await account.balances(ethers.ZeroAddress)).to.equal(0n);
    expect(await ethers.provider.getBalance(accountAddress)).to.equal(0n);
  });

  it("rotates the default policy validator when account ownership transfers", async function () {
    const { user, outsider, account } = await deployFixture();
    expect(await account.policyValidator()).to.equal(user.address);
    await expect(account.connect(user).transferOwnership(outsider.address))
      .to.emit(account, "PolicyValidatorSet")
      .withArgs(user.address, outsider.address);
    expect(await account.owner()).to.equal(outsider.address);
    expect(await account.policyValidator()).to.equal(outsider.address);
  });

  it("enforces revocable agent permissions, adapter allowlists, receivers, and risk limits", async function () {
    const { user, agent, outsider, token, account, mantleYield, ethereumYield } = await deployFixture();
    const amount = ethers.parseUnits("500", 18);
    await (await token.connect(user).approve(await account.getAddress(), amount)).wait();
    await (await account.connect(user).deposit(await token.getAddress(), amount)).wait();

    const goodData = adapterCall(mantleYield, 5000, await token.getAddress(), ethers.parseUnits("100", 18), await account.getAddress(), 50, ethers.id("lp_opened"));
    await expect(account.connect(agent).execute(await mantleYield.getAddress(), goodData)).to.be.revertedWith("not approved");

    await (await account.connect(user).approveAgent(agent.address)).wait();
    await expect(account.connect(agent).execute(await mantleYield.getAddress(), goodData)).to.be.revertedWith("not approved");
    const goodProof = await policyProof(account, user, agent, await mantleYield.getAddress(), goodData, "lp-opened");
    await expect(account.connect(agent).executeWithProof(await mantleYield.getAddress(), goodData, goodProof))
      .to.emit(account, "PolicyProofConsumed")
      .and.to.emit(account, "SovereignExecution");
    await expect(account.connect(agent).executeWithProof(await mantleYield.getAddress(), goodData, goodProof)).to.be.revertedWith("policy already used");

    const badReceiver = adapterCall(mantleYield, 5000, await token.getAddress(), ethers.parseUnits("10", 18), outsider.address, 50, ethers.id("steal"));
    const badReceiverProof = await policyProof(account, user, agent, await mantleYield.getAddress(), badReceiver, "bad-receiver");
    await expect(account.connect(agent).executeWithProof(await mantleYield.getAddress(), badReceiver, badReceiverProof)).to.be.revertedWith("unauthorized receiver");

    const badAdapterProof = await policyProof(account, user, agent, await ethereumYield.getAddress(), goodData, "bad-adapter");
    await expect(account.connect(agent).executeWithProof(await ethereumYield.getAddress(), goodData, badAdapterProof)).to.be.revertedWith("adapter not allowed");

    const tooLarge = adapterCall(mantleYield, 5000, await token.getAddress(), ethers.parseUnits("2000", 18), await account.getAddress(), 50, ethers.id("too_large"));
    const tooLargeProof = await policyProof(account, user, agent, await mantleYield.getAddress(), tooLarge, "too-large");
    await expect(account.connect(agent).executeWithProof(await mantleYield.getAddress(), tooLarge, tooLargeProof)).to.be.revertedWith("allocation exceeded");

    await (await account.connect(user).revokeAgent(agent.address)).wait();
    const revokedProof = await policyProof(account, user, agent, await mantleYield.getAddress(), goodData, "revoked");
    await expect(account.connect(agent).executeWithProof(await mantleYield.getAddress(), goodData, revokedProof)).to.be.revertedWith("not approved");
  });

  it("limits temporary session execution rights by adapter, chain, and quota", async function () {
    const { user, sessionExecutor, token, account, mantleYield } = await deployFixture();
    const amount = ethers.parseUnits("500", 18);
    await (await token.connect(user).approve(await account.getAddress(), amount)).wait();
    await (await account.connect(user).deposit(await token.getAddress(), amount)).wait();
    const sessionKey = ethers.id("session-key-1");
    await (await account.connect(user).grantSessionKey(sessionKey, sessionExecutor.address, await mantleYield.getAddress(), 5000, 3600, 1)).wait();

    const data = adapterCall(mantleYield, 5000, await token.getAddress(), ethers.parseUnits("50", 18), await account.getAddress(), 50, ethers.id("session_execute"));
    await expect(account.connect(sessionExecutor).executeWithSession(await mantleYield.getAddress(), data, sessionKey)).to.be.revertedWith("not approved");
    const firstProof = await policyProof(account, user, sessionExecutor, await mantleYield.getAddress(), data, "session-execute");
    await expect(account.connect(sessionExecutor).executeWithSessionProof(await mantleYield.getAddress(), data, sessionKey, firstProof)).to.emit(account, "SovereignExecution");
    const secondProof = await policyProof(account, user, sessionExecutor, await mantleYield.getAddress(), data, "session-execute-replay");
    await expect(account.connect(sessionExecutor).executeWithSessionProof(await mantleYield.getAddress(), data, sessionKey, secondProof)).to.be.revertedWith("not approved");
  });

  it("creates and validates cross-chain intents from the Sovereign Account", async function () {
    const { deployer, user, agent, token, account, intentEngine, mantleYield } = await deployFixture();
    const amount = ethers.parseUnits("500", 18);
    await (await token.connect(user).approve(await account.getAddress(), amount)).wait();
    await (await account.connect(user).deposit(await token.getAddress(), amount)).wait();
    await (await account.connect(user).approveAgent(agent.address)).wait();
    await (await intentEngine.setExecutor(deployer.address, true)).wait();

    const intent = {
      intentEngine: await intentEngine.getAddress(),
      targetChainId: 1,
      asset: await token.getAddress(),
      amount: ethers.parseUnits("100", 18),
      strategyType: ethers.id("eth-yield"),
      riskConstraints: ethers.id("moderate-risk"),
      proofURI: "0g://proof/intent",
    };
    await expect(account.connect(agent).openCrossChainIntent(
      intent.intentEngine,
      intent.targetChainId,
      intent.asset,
      intent.amount,
      intent.strategyType,
      await mantleYield.getAddress(),
      intent.riskConstraints,
      intent.proofURI,
    )).to.be.revertedWith("policy proof required");
    const intentProof = await intentPolicyProof(account, user, agent, await mantleYield.getAddress(), intent, "cross-chain-intent");
    const tx = await account.connect(agent).openCrossChainIntentWithProof(
      intent.intentEngine,
      intent.targetChainId,
      intent.asset,
      intent.amount,
      intent.strategyType,
      await mantleYield.getAddress(),
      intent.riskConstraints,
      intent.proofURI,
      intentProof,
    );
    const receipt = await tx.wait();
    const event = receipt.logs.map((log) => {
      try {
        return account.interface.parseLog(log);
      } catch {
        return null;
      }
    }).find((parsed) => parsed?.name === "CrossChainIntentOpened");
    const intentId = event.args.intentId;

    await expect(intentEngine.markExecuted(ethers.id("missing-intent"), "0g://proof/missing", ethers.id("validation")))
      .to.be.revertedWith("unknown intent");
    await expect(intentEngine.markExecuted(intentId, "", ethers.id("validation")))
      .to.be.revertedWith("proof required");
    await expect(intentEngine.markFailed(intentId, "0g://proof/failed", ethers.ZeroHash))
      .to.be.revertedWith("validation required");

    await expect(intentEngine.markExecuted(intentId, "0g://proof/executed", ethers.id("validation")))
      .to.emit(intentEngine, "IntentStatusUpdated");
    const storedIntent = await intentEngine.intents(intentId);
    expect(storedIntent.intentStatus).to.equal(1n);
    expect(storedIntent.proofURI).to.equal("0g://proof/executed");
  });

  it("supports bridge fallback and mock 0G proof generation in the cross-chain demo service", async function () {
    const bridge = new JsMockBridgeAdapter({ supportedChains: [1] });
    const quote = await bridge.quote({ id: "intent-1", sourceChain: 5000, targetChain: 1, asset: "mUSD", amount: 100, userSovereignAccount: "sa-1" });
    expect(quote.supported).to.equal(true);

    const zeroG = new MockZeroGProvider({ namespace: "sovereign-test" });
    const service = new CrossChainIntentEngineService({ zeroGStorage: zeroG, bridge });
    const intent = await service.createIntent({
      sourceChain: 5000,
      targetChain: 1,
      asset: "mUSD",
      amount: 100,
      strategyType: "eth-yield",
      userSovereignAccount: "sa-1",
    });
    const result = await service.executeIntent(intent.id);
    expect(result.proof.uri).to.match(/^0g:\/\//);
    expect(result.socialEvent.actionType).to.equal("lp_opened");
    expect(result.reputationEvent.chainMetric).to.include("ethereum");
  });
});
