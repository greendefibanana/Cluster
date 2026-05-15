import { expect } from "chai";
import { ethers } from "ethers";
import { WalletAuthService } from "../gateway/auth.js";
import { CrossChainIntentEngineService } from "../gateway/crosschain/intentEngine.js";
import { MockBridgeAdapter } from "../gateway/crosschain/bridgeAdapters.js";
import { createIntelligenceRouter } from "../gateway/intelligence/router.js";
import { JsonIntelligenceStore, MemoryIntelligenceStore } from "../gateway/intelligence/store.js";
import { createByokProvider } from "../gateway/intelligence/providers/index.js";
import { MockProvider } from "../gateway/intelligence/providers/mockProvider.js";
import { MockZeroGProvider } from "../gateway/zeroGProvider.js";
import { createZeroGStorageProvider } from "../gateway/zeroG/storageProvider.js";
import { MockZeroGDAProvider } from "../gateway/zeroG/daProvider.js";
import {
  assertAllowedProvider,
  assertAllowedTaskType,
  assertByokCredentialInput,
  assertManagedModeAllowed,
  createRateLimiter,
  publicError,
} from "../gateway/security.js";

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
    expect(() => new CrossChainIntentEngineService({
      zeroGStorage: new MockZeroGProvider({ namespace: "bridge-guard-test" }),
      zeroGDA: new MockZeroGDAProvider({ namespace: "bridge-guard-test" }),
      bridge: new MockBridgeAdapter(),
    }))
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

  it("blocks direct mock BYOK and mock 0G storage factories in production", function () {
    process.env.NODE_ENV = "production";
    expect(() => createByokProvider("mock")).to.throw("Mock BYOK provider is disabled in production");
    expect(() => createZeroGStorageProvider("mock")).to.throw("Production 0G storage requires ZERO_G_PROVIDER=real");
  });

  it("rejects unsupported providers, unsupported tasks, and unsafe BYOK input", function () {
    expect(() => assertAllowedProvider("shadow-router")).to.throw("Unsupported intelligence provider");
    expect(() => assertAllowedTaskType("withdraw-user-funds")).to.throw("Unsupported intelligence task type");
    expect(() => assertByokCredentialInput({ provider: "mock", apiKey: "123456789012" })).to.throw("Mock provider");
    expect(() => assertByokCredentialInput({ provider: "gemini", apiKey: "short" })).to.throw("apiKey is too short");
    expect(() => assertByokCredentialInput({ provider: "custom-openai", apiKey: "123456789012" })).to.throw("endpointUrl is required");
  });

  it("fails closed for managed inference and JSON-backed intelligence storage in production", function () {
    process.env.NODE_ENV = "production";
    expect(() => assertManagedModeAllowed("MANAGED", { production: true, managedEnabled: false }))
      .to.throw("Managed intelligence is disabled in production");
    expect(() => new JsonIntelligenceStore({ encryptionKey: "test-intelligence-encryption-key" }))
      .to.throw("JsonIntelligenceStore is disabled in production");
    expect(() => new MemoryIntelligenceStore({ encryptionKey: "test-intelligence-encryption-key" }))
      .not.to.throw();
  });

  it("sanitizes production errors while preserving development diagnostics", function () {
    expect(publicError(new Error("provider key leaked"), { production: true, fallback: "Request failed" }))
      .to.deep.equal({ error: "Request failed" });
    expect(publicError(new Error("dev detail"), { production: false }))
      .to.deep.equal({ error: "dev detail" });
  });

  it("rate limits repeated requests by key", function () {
    const limiter = createRateLimiter({ windowMs: 10_000, max: 1, keyPrefix: "test", keyFn: () => "wallet-1" });
    const req = { ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" } };
    const headers = {};
    let statusCode = null;
    let body = null;
    const res = {
      setHeader(key, value) {
        headers[key] = value;
      },
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    };
    let nextCount = 0;

    limiter(req, res, () => { nextCount += 1; });
    limiter(req, res, () => { nextCount += 1; });

    expect(nextCount).to.equal(1);
    expect(statusCode).to.equal(429);
    expect(body).to.deep.equal({ error: "rate limit exceeded" });
    expect(headers["Retry-After"]).to.equal("10");
  });
});
