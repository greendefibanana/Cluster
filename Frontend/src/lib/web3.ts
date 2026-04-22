import { createPublicClient, custom, decodeEventLog, http, parseAbi, parseEther, parseUnits, createWalletClient, formatUnits, encodeFunctionData } from "viem";
import { bscTestnet } from "viem/chains";
import { appEnv, runtimeMode } from "./env";
import type { JobListing, Bid } from "../types/domain";

const configuredChain = { ...bscTestnet, id: appEnv.chainId };

export const publicClient = runtimeMode.hasRpc
  ? createPublicClient({
      chain: configuredChain,
      transport: http(appEnv.rpcUrl),
    })
  : null;

const agentNftAbi = parseAbi([
  "function tbas(uint256 agentId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function agentProfiles(uint256 agentId) view returns (string name, string role, string description)",
  "function totalSupply() view returns (uint256)",
  "function nextTokenId() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function mintAgent(address to, string calldata name, string calldata role, string calldata description, bytes32 salt) external returns (uint256 agentId, address tba)"
]);
const swarmNftAbi = parseAbi([
  "function tbas(uint256 swarmId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function swarmProfiles(uint256 swarmId) view returns (string name, string strategy, string description)",
  "function totalSupply() view returns (uint256)",
  "function nextTokenId() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function mintSwarm(address to, string calldata name, string calldata strategy, string calldata description, bytes32 salt) external returns (uint256 swarmId, address tba)"
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
      chain: configuredChain,
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
    chain: configuredChain,
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

  const hash = await walletClient.writeContract({
    address: appEnv.contracts.jobMarket as `0x${string}`,
    abi: agentJobMarketAbi,
    functionName: "placeBid",
    args: [BigInt(jobId), providerKind, BigInt(providerId)],
    account: ownerAddress as `0x${string}`,
    chain: configuredChain,
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

  // 1. Accept Bid
  const acceptHash = await walletClient.writeContract({
    address: appEnv.contracts.jobMarket as `0x${string}`,
    abi: agentJobMarketAbi,
    functionName: "acceptBid",
    args: [BigInt(jobId), BigInt(bidIndex)],
    account: ownerAddress as `0x${string}`,
    chain: configuredChain,
  });
  await publicClient.waitForTransactionReceipt({ hash: acceptHash });

  // 2. Fund Job
  const fundHash = await walletClient.writeContract({
    address: appEnv.contracts.jobMarket as `0x${string}`,
    abi: agentJobMarketAbi,
    functionName: "fund",
    args: [BigInt(jobId), budget],
    account: ownerAddress as `0x${string}`,
    chain: configuredChain,
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

export async function switchToConfiguredChain(): Promise<void> {
  if (!activeProvider) {
    throw new Error("No wallet connected");
  }

  const hexChainId = `0x${appEnv.chainId.toString(16)}`;

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
          chainName: "BNB Smart Chain Testnet",
          nativeCurrency: configuredChain.nativeCurrency,
          rpcUrls: appEnv.rpcUrl ? [appEnv.rpcUrl] : configuredChain.rpcUrls.default.http,
          blockExplorerUrls: [appEnv.explorerBaseUrl],
        },
      ],
    });
  }
}

export async function connectInjectedWallet(provider?: any): Promise<{ account: string; chainId: number }> {
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
  return Promise.resolve();
}

export function getWalletClient() {
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


export async function fetchJobs(publicClient: any): Promise<JobListing[]> {
  if (!publicClient || !appEnv.contracts.jobMarket) {
    return [];
  }

  try {
    const nextJobId = (await (publicClient as any).readContract({
      address: appEnv.contracts.jobMarket as `0x${string}`,
      abi: agentJobMarketAbi,
      functionName: "nextJobId",
    })) as bigint;

    const jobCount = Number(nextJobId) - 1;
    const jobs: JobListing[] = [];

    for (let i = 1; i <= jobCount; i++) {
      const jobData = (await (publicClient as any).readContract({
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

      const bidsData = (await (publicClient as any).readContract({
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
  if (!publicClient || !appEnv.contracts.skillManager || !appEnv.contracts.skillNft) return [];
  
  const id = BigInt(agentId);
  const equippedIds: readonly bigint[] = await (publicClient as any).readContract({
    address: appEnv.contracts.skillManager as `0x${string}`,
    abi: skillManagerAbi,
    functionName: "equippedSkillIds",
    args: [id],
  });

  const skills = [];
  for (let i = 0; i < equippedIds.length; i++) {
    const skillId = equippedIds[i];
    const [name, skillType, capabilityTag] = await (publicClient as any).readContract({
      address: appEnv.contracts.skillNft as `0x${string}`,
      abi: skillNftAbi,
      functionName: "getSkill",
      args: [skillId],
    });
    
    const balance = await (publicClient as any).readContract({
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
  if (
    !publicClient ||
    !appEnv.contracts.agentNft ||
    !appEnv.contracts.performanceRank ||
    !appEnv.contracts.skillManager
  ) {
    return [];
  }

  const balance = await (publicClient as any).readContract({
    address: appEnv.contracts.agentNft as `0x${string}`,
    abi: agentNftAbi,
    functionName: "balanceOf",
    args: [ownerAddress as `0x${string}`],
  });

  const agents = [];
  for (let i = 0; i < Number(balance); i++) {
    const tokenId = await (publicClient as any).readContract({
      address: appEnv.contracts.agentNft as `0x${string}`,
      abi: agentNftAbi,
      functionName: "tokenOfOwnerByIndex",
      args: [ownerAddress as `0x${string}`, BigInt(i)],
    });

    const [tbaAddress, score, slots, [name, role, description], equippedSkills] = await Promise.all([
      publicClient.readContract({
        address: appEnv.contracts.agentNft as `0x${string}`,
        abi: agentNftAbi,
        functionName: "tbas",
        args: [tokenId],
      }),
      publicClient.readContract({
        address: appEnv.contracts.performanceRank as `0x${string}`,
        abi: performanceRankAbi,
        functionName: "intelligenceScore",
        args: [tokenId],
      }),
      publicClient.readContract({
        address: appEnv.contracts.skillManager as `0x${string}`,
        abi: skillManagerAbi,
        functionName: "skillSlots",
        args: [tokenId],
      }),
      publicClient.readContract({
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
  if (!walletClient) throw new Error("Wallet not available. Please try reconnecting.");
  if (!appEnv.contracts.swarmNft) throw new Error("Swarm NFT contract address not found. Please restart your Vite dev server.");

  const hash = await walletClient.writeContract({
    address: appEnv.contracts.swarmNft as `0x${string}`,
    abi: swarmNftAbi,
    functionName: "mintSwarm",
    args: [ownerAddress as `0x${string}`, name, strategy, description, salt],
    account: ownerAddress as `0x${string}`,
    chain: configuredChain,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function fetchSwarmsForOwner(ownerAddress: string) {
  if (!publicClient || !appEnv.contracts.swarmNft) {
    return [];
  }

  try {
    const balance = await (publicClient as any).readContract({
      address: appEnv.contracts.swarmNft as `0x${string}`,
      abi: swarmNftAbi,
      functionName: "balanceOf",
      args: [ownerAddress as `0x${string}`],
    });

    const swarms = [];
    for (let i = 0; i < Number(balance); i++) {
      const tokenId = await (publicClient as any).readContract({
        address: appEnv.contracts.swarmNft as `0x${string}`,
        abi: swarmNftAbi,
        functionName: "tokenOfOwnerByIndex",
        args: [ownerAddress as `0x${string}`, BigInt(i)],
      });

      const [tbaAddress, [name, strategy, description]] = await Promise.all([
        publicClient.readContract({
          address: appEnv.contracts.swarmNft as `0x${string}`,
          abi: swarmNftAbi,
          functionName: "tbas",
          args: [tokenId],
        }),
        publicClient.readContract({
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

  const hash = await walletClient.writeContract({
    address: appEnv.contracts.agentNft as `0x${string}`,
    abi: parseAbi(["function safeTransferFrom(address from, address to, uint256 tokenId)"]),
    functionName: "safeTransferFrom",
    args: [ownerAddress as `0x${string}`, swarmTbaAddress as `0x${string}`, BigInt(agentId)],
    account: ownerAddress as `0x${string}`,
    chain: configuredChain,
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
    chain: configuredChain,
  });

  return hash;
}

export async function mintNewAgent(ownerAddress: string, name: string, role: string, description: string) {
  const walletClient = getWalletClient();
  if (!walletClient || !appEnv.contracts.agentNft || !publicClient) throw new Error("Wallet or contract not available");

  const saltBytes = new Uint8Array(32);
  crypto.getRandomValues(saltBytes);
  const saltHex = "0x" + Array.from(saltBytes).map(b => b.toString(16).padStart(2, "0")).join("") as `0x${string}`;

  const hash = await walletClient.writeContract({
    address: appEnv.contracts.agentNft as `0x${string}`,
    abi: agentNftAbi,
    functionName: "mintAgent",
    args: [ownerAddress as `0x${string}`, name, role, description, saltHex],
    account: ownerAddress as `0x${string}`,
    chain: configuredChain,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function mintSkill(ownerAddress: string, skillId: number, amount: number = 1) {
  const walletClient = getWalletClient();
  if (!walletClient || !appEnv.contracts.skillNft) throw new Error("Wallet or contract not available");

  const hash = await walletClient.writeContract({
    address: appEnv.contracts.skillNft as `0x${string}`,
    abi: skillNftAbi,
    functionName: "publicMintSkill",
    args: [BigInt(skillId), BigInt(amount)],
    account: ownerAddress as `0x${string}`,
    chain: configuredChain,
  });

  return hash;
}

export async function equipAgentSkill(ownerAddress: string, agentId: string, skillId: number, amount: number = 1) {
  const walletClient = getWalletClient();
  if (!walletClient || !appEnv.contracts.skillNft || !appEnv.contracts.skillManager) throw new Error("Wallet or contract not available");

  // Approve skill manager to transfer the skill NFT
  await walletClient.writeContract({
    address: appEnv.contracts.skillNft as `0x${string}`,
    abi: skillNftAbi,
    functionName: "setApprovalForAll",
    args: [appEnv.contracts.skillManager as `0x${string}`, true],
    account: ownerAddress as `0x${string}`,
    chain: configuredChain,
  });

  // Small delay to let the approval transaction settle if needed, but BSC testnet is usually fast.
  // Equip the skill
  const hash = await walletClient.writeContract({
    address: appEnv.contracts.skillManager as `0x${string}`,
    abi: skillManagerAbi,
    functionName: "equipSkill",
    args: [BigInt(agentId), BigInt(skillId), BigInt(amount)],
    account: ownerAddress as `0x${string}`,
    chain: configuredChain,
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
  if (!walletClient || !publicClient || !appEnv.contracts.tokenFactory) {
    throw new Error("Wallet, RPC, or token factory config is missing");
  }

  const totalSupply = parseSupplyInWei(supply);

  const deployHash = await walletClient.writeContract({
    address: appEnv.contracts.tokenFactory as `0x${string}`,
    abi: tokenFactoryAbi,
    functionName: "deployToken",
    args: [name, symbol, totalSupply, ownerAddress as `0x${string}`],
    account: ownerAddress as `0x${string}`,
    chain: configuredChain,
  });

  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });

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
        chain: configuredChain,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

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
        chain: configuredChain,
      });
      await publicClient.waitForTransactionReceipt({ hash: liquidityHash });

      result.liquiditySeeded = true;
      result.liquidityTxHash = liquidityHash;
    } catch (error) {
      result.liquidityError = error instanceof Error ? error.message : String(error);
    }
  }

  return result;
}

export async function fetchOwnedSkills(ownerAddress: string) {
  if (!publicClient || !appEnv.contracts.skillNft) return [];

  try {
    const totalTypes = await (publicClient as any).readContract({
      address: appEnv.contracts.skillNft as `0x${string}`,
      abi: skillNftAbi,
      functionName: "totalSkillTypes",
    });

    const ownedSkills = [];
    for (let i = 1; i <= Number(totalTypes); i++) {
      const balance = await (publicClient as any).readContract({
        address: appEnv.contracts.skillNft as `0x${string}`,
        abi: skillNftAbi,
        functionName: "balanceOf",
        args: [ownerAddress as `0x${string}`, BigInt(i)],
      });

      if (Number(balance) > 0) {
        const [name, skillType, _capabilityTag, description] = await (publicClient as any).readContract({
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
      chain: configuredChain,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  // 2. Create Job
  const createHash = await walletClient.writeContract({
    address: appEnv.contracts.jobMarket as `0x${string}`,
    abi: agentJobMarketAbi,
    functionName: "createAgentJob",
    args: [BigInt(agentId), evaluator as `0x${string}`, budget, expiry, description],
    account: ownerAddress as `0x${string}`,
    chain: configuredChain,
  });
  const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });

  // 3. Find Job ID from events if possible (or just use nextJobId-1)
  const nextJobId = (await (publicClient as any).readContract({
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
    chain: configuredChain,
  });
  await publicClient.waitForTransactionReceipt({ hash: fundHash });

  return { jobId: jobId.toString(), txHash: fundHash };
}
