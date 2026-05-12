import { BaseProvider, estimateTokens, parseMaybeJson } from "./base.js";

export class AnthropicProvider extends BaseProvider {
  constructor({ apiKey = process.env.ANTHROPIC_API_KEY, endpointUrl = process.env.ANTHROPIC_API_URL || "https://api.anthropic.com/v1/messages" } = {}) {
    super({ name: "anthropic", supportedModels: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"], apiKey, endpointUrl });
  }

  async healthCheck() {
    return { provider: this.name, ok: Boolean(this.apiKey), endpointUrl: this.endpointUrl };
  }

  async runInference({ model, messages, temperature = 0.4, maxTokens = 900, responseSchema }) {
    if (!this.apiKey) throw new Error("anthropic provider missing api key");
    const system = messages.find((message) => message.role === "system")?.content || "";
    const anthropicMessages = messages.filter((message) => message.role !== "system").map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }));
    const response = await fetch(this.endpointUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, system, messages: anthropicMessages, temperature, max_tokens: maxTokens }),
    });
    if (!response.ok) {
      throw new Error(`anthropic error ${response.status}: ${(await response.text()).slice(0, 240)}`);
    }
    const data = await response.json();
    const content = data.content?.map((part) => part.text || "").join("\n") || "";
    const inputTokens = Number(data.usage?.input_tokens || estimateTokens(messages));
    const outputTokens = Number(data.usage?.output_tokens || estimateTokens([{ role: "assistant", content }]));
    return {
      output: responseSchema ? parseMaybeJson(content) : parseMaybeJson(content),
      raw: data,
      usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      providerRequestId: data.id,
    };
  }
}
