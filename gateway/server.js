import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

/* ---------- startup validation ---------- */
if (!process.env.BSC_TESTNET_RPC_URL) {
  console.error("FATAL: BSC_TESTNET_RPC_URL is required");
  process.exit(1);
}
/* ---------- load deployment addresses ---------- */
let deployment = null;
try {
  const deployPath = path.join(process.cwd(), "deployments", "bsc-testnet.json");
  deployment = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  console.log(`Loaded deployment (chain ${deployment.chainId})`);
} catch {
  console.warn("WARNING: deployments/bsc-testnet.json not found — deploy contracts first");
}

function loadEnvOverrides(...pathsToRead) {
  return pathsToRead.reduce((acc, filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = Object.fromEntries(
          fs.readFileSync(filePath, "utf8")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("#") && line.includes("="))
            .map((line) => {
              const separator = line.indexOf("=");
              return [line.slice(0, separator), line.slice(separator + 1)];
            })
        );
        return { ...acc, ...parsed };
      }
    } catch {
      // Ignore local env parse failures and fall back to process.env.
    }
    return acc;
  }, {});
}

function readConfig(envOverrides, key) {
  return process.env[key] || envOverrides[key] || "";
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

const envOverrides = loadEnvOverrides(
  path.join(process.cwd(), ".env.local"),
  path.join(process.cwd(), "Frontend", ".env"),
  path.join(process.cwd(), "Frontend", ".env.local")
);

const supabaseUrl = readConfig(envOverrides, "SUPABASE_URL") || readConfig(envOverrides, "VITE_SUPABASE_URL");
const supabaseKey =
  readConfig(envOverrides, "SUPABASE_SERVICE_ROLE_KEY") ||
  readConfig(envOverrides, "SUPABASE_ANON_KEY") ||
  readConfig(envOverrides, "VITE_SUPABASE_ANON_KEY");
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const autoFeedEnabled = isTruthy(readConfig(envOverrides, "AUTO_FEED_ENABLED"));
const autoFeedIntervalMs = Number(readConfig(envOverrides, "AUTO_FEED_INTERVAL_MS") || 3_600_000);
const autoFeedInitialDelayMs = Number(readConfig(envOverrides, "AUTO_FEED_INITIAL_DELAY_MS") || autoFeedIntervalMs);

const feedPersonas = [
  {
    agentId: "1",
    authorName: "Nexus Prime",
    authorHandle: "0x4A5B...a227",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAcmGHTKEvr-GaJNXJktNXvai6DPGr8ek6wiccqqS_cqKEVOBRZGEjTC-Mf8cAQUMwkCA5WSamGnXWglBYfao1f8r2E_ezJRBquSgkVz6am1Jy7nt6mgNeAdyEzxYS8UZBJHFFVpqOfl-qX5w4t7hmIbyUD4bU9ctkX-pepoZdw1CwjrPp8EJ1c1cAeajEI3gCrD7K9fOmkszE8VR8DAuR1TKtSicOJkI7cTtxURnFvFOwqoHfx_eMGuv0ZiWYWH3H0OrcLVktSkow",
    roleLabel: "Arch-Mage of Arbitrage & Liquidity Pooling",
    score: 94,
    mode: "yield",
    tbaAddress: "0x7F4a4D219b8D6D3fA32C4d8A0Cce799592B19011",
  },
  {
    agentId: "2",
    authorName: "Cypher Ghost",
    authorHandle: "0x8B35...9614",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBlliEfqEu8pxop9pHqtMIV9rgzOVQ5sMc7R6nmUVrLvctTNDoxnfx3fSOBjLtQgo3YcXFkMK7dHcnK2lTB8RlSgSTowq14cqAN6MEucjhfsRwvqRQWc3aixuWaXFBA9Mx8BGddLCOs9pXWwXTJoeB-q1teFMu_Z3YZO9E1IseIqKtFPlQX_k977MnWfNfAHMub9degz19sxevQMqrlzHzIyWj-bTnCxxyV_feBXNQa-jgvI0PJaRtKyDI0Iv81lUTkhtUdLK1lIbU",
    roleLabel: "Master of MEV Extraction",
    score: 88,
    mode: "yield",
    tbaAddress: "0x2A813A0878B1cB2586713E308C16B944934d2F82",
  },
  {
    agentId: "3",
    authorName: "Sight-3",
    authorHandle: "0x3D4F...a940",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCYZyCPKnXCd38xXdNOifS6Xy0TZGV-9u4QoQXwUynrtEzKY0oOWAwBjk7Iv2gvkwZTmDwlXHLOmMXin0IoiqU_UGVYTWujRqxHqlpv9O1ubU0TVcyuAeeBp91kgF7pjn50FNP5Bwo93XvuNswQND94o_djkKBMJMaFldLM15sKzi6q1niBSlkNPPisaDkOp39pplzfvAVj8dNBcSkWIU8jd4pShc3RV3e2DS3BLSTDgC7WFUQAxPV4OdiMs2gdlnmT20h_6n0OTJs",
    roleLabel: "Data Oracle of Narrative Rotation",
    score: 91,
    mode: "social",
    tbaAddress: "0x9d7F14aC9C1E815dEa4B950532296B95f4F4A807",
  },
];

const app = express();
app.use(cors());
app.use(express.json());

/* ---------- rate-limit (simple in-memory) ---------- */
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;

function rateLimit(req, res, next) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW;
  }
  entry.count += 1;
  rateLimitMap.set(ip, entry);
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "rate limit exceeded" });
  }
  next();
}
app.use(rateLimit);

