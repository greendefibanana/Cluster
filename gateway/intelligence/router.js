import { randomUUID } from "crypto";
import { createManagedProviders, createByokProvider } from "./providers/index.js";
import { JsonIntelligenceStore } from "./store.js";
import { calculateCost } from "./providers/base.js";
import { schemaForTask, schemaInstruction, validateStructuredOutput } from "./schemas/outputs.js";
import { createZeroGStorageProvider } from "../zeroG/storageProvider.js";

export class IntelligenceRouter {
  constructor({
    store = new JsonIntelligenceStore(),
    managedProviders = createManagedProviders(),
    zeroGStorage = createZeroGStorageProvider(process.env.ZERO_G_PROVIDER || "mock"),
  } = {}) {
    this.store = store;
    this.managedProviders = managedProviders;
    this.zeroGStorage = zeroGStorage;
  }

  async runAgentInference(request) {
    const normalized = normalizeRequest(request, this.store);
    const traceId = randomUUID();
    const schema = normalized.responseSchema || schemaForTask(normalized.taskType);
    const providerOrder = providerFallbackOrder(normalized);
    const messages = withSystemPrompt(normalized, schema);
    const attempts = [];

    for (const providerName of providerOrder) {
      const provider = this.resolveProvider(providerName, normalized);
      const model = modelForProvider(normalized, providerName);
      const pricing = this.store.getPricing(provider.name, model);
      const estimate = provider.estimateCost({ messages, model, pricing });

      try {
        if (normalized.providerMode === "MANAGED") {
          this.ensureCredits(normalized.userId, estimate.estimatedCost, provider.name, model);
        }
        const result = await provider.runInference({
          ...normalized,
          model,
          messages,
          responseSchema: schema,
          taskType: normalized.taskType,
        });
        const usage = provider.normalizeUsage(result.raw, result.usage);
        const billedCost = normalized.providerMode === "MANAGED"
          ? calculateCost(usage, pricing)
          : platformFeeForByok(normalized, usage);
        if (normalized.providerMode === "MANAGED") {
          this.store.chargeCredits(normalized.userId, billedCost);
        }

        const validation = validateStructuredOutput(result.output, schema);
        if (!validation.ok) {
          throw new Error(`Structured output missing fields: ${validation.missing.join(", ")}`);
        }

        const trace = {
          traceId,
          userId: normalized.userId,
          agentId: normalized.agentId,
          clusterId: normalized.clusterId,
          workflowId: normalized.workflowId,
          providerMode: normalized.providerMode,
          provider: provider.name,
          model,
          taskType: normalized.taskType,
          messages: redactMessages(messages),
          output: result.output,
          usage: {
            ...usage,
            estimatedCost: estimate.estimatedCost,
            billedCost,
          },
          metadata: normalized.metadata,
          attempts: [...attempts, { provider: provider.name, model, status: "success" }],
        };
        const proof = await this.zeroGStorage.uploadInferenceTrace(traceId, trace);
        this.store.saveTrace({ ...trace, proofURI: proof.uri });
        this.store.logUsageEvent({
          userId: normalized.userId,
          agentId: normalized.agentId,
          clusterId: normalized.clusterId,
          workflowId: normalized.workflowId,
          providerMode: normalized.providerMode,
          provider: provider.name,
          model,
          taskType: normalized.taskType,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          estimatedCost: estimate.estimatedCost,
          billedCost,
          status: "success",
          traceId,
        });

        return {
          output: result.output,
          provider: provider.name,
          model,
          usage: {
            ...usage,
            estimatedCost: estimate.estimatedCost,
            billedCost,
          },
          proofURI: proof.uri,
          traceId,
        };
      } catch (error) {
        attempts.push({ provider: provider.name, model, status: "failed", error: error.message });
        this.store.logUsageEvent({
          userId: normalized.userId,
          agentId: normalized.agentId,
          clusterId: normalized.clusterId,
          workflowId: normalized.workflowId,
          providerMode: normalized.providerMode,
          provider: provider.name,
          model,
          taskType: normalized.taskType,
          inputTokens: estimate.inputTokens,
          outputTokens: 0,
          totalTokens: estimate.inputTokens,
          estimatedCost: estimate.estimatedCost,
          billedCost: 0,
          status: "failed",
          traceId,
          error: error.message,
        });
      }
    }

    this.store.saveTrace({
      traceId,
      userId: normalized.userId,
      agentId: normalized.agentId,
      providerMode: normalized.providerMode,
      taskType: normalized.taskType,
      status: "failed",
      attempts,
    });
    throw new Error(`All intelligence providers failed for trace ${traceId}: ${attempts.map((attempt) => `${attempt.provider}=${attempt.error}`).join("; ")}`);
  }

