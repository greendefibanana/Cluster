import "dotenv/config";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const deploymentPath = process.env.DEPLOYMENT_FILE || path.join(process.cwd(), "deployments", "bsc-testnet.json");
const rpcUrl = process.env.MAINNET_RPC_URL || process.env.BSC_RPC_URL || process.env.BSC_TESTNET_RPC_URL || process.env.MANTLE_RPC_URL;
const expectedOwner = process.env.EXPECTED_PROTOCOL_OWNER?.toLowerCase();
const productionGateway = process.env.NODE_ENV === "production" || process.env.GATEWAY_ENV === "production";

const ownerAbi = ["function owner() view returns (address)"];
const skillNftAbi = ["function authorizedManagers(address) view returns (bool)"];
const executionHubAbi = [
  "function getTargetPolicy(address target, bytes4 selector) view returns (bool enabled, string capabilityTag)",
  "function getGlobalPolicy(bytes4 selector) view returns (bool enabled, string capabilityTag)",
  "function selectorDenylist(bytes4 selector) view returns (bool)",
];
const acrossBridgeAbi = ["function simulationMode() view returns (bool)"];

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function requireEnv(name) {
  if (!process.env[name]) {
    fail(`${name} is required`);
  }
}

function isAddress(value) {
  return typeof value === "string" && ethers.isAddress(value);
}

async function requireCode(provider, label, address) {
  if (!isAddress(address)) {
    fail(`${label} is missing or not an address`);
    return;
  }
  const code = await provider.getCode(address);
  if (!code || code === "0x") {
    fail(`${label} has no deployed bytecode at ${address}`);
  }
}

async function checkOwner(provider, label, address) {
  if (!expectedOwner || !isAddress(address)) {
    return;
  }
  try {
    const contract = new ethers.Contract(address, ownerAbi, provider);
    const owner = String(await contract.owner()).toLowerCase();
    if (owner !== expectedOwner) {
      fail(`${label} owner ${owner} does not match EXPECTED_PROTOCOL_OWNER ${expectedOwner}`);
    }
  } catch {
    warn(`${label} does not expose owner(); skipped owner check`);
  }
}

