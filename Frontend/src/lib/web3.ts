import { createPublicClient, custom, decodeEventLog, http, parseAbi, parseEther, parseUnits, createWalletClient, formatUnits, encodeFunctionData, keccak256, stringToBytes } from "viem";
import { appEnv, runtimeMode } from "./env";
import type { JobListing, Bid, UserStrategyAccount } from "../types/domain";

const configuredChain = {
  id: appEnv.chainId,
  name: appEnv.chainName,
  nativeCurrency: {
    decimals: 18,
    name: appEnv.nativeCurrencyName,
    symbol: appEnv.nativeCurrencySymbol,
  },
  rpcUrls: {
    default: { http: appEnv.rpcUrl ? [appEnv.rpcUrl] : [appEnv.mantle.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "Explorer", url: appEnv.explorerBaseUrl },
  },
};

const agentChain = {
  id: appEnv.agentChain.chainId,
  name: appEnv.agentChain.chainName,
  nativeCurrency: {
    decimals: 18,
    name: appEnv.agentChain.nativeCurrencyName,
    symbol: appEnv.agentChain.nativeCurrencySymbol,
  },
  rpcUrls: {
    default: { http: [appEnv.agentChain.rpcUrl || appEnv.rpcUrl || appEnv.mantle.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "Explorer", url: appEnv.agentChain.explorerBaseUrl },
  },
};

export const publicClient = runtimeMode.hasRpc
  ? createPublicClient({
      chain: configuredChain,
      transport: http(appEnv.rpcUrl),
    })
  : null;

export const agentPublicClient = runtimeMode.hasAgentRpc
  ? createPublicClient({
      chain: agentChain,
      transport: http(appEnv.agentChain.rpcUrl || appEnv.rpcUrl),
    })
  : publicClient;

const agentNftAbi = parseAbi([
  "function tbas(uint256 agentId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function agentProfiles(uint256 agentId) view returns (string name, string role, string description)",
  "function totalSupply() view returns (uint256)",
  "function nextTokenId() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function mintAgent(address to, string calldata name, string calldata role, string calldata description, bytes32 salt) external returns (uint256 agentId, address tba)",
  "event AgentMinted(uint256 indexed agentId, address indexed owner, address indexed tba, string role)"
]);
const swarmNftAbi = parseAbi([
  "function tbas(uint256 swarmId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function swarmProfiles(uint256 swarmId) view returns (string name, string strategy, string description)",
  "function totalSupply() view returns (uint256)",
  "function nextTokenId() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function mintSwarm(address to, string calldata name, string calldata strategy, string calldata description, bytes32 salt) external returns (uint256 swarmId, address tba)",
  "event SwarmMinted(uint256 indexed swarmId, address indexed owner, address indexed tba, string strategy)"
]);
const performanceRankAbi = parseAbi(["function intelligenceScore(uint256 agentId) view returns (uint256)"]);
const skillManagerAbi = parseAbi([
  "function skillSlots(uint256 agentId) view returns (uint256)",
  "function canPost(uint256 agentId) view returns (bool)",
  "function agentLevel(uint256 agentId) view returns (uint256)",
  "function equippedSkillIds(uint256 agentId) view returns (uint256[])",
  "function equippedBalance(uint256 agentId, uint256 skillId) view returns (uint256)",
  "function equipSkill(uint256 agentId, uint256 skillId, uint256 amount) external"
]);
const skillNftAbi = parseAbi([
  "function getSkill(uint256 skillId) view returns (string name, string skillType, string capabilityTag, string description, string skillMarkdown)",
  "function totalSkillTypes() view returns (uint256)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function publicMintSkill(uint256 skillId, uint256 amount) external",
  "function setApprovalForAll(address operator, bool approved) external"
]);
const tokenFactoryAbi = parseAbi([
  "function deployToken(string name, string symbol, uint256 supply, address tokenOwner) returns (address)",
  "event WorkerTokenDeployed(address indexed token, address indexed owner, string name, string symbol, uint256 supply)"
]);
const workerTokenAbi = parseAbi(["function approve(address spender, uint256 amount) returns (bool)", "function allowance(address owner, address spender) view returns (uint256)"]);
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
]);
const strategyAccountFactoryAbi = parseAbi([
  "function createStrategyAccount(address user, address approvedAgentOrCluster, bytes32 strategyId, (address asset, uint256 maxAllocation, uint256 maxSlippageBps, address[] allowedAdapters) config) external returns (address account)",
  "function predictAccountAddress(address user, address approvedAgentOrCluster, bytes32 strategyId, address asset) view returns (address)",
  "function getUserAccounts(address user) view returns (address[])",
]);
const sovereignAccountFactoryAbi = parseAbi([
  "function createSovereignAccount(address accountOwner, string label, (uint256 maxAllocation, uint256 maxSlippageBps, string riskProfile, address[] approvedAdapters, uint256[] chainIds) config) external returns (address account)",
  "function predictSovereignAccount(address accountOwner, string label, string riskProfile) view returns (address)",
  "event SovereignAccountCreated(address indexed account, address indexed owner, bytes32 indexed accountSalt, string label)",
]);
const sovereignAccountRegistryAbi = parseAbi([
  "function accountsByOwner(address owner) view returns (address[])",
]);
const userStrategyAccountAbi = parseAbi([
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function pause() external",
  "function resume() external",
  "function revokeExecutor() external",
  "function close() external",
  "function owner() view returns (address)",
  "function approvedExecutor() view returns (address)",
  "function asset() view returns (address)",
  "function strategyId() view returns (bytes32)",
  "function maxAllocation() view returns (uint256)",
  "function maxSlippageBps() view returns (uint256)",
  "function active() view returns (bool)",
]);
const sovereignAccountAbi = parseAbi([
  "function deposit(address asset, uint256 amount) external",
  "function depositNative() payable",
  "function withdraw(address asset, uint256 amount) external",
  "function emergencyExit(address asset) external",
  "function pause() external",
  "function resume() external",
  "function owner() view returns (address)",
  "function maxAllocation() view returns (uint256)",
  "function maxSlippageBps() view returns (uint256)",
  "function paused() view returns (bool)",
  "function riskProfile() view returns (string)",
  "function closeStrategy(bytes32 strategyId) external",
  "function balances(address asset) view returns (uint256)",
]);
const liquidityManagerAbi = parseAbi([
  "function seedLiquidityWithNative(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountNativeMin, address lpRecipient, uint256 deadline) payable returns (uint256, uint256, uint256)"
]);
const agentJobMarketAbi = parseAbi([
  "struct Bid { uint8 providerKind; uint256 providerId; uint256 createdAt; }",
  "function createAgentJob(uint256 agentId, address evaluator, uint256 budget, uint256 expiredAt, string calldata description) external returns (uint256 jobId)",
  "function createOpenJob(address evaluator, uint256 budget, uint256 expiredAt, string calldata description) external returns (uint256 jobId)",
  "function placeBid(uint256 jobId, uint8 providerKind, uint256 providerId) external",
  "function acceptBid(uint256 jobId, uint256 bidIndex) external",
  "function fund(uint256 jobId, uint256 expectedBudget) external",
  "function jobs(uint256 jobId) view returns (address client, address evaluator, uint256 budget, uint256 expiredAt, uint8 providerKind, uint256 providerId, uint8 status, string description, string deliverable)",
  "function nextJobId() view returns (uint256)",
  "function getBids(uint256 jobId) view returns (Bid[])"
]);

