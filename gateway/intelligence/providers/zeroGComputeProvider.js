import { OpenAICompatibleProvider } from "./base.js";
import { MockProvider } from "./mockProvider.js";

export class ZeroGComputeProvider extends OpenAICompatibleProvider {
  constructor({
    apiKey = process.env.ZERO_G_COMPUTE_API_KEY,
    endpointUrl = process.env.ZERO_G_COMPUTE_BASE_URL || process.env.ZERO_G_ROUTER_BASE_URL,
    network = process.env.ZERO_G_NETWORK || "testnet",
    fallbackToMock = true,
  } = {}) {
    const defaultEndpoint = network === "mainnet"
      ? "https://router-api.0g.ai/v1/chat/completions"
      : "https://router-api-testnet.integratenetwork.work/v1/chat/completions";
    super({
      name: "0g-compute",
      supportedModels: ["qwen3.6-plus", "deepseek-chat-v3-0324", "glm-5-fp8", "qwen3-vl-30b"],
      apiKey,
      endpointUrl: endpointUrl ? normalizeChatEndpoint(endpointUrl) : defaultEndpoint,
      defaultEndpointUrl: defaultEndpoint,
    });
    this.fallbackToMock = fallbackToMock;
    this.mock = new MockProvider();
  }

  async healthCheck() {
    if (!this.apiKey && this.fallbackToMock) {
      return { provider: this.name, ok: true, mode: "mock-fallback", reason: "ZERO_G_COMPUTE_API_KEY missing" };
    }
    return super.healthCheck();
  }

  async runInference(request) {
    if (!this.apiKey && this.fallbackToMock) {
      const result = await this.mock.runInference({ ...request, model: "mock-structured" });
      return { ...result, raw: { ...result.raw, zeroGFallback: true } };
    }
    return super.runInference(request);
  }
}

function normalizeChatEndpoint(url) {
  if (url.endsWith("/chat/completions")) return url;
  return `${url.replace(/\/$/, "")}/chat/completions`;
}