async function main() {
  if (!fs.existsSync(deploymentPath)) {
    fail(`Deployment file not found: ${deploymentPath}`);
  }
  if (!rpcUrl) {
    fail("MAINNET_RPC_URL, BSC_RPC_URL, BSC_TESTNET_RPC_URL, or MANTLE_RPC_URL is required");
  }

  if (productionGateway) {
    requireEnv("GATEWAY_AUTH_SECRET");
    requireEnv("INTELLIGENCE_ENCRYPTION_KEY");
    if (process.env.GATEWAY_AUTH_SECRET && process.env.GATEWAY_AUTH_SECRET.length < 32) {
      fail("GATEWAY_AUTH_SECRET must be at least 32 characters");
    }
    if (process.env.DEPLOYER_PRIVATE_KEY) {
      fail("DEPLOYER_PRIVATE_KEY must not be present in gateway production env");
    }
    if (process.env.ALLOW_PRODUCTION_MOCKS === "true") {
      fail("ALLOW_PRODUCTION_MOCKS must not be true in production");
    }
    if (process.env.ZERO_G_PROVIDER !== "real") {
      fail("ZERO_G_PROVIDER=real is required in production");
    }
    if (process.env.MANAGED_INTELLIGENCE_ENABLED === "true") {
      fail("MANAGED_INTELLIGENCE_ENABLED must not be true for v1 BYOK-first production launch");
    }
    if (process.env.ALLOW_JSON_INTELLIGENCE_STORE_IN_PRODUCTION === "true") {
      fail("ALLOW_JSON_INTELLIGENCE_STORE_IN_PRODUCTION must not be true in production");
    }
    if (!process.env.GATEWAY_CORS_ORIGINS && !process.env.FARCASTER_APP_URL && !process.env.NEXT_PUBLIC_APP_URL) {
      fail("GATEWAY_CORS_ORIGINS, FARCASTER_APP_URL, or NEXT_PUBLIC_APP_URL is required to lock production CORS");
    }
    if (process.env.DISABLE_CROSSCHAIN_EXECUTION !== "true") {
      fail("DISABLE_CROSSCHAIN_EXECUTION=true is required for guarded launch");
    }
  }

  if (failures.length) {
    printAndExit();
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const contracts = deployment.contracts || {};
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const requiredContracts = [
    ["AgentNFT", contracts.agentNFT],
    ["SkillNFT", contracts.skillNFT],
    ["AgentSkillManager", contracts.skillManager],
    ["AgentExecutionHub", contracts.executionHub],
    ["AgentJobMarket", contracts.jobMarket],
  ];

  for (const [label, address] of requiredContracts) {
    await requireCode(provider, label, address);
    await checkOwner(provider, label, address);
  }

  if (isAddress(contracts.skillNFT) && isAddress(contracts.skillManager)) {
    const skill = new ethers.Contract(contracts.skillNFT, skillNftAbi, provider);
    const allowed = await skill.authorizedManagers(contracts.skillManager);
    if (!allowed) {
      fail("SkillNFT does not authorize AgentSkillManager as manager");
    }
  }

  if (isAddress(contracts.executionHub) && isAddress(contracts.tokenFactory)) {
    const executionHub = new ethers.Contract(contracts.executionHub, executionHubAbi, provider);
    const deploySelector = new ethers.Interface([
      "function deployToken(string name, string symbol, uint256 supply, address tokenOwner)",
    ]).getFunction("deployToken").selector;
    const [enabled, capabilityTag] = await executionHub.getTargetPolicy(contracts.tokenFactory, deploySelector);
    if (!enabled) {
      fail("ExecutionHub tokenFactory deployToken policy is not enabled");
    }
    if (!capabilityTag) {
      fail("ExecutionHub tokenFactory deployToken policy has empty capabilityTag");
    }

    if (productionGateway || process.env.REQUIRE_POLICY_DENYLIST === "true") {
      const deniedSelectors = [
        ["transferOwnership", "function transferOwnership(address newOwner)"],
        ["setTrustedCaller", "function setTrustedCaller(address caller, bool trusted)"],
        ["setManager", "function setManager(address manager, bool allowed)"],
        ["pause", "function pause()"],
        ["unpause", "function unpause()"],
      ];
      for (const [name, signature] of deniedSelectors) {
        const selector = new ethers.Interface([signature]).getFunction(name).selector;
        const denied = await executionHub.selectorDenylist(selector);
        if (!denied) {
          fail(`ExecutionHub selector denylist missing ${name}`);
        }
      }
    }
  }

  if (productionGateway && isAddress(contracts.acrossBridgeAdapter)) {
    const across = new ethers.Contract(contracts.acrossBridgeAdapter, acrossBridgeAbi, provider);
    if (await across.simulationMode()) {
      fail("AcrossBridgeAdapter simulationMode must be false in production");
    }
  }

  const mockAddresses = [
    ["mockMemeAdapter", contracts.mockMemeAdapter],
    ["mockLPAdapter", contracts.mockLPAdapter],
    ["mockYieldAdapter", contracts.mockYieldAdapter],
    ["mockPredictionMarketAdapter", contracts.mockPredictionMarketAdapter],
    ["mockBridgeAdapter", contracts.mockBridgeAdapter],
  ].filter(([, address]) => isAddress(address));

  if (productionGateway && mockAddresses.length) {
    fail(`Production deployment still contains mock adapter addresses: ${mockAddresses.map(([name]) => name).join(", ")}`);
  }

  printAndExit();
}

function printAndExit() {
  if (warnings.length) {
    console.warn("WARNINGS");
    for (const warning of warnings) console.warn(`- ${warning}`);
  }
  if (failures.length) {
    console.error("STOP-SHIP FAILURES");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log("Mainnet readiness checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