export async function createOpenJob(
  walletClient: any,
  publicClient: any,
  ownerAddress: string,
  evaluator: string,
  budgetAmount: string,
  expiryDays: number,
  description: string
) {
  if (
    !walletClient ||
    !publicClient ||
    !appEnv.contracts.jobMarket ||
    !appEnv.contracts.paymentToken
  ) {
    throw new Error("Job Market or Payment Token not configured");
  }

  const budget = parseUnits(budgetAmount, 18);
  const expiry = BigInt(Math.floor(Date.now() / 1000) + expiryDays * 86400);
  await switchToAgentChain();

  // 1. Approve Job Market to spend tokens
  const currentAllowance = (await (publicClient as any).readContract({
    address: appEnv.contracts.paymentToken as `0x${string}`,
    abi: workerTokenAbi,
    functionName: "allowance",
    args: [ownerAddress as `0x${string}`, appEnv.contracts.jobMarket as `0x${string}`],
  })) as bigint;

  if (currentAllowance < budget) {
    const approveHash = await walletClient.writeContract({
      address: appEnv.contracts.paymentToken as `0x${string}`,
      abi: workerTokenAbi,
      functionName: "approve",
      args: [appEnv.contracts.jobMarket as `0x${string}`, budget],
      account: ownerAddress as `0x${string}`,
      chain: agentChain,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  // 2. Create Job
  const createHash = await walletClient.writeContract({
    address: appEnv.contracts.jobMarket as `0x${string}`,
    abi: agentJobMarketAbi,
    functionName: "createOpenJob",
    args: [evaluator as `0x${string}`, budget, expiry, description],
    account: ownerAddress as `0x${string}`,
    chain: agentChain,
  });
  const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });

  // 3. Find Job ID
  const nextJobId = (await (publicClient as any).readContract({
    address: appEnv.contracts.jobMarket as `0x${string}`,
    abi: agentJobMarketAbi,
    functionName: "nextJobId",
  })) as bigint;
  const jobId = nextJobId - 1n;

  return { jobId: jobId.toString(), txHash: createReceipt.transactionHash };
}

export async function placeBid(
  walletClient: any,
  publicClient: any,
  ownerAddress: string,
  jobId: string,
  providerKind: number,
  providerId: string
) {
  if (!walletClient || !publicClient || !appEnv.contracts.jobMarket) {
    throw new Error("Job Market not configured");
  }
  await switchToAgentChain();

  const hash = await walletClient.writeContract({
    address: appEnv.contracts.jobMarket as `0x${string}`,
    abi: agentJobMarketAbi,
    functionName: "placeBid",
    args: [BigInt(jobId), providerKind, BigInt(providerId)],
    account: ownerAddress as `0x${string}`,
    chain: agentChain,
  });
  return await publicClient.waitForTransactionReceipt({ hash });
}

export async function acceptBid(
  walletClient: any,
  publicClient: any,
  ownerAddress: string,
  jobId: string,
  bidIndex: number,
  budget: bigint
) {
  if (
    !walletClient ||
    !publicClient ||
    !appEnv.contracts.jobMarket ||
    !appEnv.contracts.paymentToken
  ) {
    throw new Error("Job Market or Payment Token not configured");
  }
  await switchToAgentChain();

  // 1. Accept Bid
  const acceptHash = await walletClient.writeContract({
    address: appEnv.contracts.jobMarket as `0x${string}`,
    abi: agentJobMarketAbi,
    functionName: "acceptBid",
    args: [BigInt(jobId), BigInt(bidIndex)],
    account: ownerAddress as `0x${string}`,
    chain: agentChain,
  });
  await publicClient.waitForTransactionReceipt({ hash: acceptHash });

  // 2. Fund Job
  const fundHash = await walletClient.writeContract({
    address: appEnv.contracts.jobMarket as `0x${string}`,
    abi: agentJobMarketAbi,
    functionName: "fund",
    args: [BigInt(jobId), budget],
    account: ownerAddress as `0x${string}`,
    chain: agentChain,
  });
  return await publicClient.waitForTransactionReceipt({ hash: fundHash });
}


export interface EIP6963ProviderDetail {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: any;
}

const discoveredProviders: EIP6963ProviderDetail[] = [];

if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (event: any) => {
    discoveredProviders.push(event.detail);
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

export function getDiscoveredProviders(): EIP6963ProviderDetail[] {
  if (discoveredProviders.length > 0) return discoveredProviders;

  // Fallback to traditional window.ethereum
  const eth = typeof window !== "undefined" ? (window.ethereum as any) : null;
  if (eth) {
    if (eth.providers) {
      return eth.providers.map((p: any) => ({
        info: {
          uuid: p.isMetaMask ? "metamask" : p.isPhantom ? "phantom" : Math.random().toString(),
          name: p.isMetaMask ? "MetaMask" : p.isPhantom ? "Phantom" : "Injected",
          icon: "",
          rdns: p.isMetaMask ? "io.metamask" : p.isPhantom ? "app.phantom" : "",
        },
        provider: p,
      }));
    }
    return [
      {
        info: {
          uuid: "default",
          name: eth.isMetaMask ? "MetaMask" : eth.isPhantom ? "Phantom" : "Injected",
          icon: "",
          rdns: "",
        },
        provider: eth,
      },
    ];
  }
  return [];
}

let activeProvider: any = typeof window !== "undefined" ? window.ethereum : null;
type DynamicWalletClient = {
  writeContract: (input: unknown) => Promise<`0x${string}`>;
};

let activeWalletClient: DynamicWalletClient | null = null;
let activeSignMessage: ((message: string) => Promise<string | undefined>) | null = null;
let activeSwitchNetwork: ((chainId: number) => Promise<void>) | null = null;

export function setDynamicWalletSession(input: {
  walletClient: DynamicWalletClient;
  signMessage?: (message: string) => Promise<string | undefined>;
  switchNetwork?: (chainId: number) => Promise<void>;
}) {
  activeWalletClient = input.walletClient;
  activeSignMessage = input.signMessage ?? null;
  activeSwitchNetwork = input.switchNetwork ?? null;
  activeProvider = null;
}

export function clearDynamicWalletSession() {
  activeWalletClient = null;
  activeSignMessage = null;
  activeSwitchNetwork = null;
}

async function switchToChain(chain: typeof configuredChain): Promise<void> {
  if (activeSwitchNetwork) {
    await activeSwitchNetwork(chain.id);
    return;
  }

  if (!activeProvider) {
    throw new Error("No wallet connected");
  }

  const hexChainId = `0x${chain.id.toString(16)}`;

  try {
    await activeProvider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });
  } catch {
    await activeProvider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexChainId,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls.default.http,
          blockExplorerUrls: [chain.blockExplorers.default.url],
        },
      ],
    });
  }
}