/* ---------- provider + ABIs ---------- */
const provider = new ethers.JsonRpcProvider(process.env.BSC_TESTNET_RPC_URL);

const agentAbi = [
  "function tbas(uint256) view returns (address)"
];
const skillAbi = [
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
  "function totalSkillTypes() view returns (uint256)",
  "function uri(uint256 id) view returns (string)"
];
const accountAbi = [
  "function token() view returns (uint256 chainId, address tokenContract, uint256 tokenId)"
];

/* ---------- system prompts ---------- */
const systemPrompts = {
  quant: "You are a quant worker agent. Return concise, structured steps for market-neutral or execution-sensitive actions.",
  meme: "You are a meme deployer agent. Focus on token launch ops, narrative timing, and go/no-go checks.",
  lp: "You are an LP manager agent. Focus on inventory risk, slippage, and liquidity provisioning decisions.",
  alpha_scout: `You are an alpha-scout agent specialised in meme-coin opportunity detection.
You receive market context (trending keywords, social signals, token metadata, curated URLs).
Analyse the data and return a JSON object with this exact schema:
{
  "theses": [
    {
      "rank": 1,
      "keyword": "string",
      "signal_strength": 0.0-1.0,
      "reasoning": "string",
      "verdict": "launch" | "skip",
      "risk": "low" | "medium" | "high"
    }
  ]
}
Return exactly 3 ranked theses. Be opinionated. Be concise.`,
  meme_creator: `You are a meme-concept creative agent.
You receive a launch thesis (keyword, reasoning, signal strength).
Generate a complete meme-token concept and return JSON with this exact schema:
{
  "name": "string",
  "ticker": "string (3-5 chars, uppercase)",
  "lore": "string (2-3 sentences of backstory)",
  "launch_copy": "string (tweet-length hype copy)",
  "image_prompt": "string (detailed prompt for generating a mascot/logo)",
  "risk_notes": "string (honest risk disclaimer)"
}
Be creative, funny, and memetic. Tickers should be catchy.`,
  deployer: `You are a token deployment agent.
You confirm deployment parameters and return a structured deployment plan as JSON:
{
  "token_name": "string",
  "token_symbol": "string",
  "initial_supply": "string (in wei)",
  "seed_liquidity": true | false,
  "liquidity_amount_tokens": "string",
  "liquidity_amount_native": "string",
  "confirmed": true
}`,
  social: `You are an autonomous social feed content creator agent.
You analyze the current market, on-chain activity, and meme trends.
Generate an engaging, insightful, or witty post.
Return a JSON object with this exact schema:
{
  "insightTitle": "string (short, catchy)",
  "content": "string (the main body of the post, 2-3 sentences max)",
  "tags": ["tag1", "tag2"],
  "strategySummary": "string (1 sentence summary of your thought process)"
}
Be conversational, opinionated, and use appropriate crypto slang.`,
  default: "You are a Web3 worker agent operating on BSC testnet."
};

/* ============================================================
   EXISTING: /agent/execute
   ============================================================ */
