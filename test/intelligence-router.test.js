import { expect } from "chai";
import { createIntelligenceRouter } from "../gateway/intelligence/router.js";
import { MemoryIntelligenceStore } from "../gateway/intelligence/store.js";
import { decryptSecret } from "../gateway/intelligence/crypto.js";
import { MockProvider } from "../gateway/intelligence/providers/mockProvider.js";
import { MockZeroGProvider } from "../gateway/zeroGProvider.js";
import { ClusterFiCoordinator, defaultAgents } from "../gateway/openClawCoordinator.js";

describe("ClusterFi source of intelligence", function () {
  function fixture() {
    const store = new MemoryIntelligenceStore({ encryptionKey: "test-intelligence-encryption-key" });
    const zeroG = new MockZeroGProvider({ namespace: "intelligence-test" });
    const router = createIntelligenceRouter({
      store,
      zeroGStorage: zeroG,
      managedProviders: {
        mock: new MockProvider(),
        dgrid: new MockProvider(),
        "0g-compute": new MockProvider(),
      },
    });
    return { store, router, zeroG };
  }

  it("runs managed mode, meters usage, charges credits, and stores an inference trace", async function () {
    const { store, router } = fixture();
    store.addCredits("user-1", 1);
    store.setAgentConfig({ userId: "user-1", agentId: "agent-1", mode: "MANAGED", primaryProvider: "mock", model: "mock-structured" });

    const result = await router.runAgentInference({
      userId: "user-1",
      agentId: "agent-1",
      taskType: "sleuth-alpha",
      messages: [{ role: "user", content: "Find social alpha." }],
    });

    expect(result.provider).to.equal("mock");
    expect(result.output).to.include.keys(["thesis", "confidence", "sources", "riskFactors", "suggestedInstrumentType", "proofSummary"]);
    expect(result.proofURI).to.match(/^0g:\/\//);
    expect(store.getCredits("user-1").totalSpent).to.be.greaterThan(0);
    expect(store.getUsageEvents({ userId: "user-1" })).to.have.length(1);
  });

  it("rejects managed mode before provider use when credits are insufficient", async function () {
    const { store, router } = fixture();
    store.setAgentConfig({ userId: "user-1", agentId: "agent-1", mode: "MANAGED", primaryProvider: "mock", fallbackProviders: [] });

    let error;
    try {
      await router.runAgentInference({
        userId: "user-1",
        agentId: "agent-1",
        taskType: "quant-strategy",
        messages: [{ role: "user", content: "Design a yield strategy." }],
      });
    } catch (caught) {
      error = caught;
    }
    expect(error.message).to.include("All intelligence providers failed");

    const [event] = store.getUsageEvents({ userId: "user-1" });
    expect(event.status).to.equal("failed");
    expect(event.error).to.include("Insufficient intelligence credits");
    expect(store.getCredits("user-1").totalSpent).to.equal(0);
  });

  it("does not allow dGrid managed usage for free", async function () {
    const { store, router } = fixture();
    store.setAgentConfig({ userId: "user-1", agentId: "agent-1", mode: "MANAGED", primaryProvider: "dgrid", fallbackProviders: [] });

    let error;
    try {
      await router.runAgentInference({
        userId: "user-1",
        agentId: "agent-1",
        taskType: "social-post",
        provider: "dgrid",
        messages: [{ role: "user", content: "Post alpha." }],
      });
    } catch (caught) {
      error = caught;
    }
    expect(error.message).to.include("All intelligence providers failed");
  });

  it("falls back to a secondary provider and logs the failed attempt", async function () {
    const { store, router } = fixture();
    store.addCredits("user-1", 1);
    router.managedProviders.bad = {
      name: "bad",
      estimateCost: router.managedProviders.mock.estimateCost.bind(router.managedProviders.mock),
      normalizeUsage: router.managedProviders.mock.normalizeUsage.bind(router.managedProviders.mock),
      runInference: async () => {
        throw new Error("provider down");
      },
    };

    const result = await router.runAgentInference({
      userId: "user-1",
      agentId: "agent-1",
      taskType: "pnl-report",
      provider: "bad",
      fallbackProviders: ["mock"],
      messages: [{ role: "user", content: "Report PnL." }],
    });

    expect(result.provider).to.equal("mock");
    const events = store.getUsageEvents({ userId: "user-1" });
    expect(events.map((event) => event.status)).to.deep.equal(["failed", "success"]);
  });

  it("encrypts BYOK credentials and never stores plaintext API keys", function () {
    const { store } = fixture();
    const masked = store.storeProviderCredential({
      userId: "user-1",
      agentId: "agent-1",
      provider: "openai",
      apiKey: "sk-real-user-secret",
      metadata: {
        model: "gpt-4o-mini",
        apiKey: "metadata-secret",
        authorization: "Bearer metadata-secret",
        nested: { token: "nested-secret" },
      },
    });
    const raw = store.state.providerCredentials[0];

    expect(masked.apiKey).to.match(/^\*\*\*\*/);
    expect(raw.encryptedApiKey).to.not.include("sk-real-user-secret");
    expect(decryptSecret(raw.encryptedApiKey, "test-intelligence-encryption-key")).to.equal("sk-real-user-secret");
    expect(raw.metadata).to.deep.equal({ model: "gpt-4o-mini", nested: "[redacted-object]" });
  });

  it("supports BYOK mode without charging managed credits when using a user provider", async function () {
    const { store, router } = fixture();
    store.setAgentConfig({ userId: "user-1", agentId: "agent-1", mode: "BYOK", primaryProvider: "mock", fallbackProviders: [] });

    const result = await router.runAgentInference({
      userId: "user-1",
      agentId: "agent-1",
      taskType: "marketing",
      providerMode: "BYOK",
      provider: "mock",
      messages: [{ role: "user", content: "Market a Farcaster Mini App." }],
    });

    expect(result.provider).to.equal("mock");
    expect(result.usage.billedCost).to.equal(0);
    expect(store.getCredits("user-1").totalSpent).to.equal(0);
  });

  it("mocks 0G storage uploads and reads inference trace objects", async function () {
    const zeroG = new MockZeroGProvider({ namespace: "read-test" });
    const proof = await zeroG.uploadInferenceTrace("trace-1", { ok: true });
    const record = await zeroG.readZeroGObject(proof.uri);
    expect(record.body.payload.traceId).to.equal("trace-1");
  });

  it("runs an OpenClaw workflow through the intelligence router", async function () {
    const { store, router, zeroG } = fixture();
    const userId = "workflow-user";
    store.addCredits(userId, 5);
    for (const agent of defaultAgents()) {
      store.setAgentConfig({ userId, agentId: agent.id, mode: "MANAGED", primaryProvider: "mock", fallbackProviders: [] });
    }
    const coordinator = new ClusterFiCoordinator({ zeroGProvider: zeroG, intelligenceRouter: router, userId });
    const result = await coordinator.runSleuthAlphaWorkflow({ agents: defaultAgents(), context: "AI x social alpha" });

    expect(result.alpha.provider).to.equal("mock");
    expect(result.proof.uri).to.match(/^0g:\/\//);
    expect(store.getUsageEvents({ userId })).to.have.length(1);
  });
});
