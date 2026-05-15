import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";
import { WalletAuthService, bearerToken, normalizeAddress } from "./auth.js";
import { createIntelligenceRouter } from "./intelligence/router.js";
import { JsonIntelligenceStore } from "./intelligence/store.js";
import {
  assertAllowedProvider,
  assertAllowedTaskType,
  assertByokCredentialInput,
  assertManagedModeAllowed,
  assertProviderList,
  assertTaskTypeList,
  createRateLimiter,
  publicError,
  securityHeaders,
} from "./security.js";
import {
  buildFarcasterActionUrl,
  buildFarcasterCastText,
  buildFarcasterEmbedUrl,
  buildManifest,
  buildMiniAppEmbed,
  buildPreviewSvg,
  getActorTxHistory,
  getFeedEvent,
  getReputationEvents,
  getStrategyProofs,
  getStrategyTxHistory,
  getValidationStatus,
  listFeedEvents,
  shareStrategyToFarcaster,
  validateFarcasterProductionConfig,
} from "./farcaster/service.js";

/* ---------- startup validation ---------- */
const gatewayRpcUrl = process.env.GATEWAY_RPC_URL || process.env.MANTLE_RPC_URL || process.env.BSC_TESTNET_RPC_URL;
if (!gatewayRpcUrl) {
  console.error("FATAL: GATEWAY_RPC_URL or MANTLE_RPC_URL is required");
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

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.GATEWAY_ENV === "production";
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
const productionRuntime = isProductionRuntime();
const requireAuth = productionRuntime || isTruthy(readConfig(envOverrides, "GATEWAY_REQUIRE_AUTH"));
const allowProductionMocks = isTruthy(readConfig(envOverrides, "ALLOW_PRODUCTION_MOCKS"));
const managedIntelligenceEnabled = isTruthy(readConfig(envOverrides, "MANAGED_INTELLIGENCE_ENABLED"));
const authService = new WalletAuthService({ secret: readConfig(envOverrides, "GATEWAY_AUTH_SECRET") });

if (requireAuth) {
  authService.assertReady();
}

if (productionRuntime) {
  if (allowProductionMocks) {
    throw new Error("Refusing to start production gateway with ALLOW_PRODUCTION_MOCKS=true");
  }
  if (!readConfig(envOverrides, "INTELLIGENCE_ENCRYPTION_KEY")) {
    throw new Error("INTELLIGENCE_ENCRYPTION_KEY is required in production");
  }
  if (readConfig(envOverrides, "ZERO_G_PROVIDER") !== "real") {
    throw new Error("ZERO_G_PROVIDER=real is required in production");
  }
  if (readConfig(envOverrides, "DEPLOYER_PRIVATE_KEY")) {
    throw new Error("DEPLOYER_PRIVATE_KEY must not be configured on the production gateway");
  }
  if (isTruthy(readConfig(envOverrides, "NEXT_PUBLIC_FARCASTER_ENABLED")) || isTruthy(readConfig(envOverrides, "FARCASTER_ENABLED"))) {
    const farcasterConfig = validateFarcasterProductionConfig({
      appUrl: readConfig(envOverrides, "FARCASTER_APP_URL") || readConfig(envOverrides, "NEXT_PUBLIC_APP_URL"),
    });
    if (!farcasterConfig.ok) {
      throw new Error(`Farcaster production config invalid: ${farcasterConfig.issues.join("; ")}`);
    }
  }
}

function corsOptions() {
  const configured = (readConfig(envOverrides, "GATEWAY_CORS_ORIGINS") || readConfig(envOverrides, "FARCASTER_APP_URL") || readConfig(envOverrides, "NEXT_PUBLIC_APP_URL") || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (!productionRuntime || !configured.length) return {};
  return {
    origin(origin, callback) {
      if (!origin || configured.includes(origin.replace(/\/$/, ""))) return callback(null, true);
      return callback(new Error("origin not allowed"));
    },
  };
}

function validateExternalEndpoint(endpointUrl) {
  try {
    const parsed = new URL(endpointUrl);
    if (parsed.protocol !== "https:") return { ok: false, error: "endpointUrl must use HTTPS" };
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host === "0.0.0.0" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host === "::1"
    ) {
      return { ok: false, error: "endpointUrl cannot target local or private network hosts" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "endpointUrl is invalid" };
  }
}

const providerValidationOptions = {
  production: productionRuntime,
  allowProductionMocks,
};

function sendError(res, error, status = 500, fallback = "Request failed") {
  return res.status(status).json(publicError(error, {
    production: productionRuntime,
    fallback,
  }));
}

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
if (isTruthy(readConfig(envOverrides, "GATEWAY_TRUST_PROXY"))) {
  app.set("trust proxy", 1);
}
app.disable("x-powered-by");
app.use(securityHeaders({ production: productionRuntime }));
app.use(cors(corsOptions()));
app.use(createRateLimiter({
  keyPrefix: "gateway",
  windowMs: Number(readConfig(envOverrides, "GATEWAY_RATE_LIMIT_WINDOW_MS") || 60_000),
  max: Number(readConfig(envOverrides, "GATEWAY_RATE_LIMIT_MAX") || (productionRuntime ? 300 : 3_000)),
}));
const sensitiveLimiter = createRateLimiter({
  keyPrefix: "sensitive",
  windowMs: 60_000,
  max: productionRuntime ? 30 : 300,
});
const intelligenceLimiter = createRateLimiter({
  keyPrefix: "intelligence",
  windowMs: 60_000,
  max: productionRuntime ? 20 : 200,
});
const aiAssetLimiter = createRateLimiter({
  keyPrefix: "ai-assets",
  windowMs: 60_000,
  max: productionRuntime ? 10 : 100,
});
app.use(["/auth/nonce", "/auth/verify"], sensitiveLimiter);
app.use("/intelligence", intelligenceLimiter);
app.use(["/meme/image", "/meme/launch"], aiAssetLimiter);
app.use(express.json({ limit: process.env.GATEWAY_JSON_LIMIT || "64kb" }));
const intelligenceStore = new JsonIntelligenceStore({
  allowInProduction: isTruthy(readConfig(envOverrides, "ALLOW_JSON_INTELLIGENCE_STORE_IN_PRODUCTION")),
});
const intelligenceRouter = createIntelligenceRouter({ store: intelligenceStore });

app.get(/^\/mini(?:\/.*)?$/, (req, res, next) => {
  const frontendUrl = (readConfig(envOverrides, "NEXT_PUBLIC_APP_URL") || readConfig(envOverrides, "VITE_APP_URL") || "").replace(/\/$/, "");
  const gatewayOrigin = `${req.protocol}://${req.get("host")}`.replace(/\/$/, "");
  if (!frontendUrl || frontendUrl === gatewayOrigin) return next();
  return res.redirect(302, `${frontendUrl}${req.originalUrl}`);
});

function authenticate(req, res, next) {
  if (!requireAuth) {
    return next();
  }
  try {
    const session = authService.verifySession(bearerToken(req));
    req.auth = session;
    return next();
  } catch (error) {
    return sendError(res, error, 401, "unauthorized");
  }
}

function requireAdmin(req, res, next) {
  if (!productionRuntime && !requireAuth) {
    return next();
  }
  const adminToken = readConfig(envOverrides, "ADMIN_API_TOKEN");
  const provided = req.headers["x-admin-token"];
  if (!adminToken || provided !== adminToken) {
    return res.status(403).json({ error: "admin authorization required" });
  }
  return next();
}

function authenticatedUserId(req) {
  return req.auth?.wallet || req.body?.userId || req.params?.userId;
}

function withAuthUser(req) {
  return {
    ...req.body,
    userId: authenticatedUserId(req),
  };
}

function enforceUserScope(req, requestedUserId) {
  if (!requireAuth) {
    return requestedUserId;
  }
  const wallet = req.auth?.wallet;
  if (!wallet) {
    throw new Error("authenticated wallet missing");
  }
  if (requestedUserId && normalizeUserId(requestedUserId) !== wallet) {
    throw new Error("cannot access another user's data");
  }
  return wallet;
}

function normalizeUserId(value) {
  try {
    return normalizeAddress(value);
  } catch {
    return String(value || "").toLowerCase();
  }
}

function contractAddress(name, envKey) {
  return deployment?.contracts?.[name] || readConfig(envOverrides, envKey);
}

async function assertAgentOwner(req, agentId) {
  if (!requireAuth || !agentId || !/^\d+$/.test(String(agentId))) {
    return;
  }
  const agentNftAddress = contractAddress("agentNFT", "AGENT_NFT_ADDRESS");
  if (!agentNftAddress) {
    throw new Error("Agent NFT address is not configured");
  }
  const agentContract = new ethers.Contract(agentNftAddress, agentAbi, provider);
  const owner = normalizeAddress(await agentContract.ownerOf(BigInt(agentId)));
  if (owner !== req.auth.wallet) {
    throw new Error("authenticated wallet does not own this agent");
  }
}

if (productionRuntime) {
  const missingContracts = [
    ["agentNFT", "AGENT_NFT_ADDRESS"],
    ["skillNFT", "SKILL_NFT_ADDRESS"],
  ].filter(([name, envKey]) => !contractAddress(name, envKey));
  if (missingContracts.length) {
    throw new Error(`Production gateway missing contract addresses: ${missingContracts.map(([name]) => name).join(", ")}`);
  }
}

app.post("/auth/nonce", (req, res) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ error: "address required" });
    }
    return res.json(authService.createNonce(address));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/auth/verify", (req, res) => {
  try {
    const { address, nonce, signature } = req.body;
    if (!address || !nonce || !signature) {
      return res.status(400).json({ error: "address, nonce, and signature are required" });
    }
    return res.json(authService.verifySignature({ address, nonce, signature }));
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
});