app.post("/agent/execute", async (req, res) => {
  try {
    const { tbaAddress, message, agentNftAddress, skillNftAddress, requiredCapability, action } = req.body;
    if (!tbaAddress || !message || !agentNftAddress || !skillNftAddress) {
      return res.status(400).json({ error: "tbaAddress, message, agentNftAddress, skillNftAddress are required" });
    }

    const account = new ethers.Contract(tbaAddress, accountAbi, provider);
    const [, tokenContract, agentId] = await account.token();
    if (tokenContract.toLowerCase() !== agentNftAddress.toLowerCase()) {
      return res.status(403).json({ error: "TBA is not bound to the supplied Agent NFT contract" });
    }

    const agentContract = new ethers.Contract(agentNftAddress, agentAbi, provider);
    const expectedTba = await agentContract.tbas(agentId);
    if (expectedTba.toLowerCase() !== tbaAddress.toLowerCase()) {
      return res.status(403).json({ error: "Agent/TBA mismatch" });
    }

    const skills = await getSkillsForBackpack(skillNftAddress, tbaAddress);
    const capability = requiredCapability || capabilityForAction(action);
    if (capability && !skills.some((skill) => skill.capabilityTag === capability)) {
      return res.status(403).json({ error: `Agent lacks required capability: ${capability}` });
    }

    const selectedSkill = selectBestSkill(skills, capability);
    const llmResponse = await routeViaDGrid(selectedSkill, message, tbaAddress);

    return res.json({
      agentId: agentId.toString(),
      tbaAddress,
      selectedSkill,
      response: llmResponse
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/* ============================================================
   MEME LOOP: /meme/scan
   Alpha scout — analyses market context, returns ranked theses
   ============================================================ */
app.post("/meme/scan", async (req, res) => {
  try {
    const { context, keywords, signals } = req.body;
    if (!context && !keywords) {
      return res.status(400).json({ error: "context or keywords required" });
    }

    const userMessage = [
      context || "",
      keywords ? `Trending keywords: ${Array.isArray(keywords) ? keywords.join(", ") : keywords}` : "",
      signals ? `Social signals: ${JSON.stringify(signals)}` : ""
    ].filter(Boolean).join("\n");

    const result = await callDGrid("alpha_scout", userMessage, "scan");
    return res.json({ step: "scan", result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/* ============================================================
   MEME LOOP: /meme/concept
   Creative agent — turns thesis into name/ticker/lore/copy
   ============================================================ */
app.post("/meme/concept", async (req, res) => {
  try {
    const { thesis } = req.body;
    if (!thesis) {
      return res.status(400).json({ error: "thesis object required" });
    }

    const userMessage = `Generate a meme token concept based on this thesis:\n${JSON.stringify(thesis, null, 2)}`;
    const result = await callDGrid("meme_creator", userMessage, "concept");
    return res.json({ step: "concept", result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/* ============================================================
   MEME LOOP: /meme/image
   Image generation — returns placeholder/stub asset paths
   ============================================================ */
app.post("/meme/image", async (req, res) => {
  try {
    const { prompt, name, ticker } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "prompt required" });
    }

    // Stub image generation — returns placeholder URLs.
    // In production, integrate Stability AI / Replicate / DALL-E here.
    const assets = {
      mascot: `https://placehold.co/512x512/f3ba2f/111827?text=${encodeURIComponent(ticker || "MEME")}`,
      logo: `https://placehold.co/256x256/111827/f3ba2f?text=${encodeURIComponent(ticker || "MEME")}`,
      banner: `https://placehold.co/1200x400/0b1220/f3ba2f?text=${encodeURIComponent(name || "Meme Token")}`,
      square: `https://placehold.co/400x400/f3ba2f/0b1220?text=${encodeURIComponent(ticker || "MEME")}`,
      prompt_used: prompt
    };

    return res.json({ step: "image", assets });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/* ============================================================
   MEME LOOP: /meme/launch
   Deploy token via WorkerTokenFactory + optional liquidity
   ============================================================ */
app.post("/meme/launch", async (req, res) => {
  try {
    const { name, symbol, supply, seedLiquidity } = req.body;
    if (!name || !symbol) {
      return res.status(400).json({ error: "name and symbol required" });
    }

    return res.status(410).json({
      error: "Server-side meme launch is disabled. Use connected-wallet launch from the frontend.",
    });

    const key = process.env.DEPLOYER_PRIVATE_KEY;
    if (!key) {
      return res.status(500).json({ error: "DEPLOYER_PRIVATE_KEY not configured on server" });
    }

    const wallet = new ethers.Wallet(key, provider);
    const factoryAddress = deployment?.contracts?.tokenFactory || process.env.TOKEN_FACTORY_ADDRESS;
    if (!factoryAddress) {
      return res.status(500).json({ error: "Token factory address not available — deploy contracts first" });
    }

    const factoryAbi = [
      "function deployToken(string name, string symbol, uint256 supply, address tokenOwner) returns (address)",
      "event WorkerTokenDeployed(address indexed token, address indexed owner, string name, string symbol, uint256 supply)"
    ];
    const factoryInterface = new ethers.Interface(factoryAbi);

    const totalSupply = supply || ethers.parseUnits("1000000000", 18).toString();

    // Try routing through meme-swarm's agent via Execution Hub
    // If not configured, fall back to direct deployment
    let useAgentDeployment = false;
    let tx;
    try {
      const swarmPath = path.join(process.cwd(), "deployments", "meme-swarm.json");
      const swarmData = JSON.parse(fs.readFileSync(swarmPath, "utf8"));
      const launcher = swarmData.agents.find(a => a.role === "deployer");
      const hubAddress = deployment?.contracts?.executionHub;

      if (launcher && hubAddress) {
        useAgentDeployment = true;
        
        const hubAbi = ["function executeSwarmWorkerAction(uint256 swarmId, address swarmTba, uint256 workerAgentId, address workerTba, address target, uint256 value, bytes calldata data) external returns (bytes memory)"];
        const hub = new ethers.Contract(hubAddress, hubAbi, wallet);
        
        const deployTokenData = factoryInterface.encodeFunctionData("deployToken", [name, symbol, totalSupply, wallet.address]);
        
        tx = await hub.executeSwarmWorkerAction(
          swarmData.swarmId,
          swarmData.swarmTba,
          launcher.id,
          launcher.tba,
          factoryAddress,
          0,
          deployTokenData
        );
      }
    } catch(e) {
      console.log("Could not use agent deployment, falling back to direct...", e.message);
    }

    if (!tx) {
      const factory = new ethers.Contract(factoryAddress, factoryAbi, wallet);
      tx = await factory.deployToken(name, symbol, totalSupply, wallet.address);
    }
    
    const receipt = await tx.wait();

    const deployEvent = receipt.logs.find(
      (log) => {
        try { return factoryInterface.parseLog(log)?.name === "WorkerTokenDeployed"; }
        catch { return false; }
      }
    );

    let tokenAddress = null;
    if (deployEvent) {
      const parsed = factoryInterface.parseLog(deployEvent);
      tokenAddress = parsed.args[0];
    }

    const result = {
      step: "launch",
      tokenAddress,
      name,
      symbol,
      supply: totalSupply,
      txHash: receipt.hash,
      deployer: wallet.address,
      liquiditySeeded: false
    };

    // Optional liquidity seeding
    const lmAddress = deployment?.contracts?.liquidityManager || process.env.LIQUIDITY_MANAGER_ADDRESS;
    if (seedLiquidity && lmAddress && tokenAddress) {
      try {
        const lmAbi = [
          "function seedLiquidityWithNative(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountNativeMin, address lpRecipient, uint256 deadline) payable returns (uint256, uint256, uint256)"
        ];
        const tokenAbi = ["function approve(address spender, uint256 amount) returns (bool)"];
        const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, wallet);

        const seedAmount = ethers.parseUnits("100000000", 18);
        const nativeAmount = ethers.parseEther("0.01");

        await (await tokenContract.approve(lmAddress, seedAmount)).wait();
        const lm = new ethers.Contract(lmAddress, lmAbi, wallet);
        const lmTx = await lm.seedLiquidityWithNative(
          tokenAddress, seedAmount, 0, 0, wallet.address,
          BigInt(Math.floor(Date.now() / 1000) + 600),
          { value: nativeAmount }
        );
        await lmTx.wait();
        result.liquiditySeeded = true;
      } catch (lmErr) {
        result.liquidityError = lmErr.message;
      }
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/* ============================================================
   FEED LOOP: /feed/generate
   Social agent — generates a feed post based on context
   ============================================================ */
app.post("/feed/generate", async (req, res) => {
  try {
    const { agentName, roleLabel, context } = req.body;
    const userMessage = context ? `Market context: ${context}\nAgent Name: ${agentName}\nRole: ${roleLabel}\nCreate a post.` : `Agent Name: ${agentName}\nRole: ${roleLabel}\nCreate a new post about current market or strategy.`;
    const result = await callDGrid("social", userMessage, "generate_post");
    return res.json({ result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/* ---------- serve dashboard ---------- */
app.use("/dashboard", express.static("dashboard"));

/* ---------- helper functions ---------- */

function randomChartPoints() {
  return Array.from({ length: 7 }, () => Math.floor(Math.random() * 80) + 20);
}

async function persistGeneratedFeedPost(persona, context) {
  if (!supabase) {
    throw new Error("Supabase not configured for gateway auto feed");
  }

  const userMessage = context
    ? `Market context: ${context}\nAgent Name: ${persona.authorName}\nRole: ${persona.roleLabel}\nCreate a post.`
    : `Agent Name: ${persona.authorName}\nRole: ${persona.roleLabel}\nCreate a new post about current market or strategy.`;
  const result = await callDGrid("social", userMessage, "generate_post");
  const createdAt = new Date().toISOString();

  const row = {
    id: randomUUID(),
    agent_id: persona.agentId,
    author_name: persona.authorName,
    author_handle: persona.authorHandle,
    avatar_url: persona.avatarUrl,
    role_label: persona.roleLabel,
    score: persona.score,
    mode: persona.mode,
    content: result.content || "Generated content",
    insight_title: result.insightTitle || null,
    strategy_summary: result.strategySummary || "",
    tags: Array.isArray(result.tags) ? result.tags : [],
    likes: 0,
    comments_count: 0,
    shares: 0,
    chart_points: randomChartPoints(),
    created_at: createdAt,
    tba_address: persona.tbaAddress,
    capability_tag: "creative_content",
  };

  const { error } = await supabase.from("feed_posts").insert(row);
  if (error) {
    throw error;
  }

  console.log(`Auto feed post created for ${persona.authorName} at ${createdAt}`);
}

function startAutoFeedLoop() {
  if (!autoFeedEnabled) {
    return;
  }

  if (!supabase) {
    console.warn("WARNING: AUTO_FEED_ENABLED is set, but Supabase is not configured for the gateway");
    return;
  }

  const tick = async () => {
    try {
      const persona = feedPersonas[Math.floor(Math.random() * feedPersonas.length)];
      await persistGeneratedFeedPost(persona);
    } catch (error) {
      console.error("Auto feed generation failed:", error.message);
    }
  };

  console.log(`Auto feed enabled; generating one shared post every ${autoFeedIntervalMs} ms`);

  if (autoFeedInitialDelayMs <= 0) {
    void tick();
  } else {
    setTimeout(() => {
      void tick();
    }, autoFeedInitialDelayMs);
  }

  setInterval(() => {
    void tick();
  }, autoFeedIntervalMs);
}

async function getSkillsForBackpack(skillNftAddress, tbaAddress) {
  const contract = new ethers.Contract(skillNftAddress, skillAbi, provider);
  const skills = [];
  const totalSkillTypes = Number(await contract.totalSkillTypes());

  for (let skillId = 1; skillId <= totalSkillTypes; skillId += 1) {
    const balance = await contract.balanceOf(tbaAddress, skillId);
    if (balance === 0n) {
      continue;
    }

    const tokenUri = await contract.uri(skillId);
    const metadata = decodeDataUriJson(tokenUri);
    const skillMarkdown = Buffer.from(metadata.skill_md_b64 || "", "base64").toString("utf8");
    skills.push({
      tokenId: String(skillId),
      name: metadata.name,
      skillType: extractAttribute(metadata.attributes, "Skill Type") || inferSkillType(skillMarkdown),
      capabilityTag: extractAttribute(metadata.attributes, "Capability") || null,
      amount: balance.toString(),
      skillMarkdown
    });
  }

  return skills;
}

function decodeDataUriJson(uri) {
  try {
    const base64 = uri.split(",")[1];
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    return { name: "Unknown", attributes: [] };
  }
}

function extractAttribute(attributes, traitType) {
  const hit = (attributes || []).find((item) => item.trait_type === traitType);
  return hit ? String(hit.value).toLowerCase() : null;
}

function inferSkillType(markdown) {
  const lower = markdown.toLowerCase();
  if (lower.includes("quant")) return "quant";
  if (lower.includes("meme")) return "meme";
  if (lower.includes("liquidity") || lower.includes("lp")) return "lp";
  if (lower.includes("social") || lower.includes("content")) return "social";
  return "default";
}

function capabilityForAction(action) {
  if (!action) return null;
  const normalized = String(action).toLowerCase();
  if (normalized === "post") return "creative_content";
  if (normalized === "leverage") return "margin_trading";
  if (normalized === "seed_liquidity") return "lp_management";
  return null;
}

function selectBestSkill(skills, capability) {
  if (capability) {
    const matching = skills.find((skill) => skill.capabilityTag === capability);
    if (matching) {
      return matching;
    }
  }

  return skills[0] || {
    tokenId: null,
    name: "Fallback Skill",
    skillType: "default",
    capabilityTag: null,
    skillMarkdown: "Default operational skill."
  };
}

async function callDGrid(agentType, userMessage, step) {
  const apiUrl = process.env.DGRID_API_URL;
  const apiKey = process.env.DGRID_API_KEY;
  const model = pickModelForSkill(agentType);
  const systemPrompt = systemPrompts[agentType] || systemPrompts.default;

  if (!apiUrl || !apiKey) {
    return mockDGridResponse(agentType, userMessage, step);
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`DGrid error ${response.status}`);
  }

  const data = await response.json();
  try {
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch {
    return data;
  }
}

async function routeViaDGrid(skill, userMessage, tbaAddress) {
  const apiUrl = process.env.DGRID_API_URL;
  const apiKey = process.env.DGRID_API_KEY;
  const model = pickModelForSkill(skill.skillType);

  if (!apiUrl || !apiKey) {
    return {
      mode: "mock",
      model,
      content: `Mocked DGrid response for ${skill.skillType} agent ${tbaAddress}: ${userMessage}`
    };
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompts[skill.skillType] || systemPrompts.default
        },
        {
          role: "system",
          content: `Authenticated TBA: ${tbaAddress}\nSkill Markdown:\n${skill.skillMarkdown}`
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`DGrid error ${response.status}`);
  }

  return response.json();
}

function mockDGridResponse(agentType, userMessage, step) {
  if (agentType === "alpha_scout") {
    return {
      theses: [
        { rank: 1, keyword: "pepe renaissance", signal_strength: 0.85, reasoning: "Pepe variants resurging on CT with 3x volume spike", verdict: "launch", risk: "medium" },
        { rank: 2, keyword: "ai dog", signal_strength: 0.72, reasoning: "AI + dog coin narrative gaining traction on TikTok", verdict: "launch", risk: "low" },
        { rank: 3, keyword: "quantum cat", signal_strength: 0.45, reasoning: "Niche meme, limited social reach", verdict: "skip", risk: "high" }
      ]
    };
  }

  if (agentType === "meme_creator") {
    return {
      name: "PepeVault",
      ticker: "PVLT",
      lore: "Born from the ancient meme vaults, PepeVault is the guardian of rare Pepes. Legend says holding PVLT unlocks the rarest Pepe of all.",
      launch_copy: "🐸 The vault is open. $PVLT is the key to the rarest Pepes in existence. Are you worthy? 🔑",
      image_prompt: "A cartoon frog wearing a golden crown sitting on a pile of treasure in a stone vault, pixel art style, green and gold color scheme, meme coin mascot",
      risk_notes: "Meme token with no intrinsic value. Testnet only. Do not invest real funds."
    };
  }

  if (agentType === "deployer") {
    return {
      token_name: "PepeVault",
      token_symbol: "PVLT",
      initial_supply: "1000000000000000000000000000",
      seed_liquidity: false,
      confirmed: true
    };
  }

  return { mode: "mock", step, content: `Mock response for ${agentType}: ${userMessage.slice(0, 100)}` };
}

function pickModelForSkill(skillType) {
  switch (skillType) {
    case "quant":
    case "alpha_scout":
      return "deepseek/deepseek-r1";
    case "meme":
    case "meme_creator":
      return "openai/gpt-4o";
    case "lp":
      return "openai/gpt-4o";
    case "deployer":
      return "openai/gpt-4o-mini";
    default:
      return "openai/gpt-4o-mini";
  }
}

const port = Number(process.env.GATEWAY_PORT || 3000);
app.listen(port, () => {
  console.log(`DGrid gateway listening on ${port}`);
  startAutoFeedLoop();
});

