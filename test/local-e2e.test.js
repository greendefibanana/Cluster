import { expect } from "chai";
import hre from "hardhat";
import { createLocalZeroGProvider } from "../gateway/zeroG/localProvider.js";
import { deployLocalMantle, runLocalDefiE2E, runRealAiTest, seedLocalMantle } from "../scripts/local/harness.js";
import { getTopYieldOpportunities } from "../packages/intelligence/data-adapters/defillama/index.js";
import { searchPredictionMarkets } from "../packages/intelligence/data-adapters/prediction/index.js";

const { ethers } = hre;

describe("Local validator production-readiness flow", function () {
  this.timeout(180_000);
  const originalFetch = globalThis.fetch;

  afterEach(function () {
    globalThis.fetch = originalFetch;
  });

  it("deploys the Mantle-compatible contract surface on the Hardhat local validator", async function () {
    const { deployment } = await deployLocalMantle({ write: false });
    expect(deployment.contracts.agentNFT).to.match(/^0x/);
    expect(deployment.contracts.clusterNFT).to.match(/^0x/);
    expect(deployment.contracts.identityRegistry).to.match(/^0x/);
    expect(deployment.contracts.reputationRegistry).to.match(/^0x/);
    expect(deployment.contracts.validationRegistry).to.match(/^0x/);
    expect(deployment.contracts.sovereignFactory).to.match(/^0x/);
    expect(deployment.contracts.defiYieldAdapter).to.match(/^0x/);
    expect(deployment.contracts.predictionMarketAdapter).to.match(/^0x/);
  });

  it("creates a Sovereign Account, deposits token, grants and revokes permission, and blocks user-fund withdrawal by agents", async function () {
    const { contracts, signers, seeded, deployment } = await seedLocalMantle();
    const tokenAddress = await contracts.paymentToken.getAddress();
    expect(await seeded.sovereignAccount.balances(tokenAddress)).to.equal(seeded.depositAmount);

    await expect(seeded.sovereignAccount.connect(signers.agent).withdraw(tokenAddress, 1n)).to.be.revertedWith("not owner");

    await (await seeded.sovereignAccount.connect(signers.user).approveAgent(signers.agent.address)).wait();
    const amount = ethers.parseUnits("25", 18);
    const data = adapterCall(contracts.defiYieldAdapter, Number(deployment.chainId), tokenAddress, amount, seeded.sovereignAccountAddress, 25, ethers.id("permission_test"));
    await expect(seeded.sovereignAccount.connect(signers.agent).execute(await contracts.defiYieldAdapter.getAddress(), data)).to.emit(seeded.sovereignAccount, "SovereignExecution");

    await (await seeded.sovereignAccount.connect(signers.user).revokeAgent(signers.agent.address)).wait();
    await expect(seeded.sovereignAccount.connect(signers.agent).execute(await contracts.defiYieldAdapter.getAddress(), data)).to.be.revertedWith("not approved");
  });

  it("enforces adapter allowlists on the local validator", async function () {
    const { contracts, signers, seeded, deployment } = await seedLocalMantle();
    const OtherAdapter = await ethers.getContractFactory("EthereumYieldAdapter");
    const otherAdapter = await OtherAdapter.deploy();
    await otherAdapter.waitForDeployment();
    await (await seeded.sovereignAccount.connect(signers.user).approveAgent(signers.agent.address)).wait();
    const data = adapterCall(otherAdapter, Number(deployment.chainId), await contracts.paymentToken.getAddress(), ethers.parseUnits("1", 18), seeded.sovereignAccountAddress, 25, ethers.id("bad_adapter"));
    await expect(seeded.sovereignAccount.connect(signers.agent).execute(await otherAdapter.getAddress(), data)).to.be.revertedWith("adapter not allowed");
  });

  it("stores and reads proof objects through the local 0G provider without network mocks", async function () {
    const zeroG = createLocalZeroGProvider({ namespace: "local-test" });
    const proof = await zeroG.uploadValidationProof("claim-1", { ok: true, proof: "local" });
    const readback = await zeroG.readZeroGObject(proof.uri);
    expect(proof.uri).to.match(/^0g-local:\/\//);
    expect(readback.rootHash).to.equal(proof.rootHash);
    expect(readback.payload.claimId).to.equal("claim-1");
  });

  it("attaches local 0G proof URIs to validation and reputation events", async function () {
    const { contracts, signers, seeded } = await seedLocalMantle();
    const zeroG = createLocalZeroGProvider({ namespace: "validation-local-test" });
    const proof = await zeroG.uploadValidationProof("claim-local", { agentId: seeded.agentId.toString() });
    const claimHash = ethers.keccak256(ethers.toUtf8Bytes(proof.uri));
    const strategyId = ethers.id("local-validation");
    await expect(contracts.validationRegistry.submitClaim(claimHash, 0, seeded.agentId, strategyId, "local-validation", proof.uri, signers.validator.address))
      .to.emit(contracts.validationRegistry, "ClaimSubmitted");
    await expect(contracts.reputationRegistry.recordEvent(0, seeded.agentId, strategyId, "local-proof-attached", 1, 0, 0, proof.uri))
      .to.emit(contracts.reputationRegistry, "ReputationRecorded");
    const claim = await contracts.validationRegistry.getClaim(claimHash);
    const event = await contracts.reputationRegistry["getEvent(uint256)"](0);
    expect(claim.proofURI).to.equal(proof.uri);
    expect(event.proofURI).to.equal(proof.uri);
  });

  it("runs a full local e2e happy path on Hardhat and local 0G", async function () {
    const previous = process.env.TEST_MODE;
    process.env.TEST_MODE = "MOCK_ONLY";
    const result = await runLocalDefiE2E({ mode: "MOCK_ONLY", requireRealAI: false });
    process.env.TEST_MODE = previous;
    expect(result.policyDecision.approved).to.equal(true);
    expect(result.proofURI).to.match(/^0g-local:\/\//);
    expect(result.revokedBlocked).to.equal(true);
    expect(result.finalSovereignBalance).to.equal("0");
  });

  it("optionally verifies real BYOK provider output when a key is configured", async function () {
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.CUSTOM_OPENAI_API_KEY) {
      this.skip();
    }
    const result = await runRealAiTest({ mode: process.env.TEST_MODE || "FREE_DATA_REAL_AI" });
    expect(result.strategy).to.include.keys(["recommendation", "confidence", "riskScore", "reasoning", "strategyPlan", "exitConditions", "sources"]);
    expect(result.proofURI).to.match(/^0g-local:\/\//);
  });

  it("optionally checks real DeFiLlama data when TEST_MODE uses real free data", async function () {
    if (!["FREE_DATA_REAL_AI", "FULL_TESTNET"].includes(process.env.TEST_MODE || "")) this.skip();
    const result = await getTopYieldOpportunities({ chain: "Ethereum", symbol: "USDC", minTvlUsd: 100_000, limit: 3 });
    expect(result.opportunities.length).to.be.greaterThan(0);
  });

  it("optionally checks real Polymarket data when TEST_MODE uses real free data", async function () {
    if (!["FREE_DATA_REAL_AI", "FULL_TESTNET"].includes(process.env.TEST_MODE || "")) this.skip();
    const result = await searchPredictionMarkets("bitcoin", { limit: 3 });
    expect(result.markets.length).to.be.greaterThan(0);
  });
});

function adapterCall(adapter, targetChainId, asset, amount, receiver, slippageBps, action) {
  const payload = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address", "uint256", "address", "uint256", "bytes32"],
    [targetChainId, asset, amount, receiver, slippageBps, action],
  );
  return adapter.interface.encodeFunctionData("execute", [payload]);
}