export async function switchToConfiguredChain(): Promise<void> {
  return switchToChain(configuredChain);
}

export async function switchToAgentChain(): Promise<void> {
  return switchToChain(agentChain);
}

export async function connectInjectedWallet(provider?: any): Promise<{ account: string; chainId: number }> {
  clearDynamicWalletSession();

  // If no provider passed, try to find MetaMask specifically if it exists, otherwise use window.ethereum
  let targetProvider = provider;
  
  if (!targetProvider && typeof window !== "undefined") {
    const providers = getDiscoveredProviders();
    const metamask = providers.find(p => p.info.rdns === "io.metamask" || p.info.name.toLowerCase().includes("metamask"));
    targetProvider = metamask ? metamask.provider : window.ethereum;
  }

  if (!targetProvider) {
    throw new Error("Install an injected EVM wallet to continue");
  }

  activeProvider = targetProvider;
  console.log("Connecting to provider:", activeProvider);

  try {
    // Force a request for accounts to trigger the popup
    const accounts = (await activeProvider.request({
      method: "eth_requestAccounts",
    })) as string[];
    
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts returned from wallet");
    }

    const account = accounts[0];
    const chainIdHex = (await activeProvider.request({ method: "eth_chainId" })) as string;

    console.log("Connected account:", account, "Chain ID:", chainIdHex);

    return {
      account,
      chainId: Number.parseInt(chainIdHex, 16),
    };
  } catch (err: any) {
    console.error("Wallet connection error:", err);
    throw new Error(err.message || "User rejected the connection request");
  }
}

export async function requestSignature(message: string): Promise<string> {
  if (activeSignMessage) {
    const signature = await activeSignMessage(message);
    if (!signature) {
      throw new Error("Wallet did not return a signature");
    }
    return signature;
  }

  if (!activeProvider) {
    throw new Error("No wallet connected");
  }

  const [account] = (await activeProvider.request({
    method: "eth_accounts",
  })) as string[];

  if (!account) {
    throw new Error("No account found for signature");
  }

  const signature = await activeProvider.request({
    method: "personal_sign",
    params: [message, account],
  });

  return signature;
}

export async function disconnectInjectedWallet(): Promise<void> {
  activeProvider = null;
  clearDynamicWalletSession();
  return Promise.resolve();
}

export function getWalletClient() {
  if (activeWalletClient) {
    return activeWalletClient;
  }

  const provider = activeProvider || (typeof window !== "undefined" ? (window as any).ethereum : null);
  if (!provider) {
    return null;
  }

  return createWalletClient({
    transport: custom(provider),
  });
}

export function getPublicClient() {
  return publicClient;
}

export function getAgentPublicClient() {
  return agentPublicClient || publicClient;
}

export function strategyIdToBytes32(strategyId: string): `0x${string}` {
  if (/^0x[0-9a-fA-F]{64}$/.test(strategyId)) {
    return strategyId as `0x${string}`;
  }
  return keccak256(stringToBytes(strategyId || "clusterfi-strategy"));
}

export function adapterForInstrument(instrumentType?: string): string {
  const adapter =
    instrumentType === "meme"
      ? appEnv.contracts.bnbLaunchAdapter || appEnv.contracts.solanaMemeAdapter || appEnv.contracts.mockMemeAdapter
      : instrumentType === "lp"
        ? appEnv.contracts.ethereumYieldAdapter || appEnv.contracts.mockLpAdapter
        : instrumentType === "prediction"
          ? appEnv.contracts.predictionMarketAdapter || appEnv.contracts.mockPredictionMarketAdapter
          : appEnv.contracts.mantleYieldAdapter || appEnv.contracts.mockYieldAdapter;

  if (!adapter) {
    throw new Error(`No strategy adapter configured for ${instrumentType || "yield"}`);
  }
  return adapter;
}

