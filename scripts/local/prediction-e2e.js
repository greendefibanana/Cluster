import "dotenv/config";
import fs from "fs";
import path from "path";
import { runLocalPredictionE2E } from "./harness.js";
import {
  buildFarcasterActionUrl,
  buildFarcasterEmbedUrl,
  buildMiniAppEmbed,
  buildPreviewSvg,
  normalizeWidgetData,
} from "../../gateway/farcaster/service.js";

const mode = process.env.TEST_MODE || "MOCK_ONLY";
const appUrl = process.env.FARCASTER_APP_URL || process.env.TUNNEL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
const result = await runLocalPredictionE2E({ mode, requireRealAI: process.env.REQUIRE_REAL_AI === "true" });
const firstMarket = result.markets[0] || {};
const feedEvent = normalizeWidgetData({
  id: "local-prediction-feed",
  feedEventId: "local-prediction-feed",
  type: "prediction",
  title: "Local Prediction Agent",
  subtitle: firstMarket.question || "Policy-approved prediction thesis",
  description: result.strategy.reasoning,
  agent: { id: result.agentId || "local-prediction-agent", name: "Local Prediction Agent", avatar: "https://placeholder.pics/svg/300", verified: true, role: "Prediction Agent", reputationScore: 87 },
  strategy: {
    id: "local-prediction-thesis",
    type: "prediction",
    name: firstMarket.question || result.strategy.recommendation || "Local prediction thesis",
    chain: "Polygon",
    protocol: "Polymarket",
    status: "validated",
    riskScore: result.strategy.riskScore,
    proofURI: result.proofURI,
    validationStatus: "valid",
  },
  metrics: { tvl: 42500, investors: 1, suppliers: 0, alphaBridge: 2.1, returnPercent: 0, predictionWins: 0, pnl: 0, apy: null, liquidity: Number(firstMarket.liquidity || 0) },
}, { appUrl });
const outputPath = path.join(process.cwd(), "deployments", "local-prediction-feed-event.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(feedEvent, null, 2));

const farcaster = {
  feedEventPath: outputPath,
  actionUrl: buildFarcasterActionUrl(feedEvent, { appUrl }),
  embedUrl: buildFarcasterEmbedUrl(feedEvent, { appUrl }),
  miniAppEmbed: buildMiniAppEmbed(feedEvent, { appUrl }),
  previewBytes: Buffer.byteLength(buildPreviewSvg(feedEvent)),
};

console.log(JSON.stringify({
  ok: true,
  flow: "local-prediction-e2e",
  mode,
  localAppUrl: appUrl,
  tunnelAppUrl: process.env.TUNNEL_URL || null,
  frogDebuggerUrl: "http://localhost:5174",
  farcaster,
  proofURI: result.proofURI,
  txHashes: result.txHashes,
  result,
}, null, 2));
