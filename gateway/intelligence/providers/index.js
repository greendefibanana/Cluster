import { AnthropicProvider } from "./anthropicProvider.js";
import { DgridProvider } from "./dgridProvider.js";
import { GeminiProvider } from "./geminiProvider.js";
import { MockProvider } from "./mockProvider.js";
import { CustomOpenAICompatibleProvider, OpenAIProvider } from "./openaiProvider.js";
import { ZeroGComputeProvider } from "./zeroGComputeProvider.js";

export function createManagedProviders() {
  return {
    mock: new MockProvider(),
    dgrid: new DgridProvider(),
    openai: new OpenAIProvider(),
    anthropic: new AnthropicProvider(),
    gemini: new GeminiProvider(),
    "0g-compute": new ZeroGComputeProvider(),
    "custom-openai": new CustomOpenAICompatibleProvider({
      apiKey: process.env.CUSTOM_OPENAI_API_KEY,
      endpointUrl: process.env.CUSTOM_OPENAI_API_URL,
    }),
  };
}

export function createByokProvider(providerName, credential) {
  const options = { apiKey: credential?.apiKey, endpointUrl: credential?.endpointUrl };
  switch (providerName) {
    case "openai":
      return new OpenAIProvider(options);
    case "anthropic":
      return new AnthropicProvider(options);
    case "gemini":
      return new GeminiProvider(options);
    case "dgrid":
      return new DgridProvider(options);
    case "0g-compute":
      return new ZeroGComputeProvider({ ...options, fallbackToMock: false });
    case "custom-openai":
      return new CustomOpenAICompatibleProvider(options);
    case "mock":
      return new MockProvider();
    default:
      if (credential?.endpointUrl) {
        return new CustomOpenAICompatibleProvider({ ...options, providerName });
      }
      throw new Error(`Unsupported intelligence provider: ${providerName}`);
  }
}