export async function createUserStrategyAccount(
  ownerAddress: string,
  approvedExecutor: string,
  strategyId: string,
  instrumentType: string | undefined,
  maxAllocationAmount: string,
  maxSlippageBps = 100
) {
  const walletClient = getWalletClient();
  if (!walletClient || !publicClient) {
    throw new Error("Wallet or Mantle testnet RPC is not configured");
  }
  if (!appEnv.contracts.userStrategyAccountFactory && !appEnv.contracts.sovereignAccountFactory) {
    throw new Error("Strategy account factory is not configured");
  }
  await switchToConfiguredChain();

  const adapter = adapterForInstrument(instrumentType);
  const strategyHash = strategyIdToBytes32(strategyId);
  const maxAllocation = parseUnits(maxAllocationAmount, 18);
  if (appEnv.contracts.sovereignAccountFactory) {
    const label = `ClusterFi ${strategyId || "strategy"}`.slice(0, 64);
    const riskProfile = maxSlippageBps <= 100 ? "moderate" : "aggressive";
    const predicted = await (publicClient as any).readContract({
      address: appEnv.contracts.sovereignAccountFactory as `0x${string}`,
      abi: sovereignAccountFactoryAbi,
      functionName: "predictSovereignAccount",
      args: [ownerAddress as `0x${string}`, label, riskProfile],
    });
    const hash = await walletClient.writeContract({
      address: appEnv.contracts.sovereignAccountFactory as `0x${string}`,
      abi: sovereignAccountFactoryAbi,
      functionName: "createSovereignAccount",
      args: [
        ownerAddress as `0x${string}`,
        label,
        {
          maxAllocation,
          maxSlippageBps: BigInt(maxSlippageBps),
          riskProfile,
          approvedAdapters: [adapter as `0x${string}`],
          chainIds: Array.from(new Set([appEnv.chainId, appEnv.agentChain.chainId])).map(BigInt),
        },
      ],
      account: ownerAddress as `0x${string}`,
      chain: configuredChain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return { accountAddress: predicted as string, txHash: hash, adapter };
  }

  if (!appEnv.contracts.userStrategyAccountFactory || !appEnv.contracts.paymentToken) {
    throw new Error("Legacy strategy account factory or payment token is not configured");
  }

  const asset = appEnv.contracts.paymentToken as `0x${string}`;
  const predicted = await (publicClient as any).readContract({
    address: appEnv.contracts.userStrategyAccountFactory as `0x${string}`,
    abi: strategyAccountFactoryAbi,
    functionName: "predictAccountAddress",
    args: [ownerAddress as `0x${string}`, approvedExecutor as `0x${string}`, strategyHash, asset],
  });

  const hash = await walletClient.writeContract({
    address: appEnv.contracts.userStrategyAccountFactory as `0x${string}`,
    abi: strategyAccountFactoryAbi,
    functionName: "createStrategyAccount",
    args: [
      ownerAddress as `0x${string}`,
      approvedExecutor as `0x${string}`,
      strategyHash,
      {
        asset,
        maxAllocation,
        maxSlippageBps: BigInt(maxSlippageBps),
        allowedAdapters: [adapter as `0x${string}`],
      },
    ],
    account: ownerAddress as `0x${string}`,
    chain: configuredChain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return { accountAddress: predicted as string, txHash: hash, adapter };
}

export async function depositToUserStrategyAccount(
  ownerAddress: string,
  accountAddress: string,
  amount: string,
  asset: "erc20" | "native" = "erc20"
) {
  const walletClient = getWalletClient();
  if (!walletClient || !publicClient) {
    throw new Error("Wallet or RPC is not configured");
  }
  await switchToConfiguredChain();

  const parsedAmount = parseUnits(amount, 18);
  if (appEnv.contracts.sovereignAccountFactory && asset === "native") {
    const hash = await walletClient.writeContract({
      address: accountAddress as `0x${string}`,
      abi: sovereignAccountAbi,
      functionName: "depositNative",
      args: [],
      value: parsedAmount,
      account: ownerAddress as `0x${string}`,
      chain: configuredChain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  if (!appEnv.contracts.paymentToken) {
    throw new Error("Payment token is not configured");
  }

  const allowance = (await (publicClient as any).readContract({
    address: appEnv.contracts.paymentToken as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: [ownerAddress as `0x${string}`, accountAddress as `0x${string}`],
  })) as bigint;

  if (allowance < parsedAmount) {
    const approveHash = await walletClient.writeContract({
      address: appEnv.contracts.paymentToken as `0x${string}`,
      abi: erc20Abi,
      functionName: "approve",
      args: [accountAddress as `0x${string}`, parsedAmount],
      account: ownerAddress as `0x${string}`,
      chain: configuredChain,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const accountAbi = appEnv.contracts.sovereignAccountFactory ? sovereignAccountAbi : userStrategyAccountAbi;
  const depositArgs = appEnv.contracts.sovereignAccountFactory
    ? [appEnv.contracts.paymentToken as `0x${string}`, parsedAmount]
    : [parsedAmount];
  const hash = await walletClient.writeContract({
    address: accountAddress as `0x${string}`,
    abi: accountAbi,
    functionName: "deposit",
    args: depositArgs,
    account: ownerAddress as `0x${string}`,
    chain: configuredChain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function pauseUserStrategyAccount(ownerAddress: string, accountAddress: string) {
  return writeUserStrategyAccount(ownerAddress, accountAddress, "pause", []);
}

export async function resumeUserStrategyAccount(ownerAddress: string, accountAddress: string) {
  return writeUserStrategyAccount(ownerAddress, accountAddress, "resume", []);
}

export async function revokeUserStrategyExecutor(ownerAddress: string, accountAddress: string) {
  if (appEnv.contracts.sovereignAccountFactory) {
    return writeUserStrategyAccount(ownerAddress, accountAddress, "pause", []);
  }
  return writeUserStrategyAccount(ownerAddress, accountAddress, "revokeExecutor", []);
}

export async function withdrawFromUserStrategyAccount(
  ownerAddress: string,
  accountAddress: string,
  amount: string,
  asset: "erc20" | "native" = "erc20"
) {
  if (appEnv.contracts.sovereignAccountFactory) {
    if (asset === "erc20" && !appEnv.contracts.paymentToken) throw new Error("Payment token is not configured");
    return writeUserStrategyAccount(ownerAddress, accountAddress, "withdraw", [
      (asset === "native" ? "0x0000000000000000000000000000000000000000" : appEnv.contracts.paymentToken) as `0x${string}`,
      parseUnits(amount, 18),
    ]);
  }
  return writeUserStrategyAccount(ownerAddress, accountAddress, "withdraw", [parseUnits(amount, 18)]);
}

export async function closeUserStrategyAccount(ownerAddress: string, accountAddress: string, asset: "erc20" | "native" = "erc20") {
  if (appEnv.contracts.sovereignAccountFactory) {
    if (asset === "erc20" && !appEnv.contracts.paymentToken) throw new Error("Payment token is not configured");
    return writeUserStrategyAccount(ownerAddress, accountAddress, "emergencyExit", [
      (asset === "native" ? "0x0000000000000000000000000000000000000000" : appEnv.contracts.paymentToken) as `0x${string}`,
    ]);
  }
  return writeUserStrategyAccount(ownerAddress, accountAddress, "close", []);
}

export async function fetchUserStrategyAccounts(ownerAddress: string): Promise<UserStrategyAccount[]> {
  if (!publicClient) {
    return [];
  }

  try {
    if (appEnv.contracts.sovereignAccountFactory && appEnv.contracts.sovereignAccountRegistry) {
      const accountAddresses = (await (publicClient as any).readContract({
        address: appEnv.contracts.sovereignAccountRegistry as `0x${string}`,
        abi: sovereignAccountRegistryAbi,
        functionName: "accountsByOwner",
        args: [ownerAddress as `0x${string}`],
      })) as string[];

      const asset = appEnv.contracts.paymentToken as `0x${string}` | "";
      const accounts: UserStrategyAccount[] = [];
      for (const accountAddress of accountAddresses) {
        const [maxAllocation, maxSlippageBps, paused, riskProfile, erc20Balance, nativeBalance] = await Promise.all([
          (publicClient as any).readContract({
            address: accountAddress as `0x${string}`,
            abi: sovereignAccountAbi,
            functionName: "maxAllocation",
          }),
          (publicClient as any).readContract({
            address: accountAddress as `0x${string}`,
            abi: sovereignAccountAbi,
            functionName: "maxSlippageBps",
          }),
          (publicClient as any).readContract({
            address: accountAddress as `0x${string}`,
            abi: sovereignAccountAbi,
            functionName: "paused",
          }),
          (publicClient as any).readContract({
            address: accountAddress as `0x${string}`,
            abi: sovereignAccountAbi,
            functionName: "riskProfile",
          }),
          asset
            ? (publicClient as any).readContract({
                address: accountAddress as `0x${string}`,
                abi: sovereignAccountAbi,
                functionName: "balances",
                args: [asset],
              })
            : Promise.resolve(0n),
          (publicClient as any).readContract({
            address: accountAddress as `0x${string}`,
            abi: sovereignAccountAbi,
            functionName: "balances",
            args: ["0x0000000000000000000000000000000000000000"],
          }),
        ]);

        const balanceParts = [
          nativeBalance > 0n ? `${formatUnits(nativeBalance, 18)} ${appEnv.nativeCurrencySymbol}` : "",
          erc20Balance > 0n || asset ? `${formatUnits(erc20Balance, 18)} ${asset ? "cfUSD" : "asset"}` : "",
        ].filter(Boolean);

        accounts.push({
          id: accountAddress,
          ownerAddress,
          accountAddress,
          approvedExecutor: "Policy-gated",
          executorLabel: "Policy-gated",
          strategyId: accountAddress,
          strategyTitle: `Sovereign ${truncateAddressForUi(accountAddress)}`,
          assetSymbol: asset ? `${appEnv.nativeCurrencySymbol}/cfUSD` : appEnv.nativeCurrencySymbol,
          balanceLabel: balanceParts.length ? balanceParts.join(" + ") : `0 ${appEnv.nativeCurrencySymbol}`,
          maxAllocationLabel: `${formatUnits(maxAllocation, 18)} ${appEnv.nativeCurrencySymbol}/cfUSD`,
          maxSlippageBps: Number(maxSlippageBps),
          allowedAdapters: ["Mantle testnet adapters"],
          status: paused ? "paused" : "active",
          pnlLabel: "Pending",
          proofURI: "",
          riskProfile,
        });
      }
      return accounts;
    }

    if (!appEnv.contracts.userStrategyAccountFactory || !appEnv.contracts.paymentToken) {
      return [];
    }

    const accountAddresses = (await (publicClient as any).readContract({
      address: appEnv.contracts.userStrategyAccountFactory as `0x${string}`,
      abi: strategyAccountFactoryAbi,
      functionName: "getUserAccounts",
      args: [ownerAddress as `0x${string}`],
    })) as string[];

    const accounts: UserStrategyAccount[] = [];
    for (const accountAddress of accountAddresses) {
      const [approvedExecutor, strategyId, maxAllocation, maxSlippageBps, active, balance] = await Promise.all([
        (publicClient as any).readContract({
          address: accountAddress as `0x${string}`,
          abi: userStrategyAccountAbi,
          functionName: "approvedExecutor",
        }),
        (publicClient as any).readContract({
          address: accountAddress as `0x${string}`,
          abi: userStrategyAccountAbi,
          functionName: "strategyId",
        }),
        (publicClient as any).readContract({
          address: accountAddress as `0x${string}`,
          abi: userStrategyAccountAbi,
          functionName: "maxAllocation",
        }),
        (publicClient as any).readContract({
          address: accountAddress as `0x${string}`,
          abi: userStrategyAccountAbi,
          functionName: "maxSlippageBps",
        }),
        (publicClient as any).readContract({
          address: accountAddress as `0x${string}`,
          abi: userStrategyAccountAbi,
          functionName: "active",
        }),
        (publicClient as any).readContract({
          address: appEnv.contracts.paymentToken as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [accountAddress as `0x${string}`],
        }),
      ]);

      accounts.push({
        id: accountAddress,
        ownerAddress,
        accountAddress,
        approvedExecutor,
        executorLabel: truncateAddressForUi(approvedExecutor),
        strategyId,
        strategyTitle: `Strategy ${String(strategyId).slice(0, 10)}`,
        assetSymbol: "mUSD",
        balanceLabel: `${formatUnits(balance, 18)} mUSD`,
        maxAllocationLabel: `${formatUnits(maxAllocation, 18)} mUSD`,
        maxSlippageBps: Number(maxSlippageBps),
        allowedAdapters: ["Configured adapter"],
        status: approvedExecutor === "0x0000000000000000000000000000000000000000" ? "revoked" : active ? "active" : "paused",
        pnlLabel: "Pending",
        proofURI: "",
        riskProfile: "medium",
      });
    }
    return accounts;
  } catch (error) {
    console.error("Failed to fetch Sovereign Accounts:", error);
    return [];
  }
}

function truncateAddressForUi(address: string) {
  return address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

async function writeUserStrategyAccount(ownerAddress: string, accountAddress: string, functionName: string, args: unknown[]) {
  const walletClient = getWalletClient();
  if (!walletClient || !publicClient) {
    throw new Error("Wallet or RPC is not configured");
  }
  await switchToConfiguredChain();
  const hash = await walletClient.writeContract({
    address: accountAddress as `0x${string}`,
    abi: appEnv.contracts.sovereignAccountFactory ? sovereignAccountAbi : userStrategyAccountAbi,
    functionName,
    args,
    account: ownerAddress as `0x${string}`,
    chain: configuredChain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}


export async function fetchJobs(publicClient: any): Promise<JobListing[]> {
  const client = publicClient || agentPublicClient;
  if (!client || !appEnv.contracts.jobMarket) {
    return [];
  }

  try {
    const nextJobId = (await (client as any).readContract({
      address: appEnv.contracts.jobMarket as `0x${string}`,
      abi: agentJobMarketAbi,
      functionName: "nextJobId",
    })) as bigint;

    const jobCount = Number(nextJobId) - 1;
    const jobs: JobListing[] = [];

    for (let i = 1; i <= jobCount; i++) {
      const jobData = (await (client as any).readContract({
        address: appEnv.contracts.jobMarket as `0x${string}`,
        abi: agentJobMarketAbi,
        functionName: "jobs",
        args: [BigInt(i)],
      })) as any;

      const [
        client,
        evaluator,
        budget,
        expiredAt,
        providerKind,
        providerId,
        status,
        description,
        deliverable
      ] = jobData;

      const bidsData = (await (client as any).readContract({
        address: appEnv.contracts.jobMarket as `0x${string}`,
        abi: agentJobMarketAbi,
        functionName: "getBids",
        args: [BigInt(i)],
      })) as any[];

      const bids: Bid[] = bidsData.map((b: any) => ({
        providerKind: Number(b.providerKind),
        providerId: b.providerId.toString(),
        createdAt: Number(b.createdAt)
      }));

      const statusLabels = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired"];
      const accents: ("primary" | "secondary" | "tertiary" | "error")[] = ["primary", "secondary", "tertiary", "error"];

      jobs.push({
        id: i.toString(),
        title: description.split("\n")[0] || "Untitled Job",
        subtitle: `Status: ${statusLabels[status]}`,
        rewardLabel: `${formatUnits(budget, 18)} x402`,
        durationLabel: new Date(Number(expiredAt) * 1000).toLocaleDateString(),
        bidCount: bids.length,
        stateLabel: statusLabels[status],
        accent: accents[i % accents.length],
        summary: description,
        creditedAgents: providerKind === 0 ? [providerId.toString()] : [], 
        clientAddress: client,
        evaluatorAddress: evaluator,
        budget: budget.toString(),
        status: Number(status),
        providerKind: Number(providerKind),
        providerId: providerId.toString(),
        bids: bids
      });
    }

    return jobs;
  } catch (error) {
    console.error("Failed to fetch jobs:", error);
    return [];
  }
}

export async function fetchSkillsForAgent(agentId: string) {
  const client = agentPublicClient;
  if (!client || !appEnv.contracts.skillManager || !appEnv.contracts.skillNft) return [];
  
  const id = BigInt(agentId);
  const equippedIds: readonly bigint[] = await (client as any).readContract({
    address: appEnv.contracts.skillManager as `0x${string}`,
    abi: skillManagerAbi,
    functionName: "equippedSkillIds",
    args: [id],
  });

  const skills = [];
  for (let i = 0; i < equippedIds.length; i++) {
    const skillId = equippedIds[i];
    const [name, skillType, capabilityTag] = await (client as any).readContract({
      address: appEnv.contracts.skillNft as `0x${string}`,
      abi: skillNftAbi,
      functionName: "getSkill",
      args: [skillId],
    });
    
    const balance = await (client as any).readContract({
      address: appEnv.contracts.skillManager as `0x${string}`,
      abi: skillManagerAbi,
      functionName: "equippedBalance",
      args: [id, skillId],
    });

    skills.push({
      slotId: `slot-${agentId}-${skillId.toString()}`,
      name,
      level: Number(balance),
      icon: skillType === "execution" ? "rocket_launch" : skillType === "defi" ? "account_balance" : "forum",
      accent: (skillType === "execution" ? "primary" : skillType === "defi" ? "secondary" : "tertiary") as "primary" | "secondary" | "tertiary",
      equipped: true,
      capabilityTag,
    });
  }
  
  return skills;
}

export async function fetchAgentsForOwner(ownerAddress: string) {
  const client = agentPublicClient;
  if (
    !client ||
    !appEnv.contracts.agentNft ||
    !appEnv.contracts.performanceRank ||
    !appEnv.contracts.skillManager
  ) {
    return [];
  }

  const balance = await (client as any).readContract({
    address: appEnv.contracts.agentNft as `0x${string}`,
    abi: agentNftAbi,
    functionName: "balanceOf",
    args: [ownerAddress as `0x${string}`],
  });

  const agents = [];
  for (let i = 0; i < Number(balance); i++) {
    const tokenId = await (client as any).readContract({
      address: appEnv.contracts.agentNft as `0x${string}`,
      abi: agentNftAbi,
      functionName: "tokenOfOwnerByIndex",
      args: [ownerAddress as `0x${string}`, BigInt(i)],
    });

    const [tbaAddress, score, slots, [name, role, description], equippedSkills] = await Promise.all([
      client.readContract({
        address: appEnv.contracts.agentNft as `0x${string}`,
        abi: agentNftAbi,
        functionName: "tbas",
        args: [tokenId],
      }),
      client.readContract({
        address: appEnv.contracts.performanceRank as `0x${string}`,
        abi: performanceRankAbi,
        functionName: "intelligenceScore",
        args: [tokenId],
      }),
      client.readContract({
        address: appEnv.contracts.skillManager as `0x${string}`,
        abi: skillManagerAbi,
        functionName: "skillSlots",
        args: [tokenId],
      }),
      client.readContract({
        address: appEnv.contracts.agentNft as `0x${string}`,
        abi: agentNftAbi,
        functionName: "agentProfiles",
        args: [tokenId],
      }),
      fetchSkillsForAgent(tokenId.toString())
    ]);

    // Pad open slots
    const totalSlots = Number(slots);
    const skills = [...equippedSkills];
    while (skills.length < totalSlots) {
      skills.push({
        slotId: `slot-open-${tokenId}-${skills.length}`,
        name: "Empty Slot",
        level: 0,
        icon: "add",
        accent: "primary",
        equipped: false,
        capabilityTag: undefined,
      });
    }

    agents.push({
      id: tokenId.toString(),
      name,
      title: role,
      description,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${tbaAddress}&colors=111827`,
      ownerAddress,
      tbaAddress,
      rank: 1 + i, // Mocking rank relative to index for now, usually needs a secondary index
      score: Number(score),
      winRate: 85 + (Number(score) % 15), // Mock derived stat
      lifetimeYieldLabel: "0.00 AURA",
      evolutionTier: Number(score) > 90 ? "Apex" : Number(score) > 50 ? "Legendary" : "Base",
      followerCount: Number(score) * 420,
      auraLabel: "0",
      alphaRate: Number(score),
      status: "active" as const,
      tags: [],
      performanceSeries: [20, 35, 25, 50, 45, 70, 60, 80],
      skills,
      proofs: [],
      vaultAssets: [],
    });
  }

  return agents;
}

export async function mintSwarm(
  ownerAddress: string,
  name: string,
  strategy: string,
  description: string,
  salt: `0x${string}`
) {
  const walletClient = getWalletClient();
  const client = agentPublicClient;
  if (!walletClient || !client) throw new Error("Wallet or 0G testnet RPC not available. Please try reconnecting.");
  if (!appEnv.contracts.swarmNft) throw new Error("Swarm NFT contract address not found. Please restart your Vite dev server.");
  await switchToAgentChain();

  const hash = await walletClient.writeContract({
    address: appEnv.contracts.swarmNft as `0x${string}`,
    abi: swarmNftAbi,
    functionName: "mintSwarm",
    args: [ownerAddress as `0x${string}`, name, strategy, description, salt],
    account: ownerAddress as `0x${string}`,
    chain: agentChain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  const minted = receipt.logs
    .filter((log) => log.address.toLowerCase() === appEnv.contracts.swarmNft.toLowerCase())
    .map((log) => {
      try {
        return decodeEventLog({ abi: swarmNftAbi, data: log.data, topics: log.topics });
      } catch {
        return null;
      }
    })
    .find((event) => event?.eventName === "SwarmMinted");

  const args = minted?.args as { swarmId?: bigint; tba?: `0x${string}` } | undefined;
  return {
    hash,
    swarmId: args?.swarmId?.toString() ?? null,
    tbaAddress: args?.tba ?? null,
  };
}

export async function fetchSwarmsForOwner(ownerAddress: string) {
  const client = agentPublicClient;
  if (!client || !appEnv.contracts.swarmNft) {
    return [];
  }

  try {
    const balance = await (client as any).readContract({
      address: appEnv.contracts.swarmNft as `0x${string}`,
      abi: swarmNftAbi,
      functionName: "balanceOf",
      args: [ownerAddress as `0x${string}`],
    });

    const swarms = [];
    for (let i = 0; i < Number(balance); i++) {
      const tokenId = await (client as any).readContract({
        address: appEnv.contracts.swarmNft as `0x${string}`,
        abi: swarmNftAbi,
        functionName: "tokenOfOwnerByIndex",
        args: [ownerAddress as `0x${string}`, BigInt(i)],
      });

      const [tbaAddress, [name, strategy, description]] = await Promise.all([
        client.readContract({
          address: appEnv.contracts.swarmNft as `0x${string}`,
          abi: swarmNftAbi,
          functionName: "tbas",
          args: [tokenId],
        }),
        client.readContract({
          address: appEnv.contracts.swarmNft as `0x${string}`,
          abi: swarmNftAbi,
          functionName: "swarmProfiles",
          args: [tokenId],
        }),
      ]);

      const swarmAgents = await fetchAgentsForOwner(tbaAddress);

      swarms.push({
        id: tokenId.toString(),
        name,
        strategy,
        description,
        ownerAddress,
        tbaAddress,
        memberCount: swarmAgents.length,
        tvlLabel: "0.00 BNB",
        roiLabel: "0%",
        status: "active" as const,
        agents: swarmAgents,
      });
    }

    return swarms;
  } catch (error) {
    console.error("Failed to fetch swarms:", error);
    return [];
  }
}

export async function assignAgentToSwarm(
  ownerAddress: string,
  agentId: string,
  swarmTbaAddress: string
) {
  const walletClient = getWalletClient();
  if (!walletClient || !appEnv.contracts.agentNft) throw new Error("Wallet or contract not available");
  await switchToAgentChain();

  const hash = await walletClient.writeContract({
    address: appEnv.contracts.agentNft as `0x${string}`,
    abi: parseAbi(["function safeTransferFrom(address from, address to, uint256 tokenId)"]),
    functionName: "safeTransferFrom",
    args: [ownerAddress as `0x${string}`, swarmTbaAddress as `0x${string}`, BigInt(agentId)],
    account: ownerAddress as `0x${string}`,
    chain: agentChain,
  });

  return hash;
}

export async function removeAgentFromSwarm(
  ownerAddress: string,
  swarmTbaAddress: string,
  agentId: string
) {
  const walletClient = getWalletClient();
  if (!walletClient || !appEnv.contracts.agentNft) throw new Error("Wallet or contract not available");
  await switchToAgentChain();

  const data = encodeFunctionData({
    abi: parseAbi(["function safeTransferFrom(address from, address to, uint256 tokenId)"]),
    functionName: "safeTransferFrom",
    args: [swarmTbaAddress as `0x${string}`, ownerAddress as `0x${string}`, BigInt(agentId)],
  });

  const hash = await walletClient.writeContract({
    address: swarmTbaAddress as `0x${string}`,
    abi: parseAbi(["function execute(address to, uint256 value, bytes calldata data, uint8 operation)"]),
    functionName: "execute",
    args: [appEnv.contracts.agentNft as `0x${string}`, 0n, data, 0],
    account: ownerAddress as `0x${string}`,
    chain: agentChain,
  });

  return hash;
}

export async function mintNewAgent(ownerAddress: string, name: string, role: string, description: string) {
  const walletClient = getWalletClient();
  const client = agentPublicClient;
  if (!walletClient || !appEnv.contracts.agentNft || !client) throw new Error("Wallet, contract, or 0G testnet RPC not available");
  await switchToAgentChain();

  const saltBytes = new Uint8Array(32);
  crypto.getRandomValues(saltBytes);
  const saltHex = "0x" + Array.from(saltBytes).map(b => b.toString(16).padStart(2, "0")).join("") as `0x${string}`;

  const hash = await walletClient.writeContract({
    address: appEnv.contracts.agentNft as `0x${string}`,
    abi: agentNftAbi,
    functionName: "mintAgent",
    args: [ownerAddress as `0x${string}`, name, role, description, saltHex],
    account: ownerAddress as `0x${string}`,
    chain: agentChain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  const minted = receipt.logs
    .filter((log) => log.address.toLowerCase() === appEnv.contracts.agentNft.toLowerCase())
    .map((log) => {
      try {
        return decodeEventLog({ abi: agentNftAbi, data: log.data, topics: log.topics });
      } catch {
        return null;
      }
    })
    .find((event) => event?.eventName === "AgentMinted");

  const args = minted?.args as { agentId?: bigint; tba?: `0x${string}` } | undefined;
  return {
    hash,
    agentId: args?.agentId?.toString() ?? null,
    tbaAddress: args?.tba ?? null,
  };
}

export async function mintSkill(ownerAddress: string, skillId: number, amount: number = 1) {
  const walletClient = getWalletClient();
  if (!walletClient || !appEnv.contracts.skillNft) throw new Error("Wallet or contract not available");
  await switchToAgentChain();

  const hash = await walletClient.writeContract({
    address: appEnv.contracts.skillNft as `0x${string}`,
    abi: skillNftAbi,
    functionName: "publicMintSkill",
    args: [BigInt(skillId), BigInt(amount)],
    account: ownerAddress as `0x${string}`,
    chain: agentChain,
  });

  return hash;
}

export async function equipAgentSkill(ownerAddress: string, agentId: string, skillId: number, amount: number = 1) {
  const walletClient = getWalletClient();
  if (!walletClient || !appEnv.contracts.skillNft || !appEnv.contracts.skillManager) throw new Error("Wallet or contract not available");
  await switchToAgentChain();

  // Approve skill manager to transfer the skill NFT
  await walletClient.writeContract({
    address: appEnv.contracts.skillNft as `0x${string}`,
    abi: skillNftAbi,
    functionName: "setApprovalForAll",
    args: [appEnv.contracts.skillManager as `0x${string}`, true],
    account: ownerAddress as `0x${string}`,
    chain: agentChain,
  });

  // Small delay to let the approval transaction settle if needed, but BSC testnet is usually fast.
  // Equip the skill
  const hash = await walletClient.writeContract({
    address: appEnv.contracts.skillManager as `0x${string}`,
    abi: skillManagerAbi,
    functionName: "equipSkill",
    args: [BigInt(agentId), BigInt(skillId), BigInt(amount)],
    account: ownerAddress as `0x${string}`,
    chain: agentChain,
  });

  return hash;
}

export interface MemeLaunchResult {
  step: "launch";
  tokenAddress: string | null;
  name: string;
  symbol: string;
  supply: string;
  txHash: string;
  deployer: string;
  liquiditySeeded: boolean;
  liquidityTxHash?: string;
  liquidityError?: string;
}

function parseSupplyInWei(supply?: string): bigint {
  if (!supply || !supply.trim()) {
    return parseUnits("1000000000", 18);
  }

  const normalized = supply.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error("Supply must be a whole-number wei string");
  }

  return BigInt(normalized);
}

export async function launchMemeTokenWithConnectedWallet(
  ownerAddress: string,
  name: string,
  symbol: string,
  supply?: string,
  seedLiquidity: boolean = false
): Promise<MemeLaunchResult> {
  const walletClient = getWalletClient();
  const client = agentPublicClient;
  if (!walletClient || !client || !appEnv.contracts.tokenFactory) {
    throw new Error("Wallet, 0G testnet RPC, or token factory config is missing");
  }
  await switchToAgentChain();

  const totalSupply = parseSupplyInWei(supply);

  const deployHash = await walletClient.writeContract({
    address: appEnv.contracts.tokenFactory as `0x${string}`,
    abi: tokenFactoryAbi,
    functionName: "deployToken",
    args: [name, symbol, totalSupply, ownerAddress as `0x${string}`],
    account: ownerAddress as `0x${string}`,
    chain: agentChain,
  });

  const deployReceipt = await client.waitForTransactionReceipt({ hash: deployHash });

  let tokenAddress: string | null = null;
  for (const log of deployReceipt.logs) {
    if (log.address.toLowerCase() !== appEnv.contracts.tokenFactory.toLowerCase()) {
      continue;
    }

    try {
      const parsed = decodeEventLog({
        abi: tokenFactoryAbi,
        data: log.data,
        topics: log.topics,
      }) as { eventName: string; args: { token?: string } };

      if (parsed.eventName === "WorkerTokenDeployed" && parsed.args?.token) {
        tokenAddress = parsed.args.token;
        break;
      }
    } catch {
      // Ignore non-matching logs.
    }
  }

  const result: MemeLaunchResult = {
    step: "launch",
    tokenAddress,
    name,
    symbol,
    supply: totalSupply.toString(),
    txHash: deployHash,
    deployer: ownerAddress,
    liquiditySeeded: false,
  };

  if (seedLiquidity && tokenAddress && appEnv.contracts.liquidityManager) {
    try {
      const seedAmount = parseUnits("100000000", 18);
      const nativeAmount = parseEther("0.01");
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      const approveHash = await walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: workerTokenAbi,
        functionName: "approve",
        args: [appEnv.contracts.liquidityManager as `0x${string}`, seedAmount],
        account: ownerAddress as `0x${string}`,
        chain: agentChain,
      });
      await client.waitForTransactionReceipt({ hash: approveHash });

      const liquidityHash = await walletClient.writeContract({
        address: appEnv.contracts.liquidityManager as `0x${string}`,
        abi: liquidityManagerAbi,
        functionName: "seedLiquidityWithNative",
        args: [
          tokenAddress as `0x${string}`,
          seedAmount,
          0n,
          0n,
          ownerAddress as `0x${string}`,
          deadline,
        ],
        value: nativeAmount,
        account: ownerAddress as `0x${string}`,
        chain: agentChain,
      });
      await client.waitForTransactionReceipt({ hash: liquidityHash });

      result.liquiditySeeded = true;
      result.liquidityTxHash = liquidityHash;
    } catch (error) {
      result.liquidityError = error instanceof Error ? error.message : String(error);
    }
  }

  return result;
}

export async function fetchOwnedSkills(ownerAddress: string) {
  const client = agentPublicClient;
  if (!client || !appEnv.contracts.skillNft) return [];

  try {
    const totalTypes = await (client as any).readContract({
      address: appEnv.contracts.skillNft as `0x${string}`,
      abi: skillNftAbi,
      functionName: "totalSkillTypes",
    });

    const ownedSkills = [];
    for (let i = 1; i <= Number(totalTypes); i++) {
      const balance = await (client as any).readContract({
        address: appEnv.contracts.skillNft as `0x${string}`,
        abi: skillNftAbi,
        functionName: "balanceOf",
        args: [ownerAddress as `0x${string}`, BigInt(i)],
      });

      if (Number(balance) > 0) {
        const [name, skillType, _capabilityTag, description] = await (client as any).readContract({
          address: appEnv.contracts.skillNft as `0x${string}`,
          abi: skillNftAbi,
          functionName: "getSkill",
          args: [BigInt(i)],
        });

        ownedSkills.push({
          id: i,
          name,
          icon: skillType === "execution" ? "rocket_launch" : skillType === "defi" ? "account_balance" : "forum",
          desc: description,
          balance: Number(balance)
        });
      }
    }
    return ownedSkills;
  } catch (e) {
    console.error("fetchOwnedSkills error", e);
    return [];
  }
}

export async function createDirectAgentJob(
  ownerAddress: string,
  agentId: string,
  evaluator: string,
  budgetAmount: string,
  expiryDays: number,
  description: string
) {
  const walletClient = getWalletClient();
  const client = agentPublicClient;
  if (
    !walletClient ||
    !client ||
    !appEnv.contracts.jobMarket ||
    !appEnv.contracts.paymentToken
  ) {
    throw new Error("Job Market or Payment Token not configured");
  }
  await switchToAgentChain();

  const budget = parseUnits(budgetAmount, 18);
  const expiry = BigInt(Math.floor(Date.now() / 1000) + expiryDays * 86400);
  await switchToAgentChain();

  // 1. Approve Job Market to spend tokens
  const currentAllowance = (await (client as any).readContract({
    address: appEnv.contracts.paymentToken as `0x${string}`,
    abi: workerTokenAbi,
    functionName: "allowance",
    args: [ownerAddress as `0x${string}`, appEnv.contracts.jobMarket as `0x${string}`],
  })) as bigint;

  if (currentAllowance < budget) {
    const approveHash = await walletClient.writeContract({
      address: appEnv.contracts.paymentToken as `0x${string}`,
      abi: workerTokenAbi,
      functionName: "approve",
      args: [appEnv.contracts.jobMarket as `0x${string}`, budget],
      account: ownerAddress as `0x${string}`,
      chain: agentChain,
    });
    await client.waitForTransactionReceipt({ hash: approveHash });
  }

  // 2. Create Job
  const createHash = await walletClient.writeContract({
    address: appEnv.contracts.jobMarket as `0x${string}`,
    abi: agentJobMarketAbi,
    functionName: "createAgentJob",
    args: [BigInt(agentId), evaluator as `0x${string}`, budget, expiry, description],
    account: ownerAddress as `0x${string}`,
    chain: agentChain,
  });
  const createReceipt = await client.waitForTransactionReceipt({ hash: createHash });

  // 3. Find Job ID
  const nextJobId = (await (client as any).readContract({
    address: appEnv.contracts.jobMarket as `0x${string}`,
    abi: agentJobMarketAbi,
    functionName: "nextJobId",
  })) as bigint;
  const jobId = nextJobId - 1n;

  // 4. Fund Job
  const fundHash = await walletClient.writeContract({
    address: appEnv.contracts.jobMarket as `0x${string}`,
    abi: agentJobMarketAbi,
    functionName: "fund",
    args: [jobId, budget],
    account: ownerAddress as `0x${string}`,
    chain: agentChain,
  });
  await client.waitForTransactionReceipt({ hash: fundHash });

  return { jobId: jobId.toString(), txHash: fundHash };
}
