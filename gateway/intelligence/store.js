import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { decryptSecret, encryptSecret, maskSecret } from "./crypto.js";

export const DEFAULT_STATE_PATH = path.join(process.cwd(), "deployments", "intelligence-state.json");

const defaultPricing = [
  pricing("mock", "mock-fast", 0.000001, 0.000002),
  pricing("dgrid", "openai/gpt-4o-mini", 0.000004, 0.000012),
  pricing("dgrid", "openai/gpt-4o", 0.00001, 0.00003),
  pricing("dgrid", "deepseek/deepseek-r1", 0.000004, 0.000014),
  pricing("openai", "gpt-4o-mini", 0.000004, 0.000012),
  pricing("openai", "gpt-4o", 0.00001, 0.00003),
  pricing("anthropic", "claude-3-5-sonnet-latest", 0.000012, 0.00006),
  pricing("gemini", "gemini-1.5-flash", 0.000002, 0.000008),
  pricing("0g-compute", "qwen3.6-plus", 0.000003, 0.00001),
  pricing("custom-openai", "custom", 0.000004, 0.000012),
];

function pricing(provider, model, inputTokenPrice, outputTokenPrice, flatTaskPrice = 0) {
  return { provider, model, inputTokenPrice, outputTokenPrice, flatTaskPrice, active: true };
}

function initialState() {
  return {
    users: [],
    agentIntelligenceConfigs: [],
    providerCredentials: [],
    usageCredits: [],
    usageEvents: [],
    providerPricing: defaultPricing,
    inferenceTraces: [],
  };
}

