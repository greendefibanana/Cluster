import "dotenv/config";
import { buildDefiMarketContext } from "../../packages/intelligence/data-adapters/defillama/index.js";
import { buildPredictionMarketContext } from "../../packages/intelligence/data-adapters/prediction/index.js";
import { buildNewsContext } from "../../packages/intelligence/data-adapters/news/index.js";
import { loadDefiContext, loadNewsContext, loadPredictionContext } from "./harness.js";

const command = process.argv[2] || commandFromLifecycle("demo:data:") || "all";
const args = parseArgs(process.argv.slice(3));
const mode = args.mode || process.env.TEST_MODE || "MOCK_ONLY";

const result = await run(command);
console.log(JSON.stringify({ mode, command, ...result }, null, 2));

async function run(name) {
  switch (name) {
    case "defillama": {
      const context = mode === "MOCK_ONLY"
        ? await loadDefiContext("MOCK_ONLY")
        : await buildDefiMarketContext({ chain: args.chain || process.env.LOCAL_DEFI_CHAIN || "Ethereum", asset: args.asset || process.env.LOCAL_DEFI_ASSET || "USDC", minTvlUsd: Number(args.minTvlUsd || 100_000) });
      return { context };
    }
    case "prediction": {
      const news = mode === "MOCK_ONLY" ? [] : (await loadNewsContext(mode)).items;
      const context = mode === "MOCK_ONLY"
        ? await loadPredictionContext("MOCK_ONLY", news)
        : await buildPredictionMarketContext({ query: args.query || process.env.LOCAL_PREDICTION_QUERY || "bitcoin", news, limit: Number(args.limit || 5) });
      return { context };
    }
    case "news": {
      const context = mode === "MOCK_ONLY"
        ? await loadNewsContext("MOCK_ONLY")
        : await buildNewsContext({ query: args.query || process.env.LOCAL_PREDICTION_QUERY || "bitcoin", rssFeeds: (process.env.LOCAL_RSS_FEEDS || "").split(",").filter(Boolean), limit: Number(args.limit || 5) });
      return { context };
    }
    case "all": {
      const defi = await run("defillama");
      const news = await run("news");
      const prediction = await run("prediction");
      return { defi: defi.context, news: news.context, prediction: prediction.context };
    }
    default:
      throw new Error(`Unknown local data command: ${name}`);
  }
}

function parseArgs(values) {
  const parsed = {};
  for (let i = 0; i < values.length; i += 1) {
    if (!values[i].startsWith("--")) continue;
    const key = values[i].slice(2);
    const next = values[i + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function commandFromLifecycle(prefix) {
  const event = process.env.npm_lifecycle_event || "";
  return event.startsWith(prefix) ? event.slice(prefix.length) : null;
}
