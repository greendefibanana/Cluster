/**
 * launch-meme.js
 *
 * End-to-end meme agent loop:
 *   1. Scan alpha (DGrid alpha_scout)
 *   2. Generate concept (DGrid meme_creator)
 *   3. Generate images (stub / placeholder)
 *   4. User confirmation (stdin)
 *   5. Deploy token on BSC testnet
 *   6. Update agent score
 *
 * Usage:  node scripts/launch-meme.js
 * Requires gateway running at GATEWAY_URL (default http://localhost:3000)
 */

import "dotenv/config";
import readline from "readline";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

/* ---------- helpers ---------- */

async function post(path, body) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`${path} failed: ${err.error || res.statusText}`);
  }
  return res.json();
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

function printJson(label, obj) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${"─".repeat(60)}`);
  console.log(JSON.stringify(obj, null, 2));
}

/* ---------- main pipeline ---------- */

async function main() {
  console.log("🐸 Meme Agent Launch Pipeline\n");

  // --- Step 1: Scan ---
  const context = process.env.MEME_CONTEXT || "trending meme coins on BSC, Pepe variants, AI agent tokens, dog coins";
  const keywords = (process.env.MEME_KEYWORDS || "pepe,doge,ai,moon").split(",").map((k) => k.trim());

  console.log("📡 Step 1: Scanning alpha...");
  console.log(`   Context: ${context}`);
  console.log(`   Keywords: ${keywords.join(", ")}`);

  const scanResult = await post("/meme/scan", { context, keywords });
  const theses = scanResult.result?.theses || [];

  if (theses.length === 0) {
    console.log("❌ No theses returned. Exiting.");
    process.exit(0);
  }

  printJson("Alpha Scout Results", theses);

  // --- Step 2: User selects thesis ---
  console.log("\nAvailable theses:");
  theses.forEach((t, i) => {
    const icon = t.verdict === "launch" ? "🟢" : "🔴";
    console.log(`  [${i + 1}] ${icon} ${t.keyword} (signal: ${t.signal_strength}, risk: ${t.risk}) — ${t.verdict}`);
  });

  const selection = await ask("\nSelect a thesis [1-3] or 'q' to quit: ");
  if (selection.toLowerCase() === "q") {
    console.log("Exiting.");
    process.exit(0);
  }

  const selectedIndex = parseInt(selection, 10) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= theses.length) {
    console.log("Invalid selection. Exiting.");
    process.exit(1);
  }

  const selectedThesis = theses[selectedIndex];
  console.log(`\n✅ Selected: "${selectedThesis.keyword}"`);

  // --- Step 3: Generate concept ---
  console.log("\n🎨 Step 2: Generating concept...");
  const conceptResult = await post("/meme/concept", { thesis: selectedThesis });
  const concept = conceptResult.result || {};

  printJson("Meme Concept", concept);

  // --- Step 4: Generate images ---
  console.log("\n🖼️  Step 3: Generating images...");
  const imageResult = await post("/meme/image", {
    prompt: concept.image_prompt || `A meme coin mascot for ${concept.name}`,
    name: concept.name,
    ticker: concept.ticker
  });

  printJson("Image Assets", imageResult.assets);

  // --- Step 5: Confirm launch ---
  console.log("\n📋 Launch Summary:");
  console.log(`   Name:   ${concept.name}`);
  console.log(`   Ticker: $${concept.ticker}`);
  console.log(`   Lore:   ${concept.lore}`);
  console.log(`   Copy:   ${concept.launch_copy}`);
  console.log(`   Risk:   ${concept.risk_notes}`);

  const confirm = await ask("\n🚀 Deploy this token? [y/N]: ");
  if (confirm.toLowerCase() !== "y") {
    console.log("Launch cancelled.");
    process.exit(0);
  }

  // --- Step 6: Deploy ---
  console.log("\n⚡ Step 4: Deploying token...");
  const seedLiquidity = (process.env.MEME_SEED_LIQUIDITY || "false").toLowerCase() === "true";

  const launchResult = await post("/meme/launch", {
    name: concept.name,
    symbol: concept.ticker,
    supply: process.env.MEME_SUPPLY || undefined,
    seedLiquidity
  });

  printJson("Deployment Result", launchResult);

  if (launchResult.tokenAddress) {
    console.log(`\n🎉 Token deployed!`);
    console.log(`   Address:  ${launchResult.tokenAddress}`);
    console.log(`   TX Hash:  ${launchResult.txHash}`);
    console.log(`   Deployer: ${launchResult.deployer}`);
    if (launchResult.liquiditySeeded) {
      console.log(`   Liquidity: ✅ Seeded`);
    }
  } else {
    console.log("\n⚠️  Token address not found in response. Check transaction on explorer.");
  }

  console.log("\n=== Pipeline complete ===");
}

main().catch((e) => { console.error("Pipeline error:", e.message); process.exit(1); });