/* ---------- provider + ABIs ---------- */
const provider = new ethers.JsonRpcProvider(gatewayRpcUrl);

const agentAbi = [
  "function tbas(uint256) view returns (address)",
  "function ownerOf(uint256 tokenId) view returns (address)"
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
app.post("/agent/execute", authenticate, async (req, res) => {
  try {
    const { tbaAddress, message, requiredCapability, action } = req.body;
    const agentNftAddress = productionRuntime
      ? contractAddress("agentNFT", "AGENT_NFT_ADDRESS")
      : req.body.agentNftAddress || contractAddress("agentNFT", "AGENT_NFT_ADDRESS");
    const skillNftAddress = productionRuntime
      ? contractAddress("skillNFT", "SKILL_NFT_ADDRESS")
      : req.body.skillNftAddress || contractAddress("skillNFT", "SKILL_NFT_ADDRESS");
    if (!tbaAddress || !message || !agentNftAddress || !skillNftAddress) {
      return res.status(400).json({ error: "tbaAddress, message, agent NFT, and skill NFT addresses are required" });
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
    if (requireAuth) {
      const owner = normalizeAddress(await agentContract.ownerOf(agentId));
      if (owner !== req.auth.wallet) {
        return res.status(403).json({ error: "authenticated wallet does not own this agent" });
      }
    }

    const skills = await getSkillsForBackpack(skillNftAddress, tbaAddress);
    const capability = requiredCapability || capabilityForAction(action);
    if (capability && !skills.some((skill) => skill.capabilityTag === capability)) {
      return res.status(403).json({ error: `Agent lacks required capability: ${capability}` });
    }

    const selectedSkill = selectBestSkill(skills, capability);
    const llmResponse = await routeViaDGrid(selectedSkill, message, tbaAddress, {
      userId: authenticatedUserId(req),
      agentId: agentId.toString(),
      providerMode: productionRuntime ? undefined : req.body.providerMode,
      provider: productionRuntime ? undefined : req.body.provider,
      model: productionRuntime ? undefined : req.body.model,
    });

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
app.post("/meme/scan", authenticate, async (req, res) => {
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

    const result = await callDGrid("alpha_scout", userMessage, "scan", withAuthUser(req));
    return res.json({ step: "scan", result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/* ============================================================
   MEME LOOP: /meme/concept
   Creative agent — turns thesis into name/ticker/lore/copy
   ============================================================ */
app.post("/meme/concept", authenticate, async (req, res) => {
  try {
    const { thesis } = req.body;
    if (!thesis) {
      return res.status(400).json({ error: "thesis object required" });
    }

    const userMessage = `Generate a meme token concept based on this thesis:\n${JSON.stringify(thesis, null, 2)}`;
    const result = await callDGrid("meme_creator", userMessage, "concept", withAuthUser(req));
    return res.json({ step: "concept", result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/* ============================================================
   MEME LOOP: /meme/image
   Image generation — returns placeholder/stub asset paths
   ============================================================ */
app.post("/meme/image", authenticate, async (req, res) => {
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
app.post("/meme/launch", authenticate, async (req, res) => {
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
app.post("/feed/generate", authenticate, async (req, res) => {
  try {
    const { agentName, roleLabel, context } = req.body;
    const userMessage = context ? `Market context: ${context}\nAgent Name: ${agentName}\nRole: ${roleLabel}\nCreate a post.` : `Agent Name: ${agentName}\nRole: ${roleLabel}\nCreate a new post about current market or strategy.`;
    const result = await callDGrid("social", userMessage, "generate_post", withAuthUser(req));
    return res.json({ result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/* ============================================================
   INTELLIGENCE ROUTER: credits, config, BYOK, health, run
   ============================================================ */
app.post("/intelligence/users", authenticate, (req, res) => {
  try {
    const userId = enforceUserScope(req, req.body.userId);
    const walletAddress = requireAuth ? req.auth.wallet : req.body.walletAddress;
    if (!userId) return res.status(400).json({ error: "userId required" });
    return res.json({ user: intelligenceStore.upsertUser({ id: userId, walletAddress }) });
  } catch (error) {
    return sendError(res, error, 500, "Could not upsert intelligence user");
  }
});

app.post("/intelligence/credits/add", authenticate, requireAdmin, (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.body.userId;
    if (!userId || !amount) return res.status(400).json({ error: "userId and amount required" });
    return res.json({ credits: intelligenceStore.addCredits(userId, amount) });
  } catch (error) {
    return sendError(res, error, 500, "Could not add intelligence credits");
  }
});

app.get("/intelligence/credits/:userId", authenticate, (req, res) => {
  try {
    const userId = enforceUserScope(req, req.params.userId);
    return res.json({ credits: intelligenceStore.getCredits(userId) });
  } catch (error) {
    return sendError(res, error, 500, "Could not read intelligence credits");
  }
});

app.post("/intelligence/agents/:agentId/config", authenticate, async (req, res) => {
  try {
    const userId = enforceUserScope(req, req.body.userId);
    if (!userId) return res.status(400).json({ error: "userId required" });
    assertAllowedProvider(req.body.primaryProvider, providerValidationOptions);
    assertProviderList(req.body.fallbackProviders, providerValidationOptions);
    assertTaskTypeList(req.body.allowedTaskTypes);
    assertManagedModeAllowed(req.body.mode, {
      production: productionRuntime,
      managedEnabled: managedIntelligenceEnabled,
    });
    await assertAgentOwner(req, req.params.agentId);
    const config = intelligenceStore.setAgentConfig({ ...req.body, userId, agentId: req.params.agentId });
    return res.json({ config });
  } catch (error) {
    return sendError(res, error, 400, "Could not save agent intelligence config");
  }
});

app.post("/intelligence/credentials", authenticate, async (req, res) => {
  try {
    const { agentId, provider, apiKey, endpointUrl, metadata } = req.body;
    const userId = enforceUserScope(req, req.body.userId);
    if (!userId || !provider || !apiKey) return res.status(400).json({ error: "userId, provider, and apiKey required" });
    assertAllowedProvider(provider, providerValidationOptions);
    assertByokCredentialInput({ provider, apiKey, endpointUrl });
    if (endpointUrl) {
      const endpointCheck = validateExternalEndpoint(endpointUrl);
      if (!endpointCheck.ok) return res.status(400).json({ error: endpointCheck.error });
    }
    if (agentId) {
      await assertAgentOwner(req, agentId);
    }
    const credential = intelligenceStore.storeProviderCredential({ userId, agentId, provider, apiKey, endpointUrl, metadata });
    return res.json({ credential });
  } catch (error) {
    return sendError(res, error, 400, "Could not store provider credential");
  }
});

app.post("/intelligence/providers/:provider/health", authenticate, async (req, res) => {
  try {
    const userId = req.body.userId ? enforceUserScope(req, req.body.userId) : authenticatedUserId(req);
    assertAllowedProvider(req.params.provider, providerValidationOptions);
    assertManagedModeAllowed(req.body.mode, {
      production: productionRuntime,
      managedEnabled: managedIntelligenceEnabled,
    });
    const health = await intelligenceRouter.healthCheck(req.params.provider, req.body.mode, userId, req.body.agentId);
    return res.json({ health });
  } catch (error) {
    return sendError(res, error, 400, "Provider health check failed");
  }
});

app.post("/intelligence/run", authenticate, async (req, res) => {
  try {
    const userId = enforceUserScope(req, req.body.userId);
    assertAllowedProvider(req.body.provider, providerValidationOptions);
    assertProviderList(req.body.fallbackProviders, providerValidationOptions);
    assertAllowedTaskType(req.body.taskType);
    assertManagedModeAllowed(req.body.providerMode, {
      production: productionRuntime,
      managedEnabled: managedIntelligenceEnabled,
    });
    if (req.body.agentId) {
      await assertAgentOwner(req, req.body.agentId);
    }
    const result = await intelligenceRouter.runAgentInference({ ...req.body, userId });
    return res.json(result);
  } catch (error) {
    const status = error.message.includes("Insufficient intelligence credits") ? 402 : 400;
    return sendError(res, error, status, status === 402 ? "Insufficient intelligence credits" : "Intelligence request failed");
  }
});

app.get("/intelligence/usage/:userId", authenticate, (req, res) => {
  try {
    const userId = enforceUserScope(req, req.params.userId);
    return res.json({ usage: intelligenceStore.getUsageEvents({ userId }) });
  } catch (error) {
    return sendError(res, error, 500, "Could not read intelligence usage");
  }
});

/* ============================================================
   FARCASTER MINI APP + WIDGET API
   ============================================================ */
app.get("/.well-known/farcaster.json", (req, res) => {
  res.json(buildManifest({ appUrl: farcasterAppUrl(req) }));
});

app.get("/api/farcaster/manifest", (req, res) => {
  res.json(buildManifest({ appUrl: farcasterAppUrl(req) }));
});

app.get("/api/farcaster/og/:feedEventId", async (req, res) => {
  const event = getFeedEvent(req.params.feedEventId);
  const svg = buildPreviewSvg(event || { id: "missing", feedEventId: "missing", type: "defi", title: "Strategy not found", metrics: {}, strategy: {}, agent: {} });
  if (!event) {
    res.status(404);
  }
  res.setHeader("cache-control", "public, max-age=60");
  try {
    const { default: sharp } = await import("sharp");
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return res.type("image/png").send(png);
  } catch {
    res.setHeader("x-clusterfi-og-fallback", "svg");
    return res.type("image/svg+xml").send(svg);
  }
});

app.get(["/api/farcaster/embed/:feedEventId", "/api/farcaster/frame/:feedEventId"], (req, res) => {
  const event = getFeedEvent(req.params.feedEventId);
  if (!event) return res.status(404).send("Feed event not found");
  const appUrl = farcasterAppUrl(req);
  const embed = buildMiniAppEmbed(event, { appUrl });
  const title = escapeHtml(event.title);
  const description = escapeHtml(event.description || event.subtitle || "Enter this ClusterFi strategy.");
  return res.type("html").send(`<!doctype html><html><head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${embed.imageUrl}" />
    <meta name="fc:miniapp" content='${escapeHtml(JSON.stringify(embed))}' />
    <meta name="fc:frame" content='${escapeHtml(JSON.stringify({ ...embed, button: { ...embed.button, action: { ...embed.button.action, type: "launch_frame" } } }))}' />
  </head><body>
    <main style="font-family:system-ui;background:#0b1220;color:#e5e2e3;min-height:100vh;display:grid;place-items:center;padding:24px">
      <section style="max-width:640px">
        <img alt="" src="${embed.imageUrl}" style="width:100%;border-radius:18px;border:1px solid #3c494e" />
        <h1>${title}</h1>
        <p>${description}</p>
        <p><a href="${event.action.url}" style="color:#00f9be">Enter Strategy</a></p>
      </section>
    </main>
  </body></html>`);
});

app.post("/api/farcaster/share/:feedEventId", (req, res) => {
  const event = getFeedEvent(req.params.feedEventId);
  if (!event) return res.status(404).json({ error: "feed event not found" });
  return res.json({ share: shareStrategyToFarcaster(event) });
});

app.get("/api/farcaster/share/:feedEventId", (req, res) => {
  const event = getFeedEvent(req.params.feedEventId);
  if (!event) return res.status(404).json({ error: "feed event not found" });
  return res.json({
    text: buildFarcasterCastText(event),
    embedUrl: buildFarcasterEmbedUrl(event, { appUrl: farcasterAppUrl(req) }),
    actionUrl: buildFarcasterActionUrl(event, { appUrl: farcasterAppUrl(req) }),
  });
});

app.get("/api/widget/:feedEventId", (req, res) => {
  const event = getFeedEvent(req.params.feedEventId);
  if (!event) return res.status(404).json({ error: "feed event not found" });
  return res.json({ widget: event });
});

app.get("/api/feed", (req, res) => {
  return res.json({ feed: listFeedEvents() });
});

app.get("/api/feed/:feedEventId", (req, res) => {
  const event = getFeedEvent(req.params.feedEventId);
  if (!event) return res.status(404).json({ error: "feed event not found" });
  return res.json({ feedEvent: event });
});

app.get("/api/strategy/:strategyId", (req, res) => {
  const event = listFeedEvents().find((item) => item.strategy.id === req.params.strategyId);
  if (!event) return res.status(404).json({ error: "strategy not found" });
  return res.json({
    strategy: event.strategy,
    widget: event,
    txHistory: getStrategyTxHistory(req.params.strategyId),
    proofs: getStrategyProofs(req.params.strategyId),
    validation: getValidationStatus(req.params.strategyId),
    reputation: getReputationEvents(req.params.strategyId),
  });
});

app.get("/api/agent/:agentId", (req, res) => {
  const strategies = listFeedEvents().filter((event) => event.agent?.id === req.params.agentId);
  if (!strategies.length) return res.status(404).json({ error: "agent not found" });
  return res.json({ agent: strategies[0].agent, strategies, txHistory: getActorTxHistory(req.params.agentId), reputation: getReputationEvents(req.params.agentId) });
});

app.get("/api/cluster/:clusterId", (req, res) => {
  const strategies = listFeedEvents().filter((event) => event.cluster?.id === req.params.clusterId);
  if (!strategies.length) return res.status(404).json({ error: "cluster not found" });
  return res.json({ cluster: strategies[0].cluster, strategies, txHistory: getActorTxHistory(req.params.clusterId, "cluster"), reputation: getReputationEvents(req.params.clusterId) });
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
  const result = await callDGrid("social", userMessage, "generate_post", { userId: "auto-feed", agentId: persona.agentId });
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

async function callDGrid(agentType, userMessage, step, options = {}) {
  const model = pickModelForSkill(agentType);
  const systemPrompt = systemPrompts[agentType] || systemPrompts.default;
  const userId = options.userId || "demo-user";
  const agentId = options.agentId || `legacy-${agentType}`;
  const taskType = taskTypeForLegacyAgent(agentType);

  const routed = await intelligenceRouter.runAgentInference({
    userId,
    agentId,
    clusterId: options.clusterId,
    workflowId: options.workflowId,
    taskType,
    providerMode: options.providerMode || "MANAGED",
    provider: options.provider || "dgrid",
    model: options.model || model,
    fallbackProviders: options.fallbackProviders || defaultFallbackProviders(),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ],
    responseSchema: null,
    metadata: { legacyAgentType: agentType, step }
  });
  return adaptLegacyDGridResult(agentType, routed.output, userMessage, step);
}

async function routeViaDGrid(skill, userMessage, tbaAddress, options = {}) {
  const model = pickModelForSkill(skill.skillType);
  const routed = await intelligenceRouter.runAgentInference({
    userId: options.userId || "demo-user",
    agentId: options.agentId || `tba-${tbaAddress.toLowerCase()}`,
    taskType: "agent-execute",
    providerMode: options.providerMode || "MANAGED",
    provider: options.provider || "dgrid",
    model: options.model || model,
    fallbackProviders: options.fallbackProviders || defaultFallbackProviders(),
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
    ],
    metadata: { tbaAddress, selectedSkill: skill.name }
  });

  return {
    mode: routed.provider,
    model: routed.model,
    content: typeof routed.output === "string" ? routed.output : JSON.stringify(routed.output),
    output: routed.output,
    usage: routed.usage,
    proofURI: routed.proofURI,
    traceId: routed.traceId
  };
}

function defaultFallbackProviders() {
  return productionRuntime ? ["0g-compute"] : ["0g-compute", "mock"];
}

function farcasterAppUrl(req) {
  return (process.env.FARCASTER_APP_URL || process.env.TUNNEL_URL || process.env.NEXT_PUBLIC_APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&#39;", '"': "&quot;" }[char]));
}

// Legacy dGrid endpoints now route through the metered intelligence router.

function taskTypeForLegacyAgent(agentType) {
  switch (agentType) {
    case "alpha_scout":
      return "sleuth-alpha";
    case "meme_creator":
      return "meme-launch";
    case "social":
      return "social-post";
    case "quant":
    case "lp":
      return "quant-strategy";
    default:
      return "agent-execute";
  }
}

function adaptLegacyDGridResult(agentType, output, userMessage, step) {
  if (agentType === "alpha_scout" && !output?.theses) {
    return {
      theses: [
        {
          rank: 1,
          keyword: output?.suggestedInstrumentType || "agent alpha",
          signal_strength: Number(output?.confidence || 0.66),
          reasoning: output?.thesis || String(output?.content || userMessage).slice(0, 160),
          verdict: "launch",
          risk: output?.riskFactors?.[0] ? "medium" : "low",
        },
        { rank: 2, keyword: "social liquidity", signal_strength: 0.58, reasoning: "Fallback narrative remains investable but needs more proof.", verdict: "skip", risk: "medium" },
        { rank: 3, keyword: "thin rotation", signal_strength: 0.44, reasoning: "Signal is weaker and should stay watchlisted.", verdict: "skip", risk: "high" },
      ],
    };
  }
  if (agentType === "meme_creator" && !output?.ticker) {
    return {
      name: "Proof of Meme",
      ticker: "POM",
      lore: output?.thesis || "A meme asset born from agent-verified social alpha.",
      launch_copy: output?.posts?.[0] || "Agent proof is in. $POM is the meme strategy you can verify before you ape.",
      image_prompt: output?.assetsPrompt || "A high-energy mascot logo for an agent-verified meme token.",
      risk_notes: output?.riskFactors?.join("; ") || "Demo concept only; liquidity and execution risks remain.",
    };
  }
  if (agentType === "social" && !output?.insightTitle) {
    return {
      insightTitle: output?.campaignTitle || "Agent Strategy Live",
      content: output?.posts?.[0] || String(output?.content || userMessage).slice(0, 260),
      tags: output?.hooks || ["clusterfi", "agents"],
      strategySummary: output?.targetAudience || "Generated through the metered ClusterFi intelligence router.",
    };
  }
  return output || mockDGridResponse(agentType, userMessage, step);
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
  console.log(`ClusterFi intelligence gateway listening on ${port}`);
  startAutoFeedLoop();
});

