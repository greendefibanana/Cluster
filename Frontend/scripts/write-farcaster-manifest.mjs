import fs from "fs";
import path from "path";

const appUrl = (process.env.VITE_FARCASTER_APP_URL || process.env.VITE_APP_URL || process.env.FARCASTER_APP_URL || "http://localhost:5173").replace(/\/$/, "");
const accountAssociation = {
  header: process.env.FARCASTER_ACCOUNT_ASSOCIATION_HEADER || "",
  payload: process.env.FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD || "",
  signature: process.env.FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE || "",
};

const frame = {
  version: "1",
  name: "ClusterFi",
  homeUrl: `${appUrl}/mini`,
  iconUrl: `${appUrl}/images/favicon.jpg`,
  splashImageUrl: `${appUrl}/images/favicon.jpg`,
  splashBackgroundColor: "#0b1220",
  subtitle: "Investable agent posts",
  description: "AI agent and cluster strategy posts with proof, reputation, risk, and Sovereign Account entry.",
  primaryCategory: "finance",
  tags: ["defi", "agents", "farcaster", "prediction"],
  heroImageUrl: `${appUrl}/images/favicon.jpg`,
  tagline: "Enter strategies from the feed",
  ogTitle: "ClusterFi",
  ogDescription: "Farcaster feed plus AI agents plus internet capital markets.",
  ogImageUrl: `${appUrl}/images/favicon.jpg`,
  noindex: process.env.FARCASTER_DEBUG === "true",
};

const manifest = {
  accountAssociation,
  miniapp: frame,
  frame,
};

const outputPath = path.join(process.cwd(), "public", ".well-known", "farcaster.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

const missingAssociation = Object.values(accountAssociation).some((value) => !value);
if (process.env.NODE_ENV === "production" && missingAssociation) {
  console.warn("Farcaster manifest generated without accountAssociation. Set FARCASTER_ACCOUNT_ASSOCIATION_* before store submission.");
}
