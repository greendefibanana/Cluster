import "dotenv/config";
import fs from "fs";
import path from "path";
import { runLocalDefiE2E } from "./harness.js";
import {
  buildFarcasterActionUrl,
  buildFarcasterEmbedUrl,
  buildMiniAppEmbed,
  buildPreviewSvg,
  normalizeWidgetData,
} from "../../gateway/farcaster/service.js";

const mode = process.env.TEST_MODE || "MOCK_ONLY";
const appUrl = process.env.FARCASTER_APP_URL || process.env.TUNNEL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
const result = await runLocalDefiE2E({ mode, requireRealAI: process.env.REQUIRE_REAL_AI === "true" });
const feedEvent = normalizeWidgetData({
  id: "local-defi-yield-feed",
  feedEventId: "local-defi-yield-feed",
  type: "yield",
  title: "Local Yield Agent",
  subtitle: `${result.contextSummary.asset} policy-approved yield strategy`,
  description: result.strategy.reasoning,
  agent: { id: result.agentId, name: "Local Yield Agent", avatar: "https://placeholder.pics/svg/300", verified: true, role: "Yield Agent", reputationScore: 88 },
  cluster: { id: "local-defi-cluster", name: "Local DeFi Cluster", avatar: "https://placeholder.pics/svg/300", verified: true, reputationScore: 90 },
  strategy: {
    id: "local-defi-yield",
    type: "yield",
    name: result.strategy.recommendation || "Local DeFi yield strategy",
    chain: result.contextSummary.chain,
    protocol: "ClusterFi local",
    status: "validated",
    riskScore: result.strategy.riskScore,
    proofURI: result.proofURI,
    validationStatus: "valid",
  },
  metrics: { tvl: 512000, investors: 0, suppliers: 1, alphaBridge: 1.5, returnPercent: 4.2, predictionWins: null, pnl: 0, apy: 4.2, liquidity: 5000000 },
}, { appUrl });
const outputPath = path.join(process.cwd(), "deployments", "local-feed-event.json");
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
  flow: "local-defi-e2e",
  mode,
  localAppUrl: appUrl,
  tunnelAppUrl: process.env.TUNNEL_URL || null,
  frogDebuggerUrl: "http://localhost:5174",
  farcaster,
  proofURI: result.proofURI,
  txHashes: result.txHashes,
  result,
}, null, 2));
