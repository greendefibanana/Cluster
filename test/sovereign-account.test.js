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

  it("enforces revocable agent permissions, adapter allowlists, receivers, and risk limits", async function () {
    const { user, agent, outsider, token, account, mantleYield, ethereumYield } = await deployFixture();
    const amount = ethers.parseUnits("500", 18);
    await (await token.connect(user).approve(await account.getAddress(), amount)).wait();
    await (await account.connect(user).deposit(await token.getAddress(), amount)).wait();

    const goodData = adapterCall(mantleYield, 5000, await token.getAddress(), ethers.parseUnits("100", 18), await account.getAddress(), 50, ethers.id("lp_opened"));
    await expect(account.connect(agent).execute(await mantleYield.getAddress(), goodData)).to.be.revertedWith("not approved");

    await (await account.connect(user).approveAgent(agent.address)).wait();
    await expect(account.connect(agent).execute(await mantleYield.getAddress(), goodData)).to.emit(account, "SovereignExecution");

    const badReceiver = adapterCall(mantleYield, 5000, await token.getAddress(), ethers.parseUnits("10", 18), outsider.address, 50, ethers.id("steal"));
    await expect(account.connect(agent).execute(await mantleYield.getAddress(), badReceiver)).to.be.revertedWith("unauthorized receiver");

    await expect(account.connect(agent).execute(await ethereumYield.getAddress(), goodData)).to.be.revertedWith("adapter not allowed");

    const tooLarge = adapterCall(mantleYield, 5000, await token.getAddress(), ethers.parseUnits("2000", 18), await account.getAddress(), 50, ethers.id("too_large"));
    await expect(account.connect(agent).execute(await mantleYield.getAddress(), tooLarge)).to.be.revertedWith("allocation exceeded");

    await (await account.connect(user).revokeAgent(agent.address)).wait();
    await expect(account.connect(agent).execute(await mantleYield.getAddress(), goodData)).to.be.revertedWith("not approved");
  });

  it("limits temporary session execution rights by adapter, chain, and quota", async function () {
    const { user, sessionExecutor, token, account, mantleYield } = await deployFixture();
    const amount = ethers.parseUnits("500", 18);
    await (await token.connect(user).approve(await account.getAddress(), amount)).wait();
    await (await account.connect(user).deposit(await token.getAddress(), amount)).wait();
    const sessionKey = ethers.id("session-key-1");
    await (await account.connect(user).grantSessionKey(sessionKey, sessionExecutor.address, await mantleYield.getAddress(), 5000, 3600, 1)).wait();

    const data = adapterCall(mantleYield, 5000, await token.getAddress(), ethers.parseUnits("50", 18), await account.getAddress(), 50, ethers.id("session_execute"));
    await expect(account.connect(sessionExecutor).executeWithSession(await mantleYield.getAddress(), data, sessionKey)).to.emit(account, "SovereignExecution");
    await expect(account.connect(sessionExecutor).executeWithSession(await mantleYield.getAddress(), data, sessionKey)).to.be.revertedWith("not approved");
  });

  it("creates and validates cross-chain intents from the Sovereign Account", async function () {
    const { deployer, user, agent, token, account, intentEngine, mantleYield } = await deployFixture();
    const amount = ethers.parseUnits("500", 18);
    await (await token.connect(user).approve(await account.getAddress(), amount)).wait();
    await (await account.connect(user).deposit(await token.getAddress(), amount)).wait();
    await (await account.connect(user).approveAgent(agent.address)).wait();
    await (await intentEngine.setExecutor(deployer.address, true)).wait();

    const tx = await account.connect(agent).openCrossChainIntent(
      await intentEngine.getAddress(),
      1,
      await token.getAddress(),
      ethers.parseUnits("100", 18),
      ethers.id("eth-yield"),
      await mantleYield.getAddress(),
      ethers.id("moderate-risk"),
      "0g://proof/intent",
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
    const intent = await intentEngine.intents(intentId);
    expect(intent.intentStatus).to.equal(1n);
    expect(intent.proofURI).to.equal("0g://proof/executed");
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
