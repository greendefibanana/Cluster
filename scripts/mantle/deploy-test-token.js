import fs from "fs";
import path from "path";
import hre from "hardhat";

const { ethers } = hre;

function upsertEnvValue(filePath, key, value) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const next = pattern.test(existing)
    ? existing.replace(pattern, line)
    : `${existing.trimEnd()}\n${line}\n`;
  fs.writeFileSync(filePath, next);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("Missing deployer signer. Set DEPLOYER_PRIVATE_KEY before running deploy:test-token:mantle.");
  }

  const network = await ethers.provider.getNetwork();
  if (Number(network.chainId) !== 5003 && process.env.ALLOW_NON_MANTLE_TEST_TOKEN_DEPLOY !== "true") {
    throw new Error(`Refusing to deploy test token on chain ${network.chainId}; expected Mantle Sepolia chain 5003`);
  }

  const name = process.env.TEST_TOKEN_NAME || "ClusterFi Test USD";
  const symbol = process.env.TEST_TOKEN_SYMBOL || "cfUSD";
  const decimals = Number(process.env.TEST_TOKEN_DECIMALS || 18);
  const initialSupply = ethers.parseUnits(process.env.TEST_TOKEN_INITIAL_SUPPLY || "10000000", decimals);
  const maxMintPerTx = ethers.parseUnits(process.env.TEST_TOKEN_MAX_MINT_PER_TX || "10000", decimals);
  const faucetAmount = ethers.parseUnits(process.env.TEST_TOKEN_FAUCET_AMOUNT || "1000", decimals);

  console.log(`Deploying ${name} (${symbol}) to ${network.name} (${network.chainId}) from ${deployer.address}`);

  const PublicMintTestToken = await ethers.getContractFactory("PublicMintTestToken");
  const token = await PublicMintTestToken.deploy(
    name,
    symbol,
    decimals,
    deployer.address,
    initialSupply,
    maxMintPerTx,
    faucetAmount
  );
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  const deployment = {
    network: network.name,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      paymentToken: tokenAddress,
    },
    token: {
      name,
      symbol,
      decimals,
      initialSupply: initialSupply.toString(),
      maxMintPerTx: maxMintPerTx.toString(),
      faucetAmount: faucetAmount.toString(),
    },
  };

  fs.mkdirSync(path.join(process.cwd(), "deployments"), { recursive: true });
  const deploymentPath = path.join(process.cwd(), "deployments", "mantleSepolia-test-token.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  const frontendEnvPath = path.join(process.cwd(), "Frontend", ".env.testnet.local");
  if (fs.existsSync(frontendEnvPath)) {
    upsertEnvValue(frontendEnvPath, "VITE_PAYMENT_TOKEN_ADDRESS", tokenAddress);
  }

  console.log(JSON.stringify(deployment, null, 2));
  console.log(`Wrote ${deploymentPath}`);
  if (fs.existsSync(frontendEnvPath)) {
    console.log(`Updated ${frontendEnvPath}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
