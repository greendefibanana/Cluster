import { OpenAICompatibleProvider } from "./base.js";

export class DgridProvider extends OpenAICompatibleProvider {
  constructor({ apiKey = process.env.DGRID_API_KEY, endpointUrl = process.env.DGRID_API_URL } = {}) {
    super({
      name: "dgrid",
      supportedModels: ["openai/gpt-4o-mini", "openai/gpt-4o", "deepseek/deepseek-r1", "google/gemini-2.5-flash"],
      apiKey,
      endpointUrl,
      defaultEndpointUrl: endpointUrl,
    });
  }
}
