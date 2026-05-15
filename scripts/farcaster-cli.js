import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  buildFarcasterCastText,
  buildFarcasterEmbedUrl,
  buildManifest,
  buildMiniAppEmbed,
  buildPreviewSvg,
  listFeedEvents,
  shareStrategyToFarcaster,
  validateFarcasterProductionConfig,
} from "../gateway/farcaster/service.js";

const command = process.argv[2] || "widgets";
const args = parseArgs(process.argv.slice(3));
const appUrl = args.appUrl || process.env.FARCASTER_APP_URL || process.env.TUNNEL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const result = await run(command);
console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));

async function run(name) {
  switch (name) {
    case "seed": {
      const filePath = path.join(process.cwd(), "deployments", "farcaster-demo-feed.json");
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(listFeedEvents(), null, 2));
      return { filePath, count: listFeedEvents().length };
    }
    case "widgets":
      return { widgets: listFeedEvents().map((event) => ({ id: event.feedEventId, type: event.type, actionUrl: event.action.url })) };
    case "prediction": {
      const event = listFeedEvents().find((item) => item.type === "prediction");
      return { event, castText: buildFarcasterCastText(event), share: shareStrategyToFarcaster(event) };
    }
    case "defi": {
      const event = listFeedEvents().find((item) => ["defi", "yield", "lp", "perps"].includes(item.type));
      return { event, castText: buildFarcasterCastText(event), share: shareStrategyToFarcaster(event) };
    }
    case "validate": {
      const events = listFeedEvents();
      const issues = [];
      const manifest = buildManifest({ appUrl });
      if (!manifest.miniapp?.homeUrl) issues.push("manifest homeUrl missing");
      if (!manifest.frame?.homeUrl) issues.push("manifest frame alias missing");
      if (!/^https:\/\//i.test(appUrl) && args.production) issues.push("production Farcaster app URL must use HTTPS");
      if (args.production || process.env.FARCASTER_PRODUCTION_VALIDATE === "true") {
        issues.push(...validateFarcasterProductionConfig({ appUrl }).issues);
      }
      for (const event of events) {
        const embed = buildMiniAppEmbed(event, { appUrl });
        if (embed.button.title !== "Enter Strategy") issues.push(`${event.feedEventId}: wrong button title`);
        if (!embed.imageUrl.includes("/api/farcaster/og/")) issues.push(`${event.feedEventId}: missing OG URL`);
        if (!event.action.url.includes("/mini/")) issues.push(`${event.feedEventId}: action URL does not target Mini App`);
      }
      return { ok: issues.length === 0, issues, manifest, embedUrls: events.map((event) => buildFarcasterEmbedUrl(event, { appUrl })) };
    }
    case "test": {
      const event = listFeedEvents()[0];
      const svg = buildPreviewSvg(event);
      return { ok: svg.includes("Enter Strategy"), feedEventId: event.feedEventId, previewBytes: Buffer.byteLength(svg), embed: buildMiniAppEmbed(event, { appUrl }) };
    }
    default:
      throw new Error(`Unknown Farcaster command: ${name}`);
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
