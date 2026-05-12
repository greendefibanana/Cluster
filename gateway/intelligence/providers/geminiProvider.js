import { BaseProvider, estimateTokens, parseMaybeJson } from "./base.js";

export class GeminiProvider extends BaseProvider {
  constructor({ apiKey = process.env.GEMINI_API_KEY, endpointUrl = process.env.GEMINI_API_URL } = {}) {
    super({ name: "gemini", supportedModels: ["gemini-1.5-flash", "gemini-1.5-pro"], apiKey, endpointUrl });
  }

  async healthCheck() {
    return { provider: this.name, ok: Boolean(this.apiKey), endpointUrl: this.endpointUrl || "google-generativelanguage" };
  }

  async runInference({ model = "gemini-1.5-flash", messages, temperature = 0.4, maxTokens = 900 }) {
    if (!this.apiKey) throw new Error("gemini provider missing api key");
    const url = this.endpointUrl || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
    const contents = messages.filter((message) => message.role !== "system").map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
    const systemInstruction = messages.find((message) => message.role === "system")?.content;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    });
    if (!response.ok) {
      throw new Error(`gemini error ${response.status}: ${(await response.text()).slice(0, 240)}`);
    }
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
    const inputTokens = Number(data.usageMetadata?.promptTokenCount || estimateTokens(messages));
    const outputTokens = Number(data.usageMetadata?.candidatesTokenCount || estimateTokens([{ role: "assistant", content }]));
    return {
      output: parseMaybeJson(content),
      raw: data,
      usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      providerRequestId: data.responseId,
    };
  }
}
