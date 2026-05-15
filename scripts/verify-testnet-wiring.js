import "dotenv/config";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const root = process.cwd();
const mantlePath = process.env.MANTLE_DEPLOYMENT_FILE || path.join(root, "deployments", "mantleSepolia.json");
const zeroGPath = process.env.ZERO_G_DEPLOYMENT_FILE || path.join(root, "deployments", "0g-testnet.json");
const testTokenPath = process.env.TEST_TOKEN_DEPLOYMENT_FILE || path.join(root, "deployments", "mantleSepolia-test-token.json");
const mantleRpc = process.env.MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz";
const zeroGRpc = process.env.ZERO_G_TESTNET_RPC_URL || "https://evmrpc-testnet.0g.ai";

const requiredMantle = [
  "sovereignAccountRegistry",
  "sovereignAccountFactory",
  "crossChainIntentEngine",
  "mantleYieldAdapter",
  "predictionMarketAdapter",
  // Agent stack (moved from 0G — ERC6551 registry exists on Mantle)
  "agentNFT",
  "skillNFT",
  "skillManager",
  "identityRegistry",
  "reputationRegistry",
  "validationRegistry",
  "executionHub",
];
const requiredZeroG = [
  // Proof/storage/reputation contracts remain on 0G
  "agentNFT",
  "validationRegistry",
  "reputationRegistry",
  "identityRegistry",
];

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing deployment file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function requireCode(provider, label, address) {
  if (!ethers.isAddress(address)) {
    throw new Error(`${label} is not a valid address: ${address || "<empty>"}`);
  }
  const code = await provider.getCode(address);
  if (!code || code === "0x") {
    throw new Error(`${label} has no bytecode at ${address}`);
  }
  return address;
}

async function verifyNetwork(provider, expectedChainId, label) {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== expectedChainId) {
    throw new Error(`${label} RPC returned chain ${network.chainId}, expected ${expectedChainId}`);
  }
}

async function main() {
  const mantle = readJson(mantlePath);
  const zeroG = readJson(zeroGPath);
  const testToken = fs.existsSync(testTokenPath) ? readJson(testTokenPath) : null;
  const mantleProvider = new ethers.JsonRpcProvider(mantleRpc);
  const zeroGProvider = new ethers.JsonRpcProvider(zeroGRpc);

  await verifyNetwork(mantleProvider, 5003, "Mantle Sepolia");
  await verifyNetwork(zeroGProvider, 16602, "0G Galileo");

  const checks = [];
  for (const key of requiredMantle) {
    checks.push(requireCode(mantleProvider, `Mantle ${key}`, mantle.contracts?.[key]));
  }
  for (const key of requiredZeroG) {
    checks.push(requireCode(zeroGProvider, `0G ${key}`, zeroG.contracts?.[key]));
  }
  const paymentToken = testToken?.contracts?.paymentToken || process.env.VITE_PAYMENT_TOKEN_ADDRESS || process.env.PAYMENT_TOKEN_ADDRESS;
  if (paymentToken) {
    checks.push(requireCode(mantleProvider, "Mantle paymentToken", paymentToken));
  }
  await Promise.all(checks);

  console.log("Testnet wiring verified.");
  console.log(`Mantle Sepolia contracts: ${requiredMantle.length}`);
  console.log(`0G Galileo contracts: ${requiredZeroG.length}`);
  if (!paymentToken) {
    console.warn("WARN: Set VITE_PAYMENT_TOKEN_ADDRESS to a Mantle Sepolia ERC20 before deposit/withdraw testing.");
  } else {
    console.log(`Mantle Sepolia payment token: ${paymentToken}`);
  }
  if (!process.env.ZERO_G_PRIVATE_KEY && !process.env.DEPLOYER_PRIVATE_KEY) {
    console.warn("WARN: Set ZERO_G_PRIVATE_KEY for real 0G Storage upload tests.");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
