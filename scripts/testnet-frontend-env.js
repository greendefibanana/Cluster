import fs from "fs";
import path from "path";

const root = process.cwd();
const mantlePath = process.env.MANTLE_DEPLOYMENT_FILE || path.join(root, "deployments", "mantleSepolia.json");
const zeroGPath = process.env.ZERO_G_DEPLOYMENT_FILE || path.join(root, "deployments", "0g-testnet.json");
const testTokenPath = process.env.TEST_TOKEN_DEPLOYMENT_FILE || path.join(root, "deployments", "mantleSepolia-test-token.json");
const outputPath = process.argv.includes("--write")
  ? path.join(root, "Frontend", ".env.testnet.local")
  : null;

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Deployment file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function line(key, value = "") {
  return `${key}=${value ?? ""}`;
}

const mantle = readJson(mantlePath);
const zeroG = readJson(zeroGPath);
const testToken = fs.existsSync(testTokenPath) ? readJson(testTokenPath) : null;
const mantleContracts = mantle.contracts || {};
const zeroGContracts = zeroG.contracts || {};

const lines = [
  "# Generated ClusterFi testnet frontend env.",
  "# Safe to commit as a template only after removing concrete app/gateway URLs.",
  line("VITE_GATEWAY_URL", process.env.VITE_GATEWAY_URL || "http://localhost:3000"),
  line("VITE_DYNAMIC_ENVIRONMENT_ID", process.env.VITE_DYNAMIC_ENVIRONMENT_ID || "892c3a15-6d70-4c7e-8019-28a32816de35"),
  line("VITE_DYNAMIC_APP_NAME", "ClusterFi"),
  line("VITE_DYNAMIC_TERMS_URL", process.env.VITE_DYNAMIC_TERMS_URL || ""),
  line("VITE_DYNAMIC_PRIVACY_URL", process.env.VITE_DYNAMIC_PRIVACY_URL || ""),
  line("VITE_FARCASTER_ENABLED", "true"),
  line("VITE_FARCASTER_APP_URL", process.env.VITE_FARCASTER_APP_URL || process.env.VITE_APP_URL || "http://localhost:5173"),
  line("VITE_APP_URL", process.env.VITE_APP_URL || process.env.VITE_FARCASTER_APP_URL || "http://localhost:5173"),
  line("VITE_DEMO_MODE", "false"),
  "",
  "# Capital execution chain: Mantle Sepolia",
  line("VITE_RPC_URL", process.env.MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz"),
  line("VITE_CHAIN_ID", mantle.chainId || 5003),
  line("VITE_CHAIN_NAME", "Mantle Sepolia"),
  line("VITE_NATIVE_CURRENCY_NAME", "Mantle"),
  line("VITE_NATIVE_CURRENCY_SYMBOL", "MNT"),
  line("VITE_BLOCK_EXPLORER_BASE_URL", mantle.explorers?.mantleSepolia || "https://explorer.sepolia.mantle.xyz"),
  "",
  "# Agent identity/skills chain: Mantle Sepolia (Unified with capital chain)",
  line("VITE_AGENT_CHAIN_RPC_URL", process.env.MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz"),
  line("VITE_AGENT_CHAIN_ID", mantle.chainId || 5003),
  line("VITE_AGENT_CHAIN_NAME", "Mantle Sepolia"),
  line("VITE_AGENT_CHAIN_NATIVE_CURRENCY_NAME", "Mantle"),
  line("VITE_AGENT_CHAIN_NATIVE_CURRENCY_SYMBOL", "MNT"),
  line("VITE_AGENT_CHAIN_EXPLORER_URL", mantle.explorers?.mantleSepolia || "https://explorer.sepolia.mantle.xyz"),
  "",
  "# Mantle testnet agent contracts",
  line("VITE_AGENT_NFT_ADDRESS", mantleContracts.agentNFT),
  line("VITE_SWARM_NFT_ADDRESS", mantleContracts.swarmNFT),
  line("VITE_SKILL_NFT_ADDRESS", mantleContracts.skillNFT),
  line("VITE_SKILL_MANAGER_ADDRESS", mantleContracts.skillManager),
  line("VITE_SOCIAL_FEED_ADDRESS", mantleContracts.socialFeed),
  line("VITE_JOB_MARKET_ADDRESS", mantleContracts.jobMarket),
  line("VITE_PERFORMANCE_RANK_ADDRESS", mantleContracts.performanceRank),
  line("VITE_TOKEN_FACTORY_ADDRESS", mantleContracts.tokenFactory),
  line("VITE_LIQUIDITY_MANAGER_ADDRESS", mantleContracts.liquidityManager),
  line("VITE_MOCK_MEME_ADAPTER_ADDRESS", mantleContracts.mockMemeAdapter),
  line("VITE_MOCK_LP_ADAPTER_ADDRESS", mantleContracts.mockLPAdapter),
  line("VITE_MOCK_YIELD_ADAPTER_ADDRESS", mantleContracts.mockYieldAdapter),
  line("VITE_MOCK_PREDICTION_MARKET_ADAPTER_ADDRESS", mantleContracts.mockPredictionMarketAdapter),
  "",
  "# Mantle Sepolia Sovereign Account contracts",
  line("VITE_SOVEREIGN_ACCOUNT_FACTORY_ADDRESS", mantleContracts.sovereignAccountFactory),
  line("VITE_SOVEREIGN_ACCOUNT_REGISTRY_ADDRESS", mantleContracts.sovereignAccountRegistry),
  line("VITE_CROSS_CHAIN_INTENT_ENGINE_ADDRESS", mantleContracts.crossChainIntentEngine),
  line("VITE_MANTLE_YIELD_ADAPTER_ADDRESS", mantleContracts.mantleYieldAdapter),
  line("VITE_PREDICTION_MARKET_ADAPTER_ADDRESS", mantleContracts.predictionMarketAdapter),
  line("VITE_BNB_LAUNCH_ADAPTER_ADDRESS", mantleContracts.bnbLaunchAdapter),
  line("VITE_ETHEREUM_YIELD_ADAPTER_ADDRESS", mantleContracts.ethereumYieldAdapter),
  line("VITE_SOLANA_MEME_ADAPTER_ADDRESS", mantleContracts.solanaMemeAdapter),
  line("VITE_HYPERLIQUID_ADAPTER_ADDRESS", mantleContracts.hyperliquidAdapter),
  "",
  "# Required before deposit/withdraw testing on Mantle Sepolia.",
  "# Deploy or configure an ERC20 test asset on Mantle Sepolia and set this address.",
  line("VITE_PAYMENT_TOKEN_ADDRESS", process.env.VITE_PAYMENT_TOKEN_ADDRESS || testToken?.contracts?.paymentToken || ""),
  "",
].join("\n");

if (outputPath) {
  fs.writeFileSync(outputPath, `${lines}\n`);
  console.log(`Wrote ${outputPath}`);
} else {
  console.log(lines);
}
