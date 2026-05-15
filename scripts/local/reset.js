import fs from "fs";
import path from "path";

const targets = [
  path.join(process.cwd(), "deployments", "local-mantle.json"),
  path.join(process.cwd(), "deployments", "local-feed-event.json"),
  path.join(process.cwd(), "deployments", "local-prediction-feed-event.json"),
  path.join(process.cwd(), "deployments", "farcaster-demo-feed.json"),
  path.join(process.cwd(), "deployments", "local-0g"),
];

const removed = [];
for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  const stat = fs.statSync(target);
  if (stat.isDirectory()) fs.rmSync(target, { recursive: true, force: true });
  else fs.rmSync(target, { force: true });
  removed.push(target);
}

console.log(JSON.stringify({ ok: true, removed }, null, 2));
