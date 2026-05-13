import { expect } from "chai";
import { ethers } from "ethers";
import { WalletAuthService } from "../gateway/auth.js";
import { CrossChainIntentEngineService } from "../gateway/crosschain/intentEngine.js";
import { MockBridgeAdapter } from "../gateway/crosschain/bridgeAdapters.js";
import { createIntelligenceRouter } from "../gateway/intelligence/router.js";
import { MemoryIntelligenceStore } from "../gateway/intelligence/store.js";
import { MockProvider } from "../gateway/intelligence/providers/mockProvider.js";
import { MockZeroGProvider } from "../gateway/zeroGProvider.js";

describe("Gateway production guardrails", function () {
  const oldEnv = { ...process.env };

  afterEach(function () {
    process.env = { ...oldEnv };
  });

  it("issues wallet sessions only for the signer that owns the nonce", async function () {
    const wallet = ethers.Wallet.createRandom();
    const attacker = ethers.Wallet.createRandom();
    const auth = new WalletAuthService({ secret: "test-gateway-auth-secret-with-32-chars" });

    const challenge = auth.createNonce(wallet.address);
    const badSignature = await attacker.signMessage(challenge.message);
    expect(() => auth.verifySignature({
      address: wallet.address,
      nonce: challenge.nonce,
      signature: badSignature,
    })).to.throw("Signature does not match wallet");

    const goodSignature = await wallet.signMessage(challenge.message);
    const session = auth.verifySignature({
      address: wallet.address,
      nonce: challenge.nonce,
      signature: goodSignature,
    });
    expect(session.wallet).to.equal(wallet.address.toLowerCase());
    expect(auth.verifySession(session.token).wallet).to.equal(wallet.address.toLowerCase());
  });

  it("blocks mock bridge construction in production", function () {
    process.env.NODE_ENV = "production";
    expect(() => new CrossChainIntentEngineService({ bridge: new MockBridgeAdapter() }))
      .to.throw("MockBridgeAdapter is disabled in production");
  });

  it("keeps cross-chain intents pending when execution is disabled", async function () {
    process.env.DISABLE_CROSSCHAIN_EXECUTION = "true";
    const engine = new CrossChainIntentEngineService();
    const intent = await engine.createIntent({
      targetChain: 1,
      asset: "0x0000000000000000000000000000000000000001",
      amount: 100,
      strategyType: "eth-yield",
      userSovereignAccount: "0x0000000000000000000000000000000000000002",
    });

    await expect(engine.executeIntent(intent.id))
      .to.be.rejectedWith("Cross-chain execution is disabled");
    expect(engine.intents.get(intent.id).intentStatus).to.equal("pending");
  });

  it("disables mock intelligence provider in production", async function () {
    process.env.NODE_ENV = "production";
    const store = new MemoryIntelligenceStore({ encryptionKey: "test-intelligence-encryption-key" });
    const router = createIntelligenceRouter({
      store,
      zeroGStorage: new MockZeroGProvider({ namespace: "prod-guard-test" }),
      managedProviders: { mock: new MockProvider() },
    });
    store.addCredits("user-1", 1);
    store.setAgentConfig({ userId: "user-1", agentId: "agent-1", mode: "MANAGED", primaryProvider: "mock", fallbackProviders: [] });

    await expect(router.runAgentInference({
      userId: "user-1",
      agentId: "agent-1",
      taskType: "agent-execute",
      messages: [{ role: "user", content: "Run." }],
    })).to.be.rejectedWith("Mock intelligence provider is disabled in production");
  });
});
