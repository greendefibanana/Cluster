import fs from "fs";
import path from "path";
import hre from "hardhat";

const { ethers, network } = hre;

async function deploy(name, args = []) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const isMantleMainnet = chainId === 5000;
  const allowMockBridge = process.env.ALLOW_MOCK_BRIDGE === "true" && !isMantleMainnet;
  console.log(`Deploying Mantle-native ClusterFi modules to ${network.name} (${chainId}) from ${deployer.address}`);

  const registry = await deploy("SovereignAccountRegistry", [deployer.address]);
  const factory = await deploy("SovereignAccountFactory", [deployer.address, await registry.getAddress()]);
  await (await registry.setTrustedFactory(await factory.getAddress(), true)).wait();

  const intentEngine = await deploy("CrossChainIntentEngine", [deployer.address, await registry.getAddress()]);
  const sessionKeyManager = await deploy("SessionKeyManager");

  const mantleYieldAdapter = await deploy("MantleYieldAdapter");
  const ethereumYieldAdapter = await deploy("EthereumYieldAdapter");
  const solanaMemeAdapter = await deploy("SolanaMemeAdapter");
  const hyperliquidAdapter = await deploy("HyperliquidAdapter");
  const bnbLaunchAdapter = await deploy("BNBLaunchAdapter");
  const predictionMarketAdapter = await deploy("PredictionMarketAdapter");

  const supportedChains = [chainId, 1, 56, 8453, 42161, 7565164, 999999999];
  const mockBridgeAdapter = allowMockBridge ? await deploy("MockBridgeAdapter", [supportedChains]) : null;
  const acrossBridgeAdapter = await deploy("AcrossBridgeAdapter", [deployer.address, process.env.ACROSS_SPOKE_POOL || ethers.ZeroAddress, supportedChains]);
  if (isMantleMainnet) {
    await (await acrossBridgeAdapter.setSimulationMode(false)).wait();
  }
  const acrossIntentExecutor = await deploy("AcrossIntentExecutor");
  const acrossQuoteService = await deploy("AcrossQuoteService");

  const deployment = {
    network: network.name,
    chainId,
    mantleRole: "Sovereign Accounts, account abstraction permissions, social finance execution",
    zeroGRole: "AI inference, memory, validation, proofs, DA traces",
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      sovereignAccountRegistry: await registry.getAddress(),
      sovereignAccountFactory: await factory.getAddress(),
      crossChainIntentEngine: await intentEngine.getAddress(),
      sessionKeyManager: await sessionKeyManager.getAddress(),
      mantleYieldAdapter: await mantleYieldAdapter.getAddress(),
      ethereumYieldAdapter: await ethereumYieldAdapter.getAddress(),
      solanaMemeAdapter: await solanaMemeAdapter.getAddress(),
      hyperliquidAdapter: await hyperliquidAdapter.getAddress(),
      bnbLaunchAdapter: await bnbLaunchAdapter.getAddress(),
      predictionMarketAdapter: await predictionMarketAdapter.getAddress(),
      mockBridgeAdapter: mockBridgeAdapter ? await mockBridgeAdapter.getAddress() : null,
      acrossBridgeAdapter: await acrossBridgeAdapter.getAddress(),
      acrossIntentExecutor: await acrossIntentExecutor.getAddress(),
      acrossQuoteService: await acrossQuoteService.getAddress(),
    },
    explorers: {
      mantle: "https://explorer.mantle.xyz",
      mantleSepolia: "https://explorer.sepolia.mantle.xyz",
    },
  };

  fs.mkdirSync(path.join(process.cwd(), "deployments"), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), "deployments", `${network.name}.json`), JSON.stringify(deployment, null, 2));
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
