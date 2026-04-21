import { createPublicClient, custom, http, parseAbi, createWalletClient } from "viem";
import { bscTestnet } from "viem/chains";
import { appEnv, runtimeMode } from "./env";

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
          chainName: "Tenderly Fork (99956)",
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
  if (!activeProvider) {
    return null;
  }

  return createWalletClient({
    transport: custom(activeProvider),
  });
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
  for (let i = 0; i < balance; i++) {
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

export async function mintNewAgent(ownerAddress: string, name: string, role: string, description: string) {
  const walletClient = getWalletClient();
  if (!walletClient || !appEnv.contracts.agentNft) throw new Error("Wallet or contract not available");

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

  // Small delay to let the approval transaction settle if needed, but tenderly fork is usually fast.
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