export class JsonIntelligenceStore {
  constructor({ filePath = DEFAULT_STATE_PATH, encryptionKey = process.env.INTELLIGENCE_ENCRYPTION_KEY } = {}) {
    this.filePath = filePath;
    this.encryptionKey = encryptionKey;
    this.state = this.load();
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      return initialState();
    }
    const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    return { ...initialState(), ...parsed };
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }

  upsertUser(user) {
    const existing = this.state.users.find((item) => item.id === user.id);
    if (existing) {
      Object.assign(existing, user, { updatedAt: new Date().toISOString() });
    } else {
      this.state.users.push({ ...user, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.save();
    return this.state.users.find((item) => item.id === user.id);
  }

  getCredits(userId) {
    let credits = this.state.usageCredits.find((item) => item.userId === userId);
    if (!credits) {
      credits = { userId, balance: 0, totalFunded: 0, totalSpent: 0, updatedAt: new Date().toISOString() };
      this.state.usageCredits.push(credits);
      this.save();
    }
    return credits;
  }

  addCredits(userId, amount) {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error("Credit amount must be greater than zero");
    }
    const credits = this.getCredits(userId);
    credits.balance = roundMoney(credits.balance + numericAmount);
    credits.totalFunded = roundMoney(credits.totalFunded + numericAmount);
    credits.updatedAt = new Date().toISOString();
    this.save();
    return credits;
  }

  chargeCredits(userId, amount) {
    const numericAmount = Number(amount);
    const credits = this.getCredits(userId);
    if (credits.balance + 1e-12 < numericAmount) {
      throw new Error(`Insufficient intelligence credits: need ${numericAmount.toFixed(6)}, have ${credits.balance.toFixed(6)}`);
    }
    credits.balance = roundMoney(credits.balance - numericAmount);
    credits.totalSpent = roundMoney(credits.totalSpent + numericAmount);
    credits.updatedAt = new Date().toISOString();
    this.save();
    return credits;
  }

  setAgentConfig(config) {
    const normalized = {
      id: config.id || `${config.userId}:${config.agentId}`,
      mode: "MANAGED",
      primaryProvider: "dgrid",
      fallbackProviders: ["0g-compute", "mock"],
      model: "openai/gpt-4o-mini",
      personality: "capital markets operator",
      riskProfile: "moderate",
      systemPrompt: "You are a ClusterFi agent. Return structured, verifiable capital-markets reasoning.",
      temperature: 0.4,
      maxTokens: 900,
      memoryDepth: 8,
      allowedTaskTypes: ["sleuth-alpha", "quant-strategy", "pnl-report", "marketing", "meme-launch", "prediction-market", "agent-execute", "social-post"],
      zeroGMemoryURI: null,
      active: true,
      ...config,
      updatedAt: new Date().toISOString(),
    };
    const existingIndex = this.state.agentIntelligenceConfigs.findIndex((item) => item.id === normalized.id);
    if (existingIndex >= 0) {
      this.state.agentIntelligenceConfigs[existingIndex] = { ...this.state.agentIntelligenceConfigs[existingIndex], ...normalized };
    } else {
      this.state.agentIntelligenceConfigs.push({ ...normalized, createdAt: new Date().toISOString() });
    }
    this.save();
    return normalized;
  }

  getAgentConfig({ userId, agentId }) {
    return this.state.agentIntelligenceConfigs.find((item) => item.userId === userId && item.agentId === agentId && item.active);
  }

  storeProviderCredential({ userId, agentId = null, provider, apiKey, endpointUrl = null, metadata = {} }) {
    const encryptedApiKey = encryptSecret(apiKey, this.encryptionKey);
    const credential = {
      id: randomUUID(),
      userId,
      agentId,
      provider,
      endpointUrl,
      encryptedApiKey,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.providerCredentials = this.state.providerCredentials.filter((item) =>
      !(item.userId === userId && item.agentId === agentId && item.provider === provider)
    );
    this.state.providerCredentials.push(credential);
    this.save();
    return this.maskCredential(credential);
  }

  getProviderCredential({ userId, agentId = null, provider }) {
    const credential = this.state.providerCredentials.find((item) =>
      item.userId === userId && item.provider === provider && (item.agentId === agentId || item.agentId === null)
    );
    if (!credential) return null;
    return {
      ...credential,
      apiKey: decryptSecret(credential.encryptedApiKey, this.encryptionKey),
    };
  }

  maskCredential(credential) {
    return {
      id: credential.id,
      userId: credential.userId,
      agentId: credential.agentId,
      provider: credential.provider,
      endpointUrl: credential.endpointUrl,
      apiKey: maskSecret(credential.encryptedApiKey),
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }

  getPricing(provider, model) {
    return this.state.providerPricing.find((item) => item.active && item.provider === provider && item.model === model)
      || this.state.providerPricing.find((item) => item.active && item.provider === provider)
      || pricing(provider, model, 0.000004, 0.000012);
  }

  upsertPricing(row) {
    const next = { active: true, flatTaskPrice: 0, ...row };
    const index = this.state.providerPricing.findIndex((item) => item.provider === next.provider && item.model === next.model);
    if (index >= 0) {
      this.state.providerPricing[index] = { ...this.state.providerPricing[index], ...next };
    } else {
      this.state.providerPricing.push(next);
    }
    this.save();
    return next;
  }

  logUsageEvent(event) {
    const row = {
      id: event.id || randomUUID(),
      status: "success",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      billedCost: 0,
      createdAt: new Date().toISOString(),
      ...event,
    };
    this.state.usageEvents.push(row);
    this.save();
    return row;
  }

  saveTrace(trace) {
    const row = {
      id: trace.id || trace.traceId || randomUUID(),
      traceId: trace.traceId || trace.id || randomUUID(),
      createdAt: new Date().toISOString(),
      ...trace,
    };
    this.state.inferenceTraces.push(row);
    this.save();
    return row;
  }

  getUsageEvents(filter = {}) {
    return this.state.usageEvents.filter((event) =>
      Object.entries(filter).every(([key, value]) => value === undefined || event[key] === value)
    );
  }
}

export class MemoryIntelligenceStore extends JsonIntelligenceStore {
  constructor({ encryptionKey = "clusterfi-test-encryption-key" } = {}) {
    super({ filePath: path.join(process.cwd(), "deployments", `.memory-${randomUUID()}.json`), encryptionKey });
    this.state = initialState();
  }

  save() {
    // Keep tests and local dry-runs in memory.
  }
}

function roundMoney(value) {
  return Math.round(Number(value) * 1_000_000_000) / 1_000_000_000;
}
