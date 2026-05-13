import { AnthropicProvider as ClaudeProvider } from "../../../gateway/intelligence/providers/anthropicProvider.js";
import { GeminiProvider } from "../../../gateway/intelligence/providers/geminiProvider.js";
import { MockProvider } from "../../../gateway/intelligence/providers/mockProvider.js";
import { CustomOpenAICompatibleProvider, OpenAIProvider } from "../../../gateway/intelligence/providers/openaiProvider.js";
import { JsonIntelligenceStore, MemoryIntelligenceStore } from "../../../gateway/intelligence/store.js";
import { maskSecret } from "../../../gateway/intelligence/crypto.js";

export { ClaudeProvider, GeminiProvider, MockProvider, CustomOpenAICompatibleProvider, OpenAIProvider };

export function createByokProvider(provider, credential = {}) {
  switch (provider) {
    case "openai":
      return new OpenAIProvider(credential);
    case "gemini":
      return new GeminiProvider(credential);
    case "claude":
    case "anthropic":
      return new ClaudeProvider(credential);
    case "custom-openai":
      return new CustomOpenAICompatibleProvider(credential);
    case "mock":
      return new MockProvider();
    default:
      if (credential.endpointUrl) {
        return new CustomOpenAICompatibleProvider({ ...credential, providerName: provider });
      }
      throw new Error(`Unsupported BYOK provider: ${provider}`);
  }
}

export function createFreeFirstProviderRegistry({ store = new JsonIntelligenceStore() } = {}) {
  return new FreeFirstProviderRegistry({ store });
}

export class FreeFirstProviderRegistry {
  constructor({ store = new JsonIntelligenceStore() } = {}) {
    this.store = store;
    this.cooldowns = new Map();
  }

  storeUserKey({ userId, agentId = null, provider, apiKey, endpointUrl = null, model = null }) {
    if (!userId || !provider || !apiKey) {
      throw new Error("userId, provider, and apiKey are required");
    }
    return this.store.storeProviderCredential({
      userId,
      agentId,
      provider,
      apiKey,
      endpointUrl,
      metadata: { model, managedMode: false },
    });
  }

  getMaskedKey({ userId, agentId = null, provider }) {
    const credential = this.store.state.providerCredentials.find((item) =>
      item.userId === userId && item.provider === provider && (item.agentId === agentId || item.agentId === null)
    );
    if (!credential) return null;
    return {
      id: credential.id,
      provider,
      endpointUrl: credential.endpointUrl,
      apiKey: maskSecret("stored"),
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }

  resolveProvider({ userId, agentId = null, provider }) {
    if (this.isCoolingDown(provider)) {
      throw new Error(`${provider} is cooling down after a failed health check`);
    }
    if (provider === "mock") return new MockProvider();
    const credential = this.store.getProviderCredential({ userId, agentId, provider });
    if (!credential) throw new Error(`No BYOK credential configured for ${provider}`);
    return createByokProvider(provider, credential);
  }

  async healthCheck({ userId, agentId = null, provider }) {
    try {
      const instance = this.resolveProvider({ userId, agentId, provider });
      const health = await instance.healthCheck();
      if (!health.ok) this.setCooldown(provider);
      return { ...health, provider };
    } catch (error) {
      this.setCooldown(provider);
      return { provider, ok: false, reason: error.message };
    }
  }

  setCooldown(provider, ttlMs = 60_000) {
    this.cooldowns.set(provider, Date.now() + ttlMs);
  }

  isCoolingDown(provider) {
    const until = this.cooldowns.get(provider);
    if (!until) return false;
    if (until < Date.now()) {
      this.cooldowns.delete(provider);
      return false;
    }
    return true;
  }
}

export function createMemoryByokRegistry() {
  return createFreeFirstProviderRegistry({ store: new MemoryIntelligenceStore({ encryptionKey: "clusterfi-free-v1-test-key" }) });
}
