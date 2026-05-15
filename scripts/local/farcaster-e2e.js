import "dotenv/config";
import {
  buildFarcasterActionUrl,
  buildFarcasterEmbedUrl,
  buildManifest,
  buildMiniAppEmbed,
  buildPreviewSvg,
  listFeedEvents,
} from "../../gateway/farcaster/service.js";

const appUrl = process.env.FARCASTER_APP_URL || process.env.TUNNEL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
const gatewayUrl = process.env.GATEWAY_URL || process.env.VITE_GATEWAY_URL || "http://localhost:3000";
const events = listFeedEvents();
const event = events.find((item) => item.feedEventId === "local-defi-yield-feed")
  || events.find((item) => item.feedEventId === "local-prediction-feed")
  || events[0];
const manifest = buildManifest({ appUrl });
const embed = buildMiniAppEmbed(event, { appUrl });
const checks = [
  ["manifest home", Boolean(manifest.miniapp?.homeUrl)],
  ["frame alias", Boolean(manifest.frame?.homeUrl)],
  ["enter strategy", embed.button?.title === "Enter Strategy"],
  ["preview image", buildPreviewSvg(event).includes("Enter Strategy")],
  ["mini route", buildFarcasterActionUrl(event, { appUrl }).includes("/mini/")],
  ["embed route", buildFarcasterEmbedUrl(event, { appUrl }).includes("/api/farcaster/embed/")],
];

const http = await checkHttpTargets([
  `${gatewayUrl.replace(/\/$/, "")}/api/farcaster/embed/${event.feedEventId}`,
  `${gatewayUrl.replace(/\/$/, "")}/api/widget/${event.feedEventId}`,
  `${appUrl.replace(/\/$/, "")}/mini`,
]);

const issues = checks.filter(([, ok]) => !ok).map(([name]) => name);
console.log(JSON.stringify({
  ok: issues.length === 0,
  issues,
  appUrl,
  gatewayUrl,
  tunnelUrl: process.env.TUNNEL_URL || null,
  frogDebuggerUrl: "http://localhost:5174",
  feedEventId: event.feedEventId,
  actionUrl: buildFarcasterActionUrl(event, { appUrl }),
  embedUrl: buildFarcasterEmbedUrl(event, { appUrl }),
  frameRoute: `/api/farcaster/frame/${event.feedEventId}`,
  http,
  note: "HTTP checks are marked skipped when the frontend or gateway is not running.",
}, null, 2));

async function checkHttpTargets(urls) {
  const results = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, { method: "GET" });
      results.push({ url, ok: response.ok, status: response.status });
    } catch (error) {
      results.push({ url, ok: null, skipped: true, reason: error.message });
    }
  }
  return results;
}
