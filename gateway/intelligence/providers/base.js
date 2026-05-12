import { randomUUID } from "crypto";

export function estimateTokens(messages = []) {
  const text = messages.map((message) => `${message.role || "user"}:${message.content || ""}`).join("\n");
  return Math.max(1, Math.ceil(text.length / 4));
}

export function calculateCost(usage, pricing) {
  const input = (usage.inputTokens || 0) * (pricing.inputTokenPrice || 0);
  const output = (usage.outputTokens || 0) * (pricing.outputTokenPrice || 0);
  return Number((input + output + (pricing.flatTaskPrice || 0)).toFixed(9));
}

export function extractTextFromOpenAIResponse(data) {
  return data?.choices?.[0]?.message?.content
    ?? data?.choices?.[0]?.text
    ?? data?.output_text
    ?? JSON.stringify(data);
}

export function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export class BaseProvider {
  constructor({ name, supportedModels = [], apiKey = null, endpointUrl = null } = {}) {
    this.name = name;
    this.supportedModels = supportedModels;
    this.apiKey = apiKey;
    this.endpointUrl = endpointUrl;
  }

  async healthCheck() {
    return { provider: this.name, ok: true, mode: this.apiKey || this.name === "mock" ? "configured" : "missing-key" };
  }

  estimateCost({ messages = [], model, pricing }) {
    const inputTokens = estimateTokens(messages);
    const outputTokens = Math.max(128, Math.ceil(inputTokens * 0.45));
    const usage = { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
    return { ...usage, estimatedCost: calculateCost(usage, pricing), model };
  }

  normalizeUsage(data, fallback = {}) {
    const usage = data?.usage || {};
    const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? fallback.inputTokens ?? 0);
    const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? fallback.outputTokens ?? 0);
    return {
      inputTokens,
      outputTokens,
      totalTokens: Number(usage.total_tokens ?? inputTokens + outputTokens),
    };
  }

  async runInference() {
    throw new Error(`${this.name} provider has not implemented runInference`);
  }
}

export class OpenAICompatibleProvider extends BaseProvider {
  constructor({
    name,
    supportedModels,
    apiKey,
    endpointUrl,
    defaultEndpointUrl,
    defaultHeaders = {},
  }) {
    super({ name, supportedModels, apiKey, endpointUrl: endpointUrl || defaultEndpointUrl });
    this.defaultHeaders = defaultHeaders;
  }

  async healthCheck() {
    if (!this.endpointUrl || !this.apiKey) {
      return { provider: this.name, ok: false, reason: "missing endpoint or api key" };
    }
    return { provider: this.name, ok: true, endpointUrl: this.endpointUrl, supportedModels: this.supportedModels };
  }

  async runInference({ model, messages, tools, responseSchema, temperature = 0.4, maxTokens = 900, metadata = {} }) {
    if (!this.endpointUrl || !this.apiKey) {
      throw new Error(`${this.name} provider missing endpoint or api key`);
    }
    const body = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      metadata,
    };
    if (tools) body.tools = tools;
    if (responseSchema) body.response_format = { type: "json_object" };

    const response = await fetch(this.endpointUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
        ...this.defaultHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${this.name} error ${response.status}: ${text.slice(0, 240)}`);
    }

    const data = await response.json();
    const content = extractTextFromOpenAIResponse(data);
    return {
      output: parseMaybeJson(content),
      raw: data,
      usage: this.normalizeUsage(data, {
        inputTokens: estimateTokens(messages),
        outputTokens: estimateTokens([{ role: "assistant", content }]),
      }),
      providerRequestId: data.id || randomUUID(),
    };
  }
}
