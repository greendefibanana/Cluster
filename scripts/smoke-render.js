import "dotenv/config";
import fs from "fs";
import path from "path";

console.log("🔍 Running Render pre-deployment smoke test...\n");

let hasError = false;
const envOverridesPath = path.join(process.cwd(), ".env.production");
let envData = process.env;

if (fs.existsSync(envOverridesPath)) {
  console.log("Loaded .env.production overrides.");
  const overrides = Object.fromEntries(
    fs.readFileSync(envOverridesPath, "utf8")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#") && line.includes("="))
      .map(line => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
  
  // process.env should take precedence over .env file overrides
  envData = { ...overrides };
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && value !== "") {
      envData[key] = value;
    }
  }
}

function check(name, validCondition, errorMessage) {
  if (!validCondition) {
    console.error(`❌ [FAIL] ${name}: ${errorMessage}`);
    hasError = true;
  } else {
    console.log(`✅ [PASS] ${name}`);
  }
}

// 1. Gateway RPC
const gatewayRpc = envData.GATEWAY_RPC_URL || envData.MANTLE_RPC_URL || envData.MANTLE_SEPOLIA_RPC_URL;
check(
  "Gateway/Mantle RPC URL",
  !!gatewayRpc && !gatewayRpc.includes("<"),
  "Must provide GATEWAY_RPC_URL or MANTLE_RPC_URL."
);

// 2. 0G RPC
const zeroGRpc = envData.ZERO_G_RPC_URL || envData.ZERO_G_MAINNET_RPC_URL || envData.OG_RPC_URL || envData.RPC_URL_0G_MAINNET;
check(
  "0G Mainnet RPC URL",
  !!zeroGRpc && !zeroGRpc.includes("<"),
  "Must provide ZERO_G_RPC_URL or ZERO_G_MAINNET_RPC_URL."
);

// 3. Required Contract Addresses
const requiredContracts = [
  "AGENT_NFT_ADDRESS",
  "ERC6551_REGISTRY_ADDRESS",
  "ERC6551_ACCOUNT_IMPLEMENTATION",
  "MANTLE_TBA_ADDRESS",
  "ZERO_G_IDENTITY_REGISTRY",
  "ZERO_G_REPUTATION_REGISTRY",
  "ZERO_G_VALIDATION_REGISTRY"
];

for (const contract of requiredContracts) {
  check(
    contract,
    !!envData[contract] && envData[contract].startsWith("0x"),
    `Must provide a valid 0x address for ${contract}.`
  );
}

// 4. No placeholder values
const allValues = Object.values(envData).filter(v => typeof v === "string");
const hasPlaceholders = allValues.some(v => v.includes("<") && v.includes(">"));
check(
  "Placeholders",
  !hasPlaceholders,
  "Found unreplaced <placeholders> in environment."
);

if (hasError) {
  console.error("\n❌ Smoke test failed. Please fix configuration before deploying to Render.");
  process.exit(1);
} else {
  console.log("\n🚀 All Render pre-deployment checks passed! You are safe to deploy.");
}
