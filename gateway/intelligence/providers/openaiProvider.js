import { OpenAICompatibleProvider } from "./base.js";

export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor({ apiKey = process.env.OPENAI_API_KEY, endpointUrl = process.env.OPENAI_API_URL } = {}) {
    super({
      name: "openai",
      supportedModels: ["gpt-4o-mini", "gpt-4o"],
      apiKey,
      endpointUrl,
      defaultEndpointUrl: "https://api.openai.com/v1/chat/completions",
    });
  }
}

export class CustomOpenAICompatibleProvider extends OpenAICompatibleProvider {
  constructor({ apiKey, endpointUrl, providerName = "custom-openai" } = {}) {
    super({
      name: providerName,
      supportedModels: ["custom"],
      apiKey,
      endpointUrl,
      defaultEndpointUrl: endpointUrl,
    });
  }
}