  resolveProvider(providerName, request) {
    if (request.providerMode === "BYOK") {
      const credential = this.store.getProviderCredential({ userId: request.userId, agentId: request.agentId, provider: providerName });
      if (!credential && providerName !== "mock") {
        throw new Error(`No BYOK credential configured for ${providerName}`);
      }
      return createByokProvider(providerName, credential);
    }
    const provider = this.managedProviders[providerName];
    if (!provider) {
      throw new Error(`Managed provider is not configured: ${providerName}`);
    }
    return provider;
  }

  ensureCredits(userId, estimatedCost, provider, model) {
    const credits = this.store.getCredits(userId);
    if (credits.balance + 1e-12 < estimatedCost) {
      throw new Error(`Insufficient intelligence credits before ${provider}/${model}: need ${estimatedCost.toFixed(6)}, have ${credits.balance.toFixed(6)}`);
    }
  }

  async healthCheck(providerName, mode = "MANAGED", userId = "demo-user", agentId = null) {
    const provider = mode === "BYOK"
      ? this.resolveProvider(providerName, { providerMode: "BYOK", userId, agentId })
      : this.resolveProvider(providerName, { providerMode: "MANAGED" });
    return provider.healthCheck();
  }
}

export function createIntelligenceRouter(options = {}) {
  return new IntelligenceRouter(options);
}

function normalizeRequest(request, store) {
  if (!request?.userId || !request?.agentId || !request?.taskType) {
    throw new Error("userId, agentId, and taskType are required for intelligence routing");
  }
  const config = store.getAgentConfig({ userId: request.userId, agentId: request.agentId }) || {};
  const providerMode = request.providerMode || config.mode || "MANAGED";
  if (!["BYOK", "MANAGED"].includes(providerMode)) {
    throw new Error("providerMode must be BYOK or MANAGED");
  }
  const allowedTaskTypes = request.allowedTaskTypes || config.allowedTaskTypes;
  if (allowedTaskTypes?.length && !allowedTaskTypes.includes(request.taskType)) {
    throw new Error(`Task type ${request.taskType} is not allowed for agent ${request.agentId}`);
  }
  return {
    clusterId: null,
    workflowId: null,
    provider: config.primaryProvider || "dgrid",
    fallbackProviders: config.fallbackProviders || ["0g-compute", "mock"],
    model: config.model,
    messages: [],
    tools: null,
    responseSchema: null,
    metadata: {},
    personality: config.personality || "capital markets operator",
    riskProfile: config.riskProfile || "moderate",
    systemPrompt: config.systemPrompt || "You are a ClusterFi agent. Return concise, structured, verifiable reasoning.",
    temperature: Number(config.temperature ?? 0.4),
    maxTokens: Number(config.maxTokens ?? 900),
    memoryDepth: Number(config.memoryDepth ?? 8),
    zeroGMemoryURI: config.zeroGMemoryURI || null,
    ...request,
    providerMode,
    provider: request.provider || config.primaryProvider || "dgrid",
    fallbackProviders: request.fallbackProviders || config.fallbackProviders || ["0g-compute", "mock"],
    model: request.model || config.model,
  };
}

function providerFallbackOrder(request) {
  return [...new Set([request.provider, ...(request.fallbackProviders || [])].filter(Boolean))];
}

function modelForProvider(request, providerName) {
  if (request.model) return request.model;
  if (providerName === "dgrid") return "openai/gpt-4o-mini";
  if (providerName === "0g-compute") return "qwen3.6-plus";
  if (providerName === "openai") return "gpt-4o-mini";
  if (providerName === "anthropic") return "claude-3-5-sonnet-latest";
  if (providerName === "gemini") return "gemini-1.5-flash";
  return "mock-fast";
}

function withSystemPrompt(request, schema) {
  const userMessages = request.messages?.length
    ? request.messages
    : [{ role: "user", content: String(request.metadata?.prompt || request.taskType) }];
  const alreadyHasSystem = userMessages.some((message) => message.role === "system");
  const system = [
    request.systemPrompt,
    `Personality: ${request.personality}. Risk profile: ${request.riskProfile}.`,
    `Task type: ${request.taskType}.`,
    request.zeroGMemoryURI ? `Memory root: ${request.zeroGMemoryURI}.` : "",
    schema ? schemaInstruction(request.taskType) : "",
  ].filter(Boolean).join("\n");
  return alreadyHasSystem ? userMessages : [{ role: "system", content: system }, ...userMessages];
}

function platformFeeForByok(request) {
  return Number(request.metadata?.byokPlatformFee || process.env.BYOK_PLATFORM_FEE || 0);
}

function redactMessages(messages) {
  return messages.map((message) => ({
    role: message.role,
    content: String(message.content || "").slice(0, 4000),
  }));
}
