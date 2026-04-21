import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  createPublicClient,
  createWalletClient,
  http,
  padHex,
  toHex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";

const deployment = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "deployments", "bsc-testnet.json"), "utf8")
);

const chain = { ...bscTestnet, rpcUrls: { ...bscTestnet.rpcUrls, default: { http: [process.env.BSC_TESTNET_RPC_URL] } } };
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY.startsWith("0x")
  ? process.env.DEPLOYER_PRIVATE_KEY
  : `0x${process.env.DEPLOYER_PRIVATE_KEY}`);
const transport = http(process.env.BSC_TESTNET_RPC_URL);
const publicClient = createPublicClient({ chain, transport });
const walletClient = createWalletClient({ account, chain, transport });

const agentAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "nextTokenId",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "mintAgent",
    inputs: [
      { name: "to", type: "address" },
      { name: "name", type: "string" },
      { name: "role", type: "string" },
      { name: "description", type: "string" },
      { name: "salt", type: "bytes32" }
    ],
    outputs: [
      { name: "agentId", type: "uint256" },
      { name: "tba", type: "address" }
    ]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "tbas",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "address" }]
  }
];

const registryAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "account",
    inputs: [
      { type: "address" },
      { type: "bytes32" },
      { type: "uint256" },
      { type: "address" },
      { type: "uint256" }
    ],
    outputs: [{ type: "address" }]
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "createAccount",
    inputs: [
      { type: "address" },
      { type: "bytes32" },
      { type: "uint256" },
      { type: "address" },
      { type: "uint256" }
    ],
    outputs: [{ type: "address" }]
  }
];

const skillAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "setApprovalForAll",
    inputs: [
      { type: "address", name: "operator" },
      { type: "bool", name: "approved" }
    ],
    outputs: []
  },
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [
      { type: "address", name: "owner" },
      { type: "uint256", name: "id" }
    ],
    outputs: [{ type: "uint256" }]
  }
];

const skillManagerAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "equipSkill",
    inputs: [
      { type: "uint256", name: "agentId" },
      { type: "uint256", name: "skillId" },
      { type: "uint256", name: "amount" }
    ],
    outputs: []
  },
  {
    type: "function",
    stateMutability: "view",
    name: "canPost",
    inputs: [{ type: "uint256", name: "agentId" }],
    outputs: [{ type: "bool" }]
  }
];

const socialFeedAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "post",
    inputs: [
      { type: "uint256", name: "agentId" },
      { type: "string", name: "contentURI" }
    ],
    outputs: [{ type: "uint256" }]
  }
];

async function main() {
  const minted = await mintAgent();
  const tba = await ensureTba(minted.agentId, minted.salt);
  await equipSkill(deployment.contracts.skillNFT, minted.agentId);

  const canPost = await publicClient.readContract({
    address: deployment.contracts.skillManager,
    abi: skillManagerAbi,
    functionName: "canPost",
    args: [minted.agentId]
  });

  console.log(`Agent ${minted.agentId} TBA: ${tba}`);
  console.log(`Creative_Content capable: ${canPost}`);

  if (canPost && deployment.contracts.socialFeed && process.env.POST_CONTENT_URI) {
    const postHash = await walletClient.writeContract({
      address: deployment.contracts.socialFeed,
      abi: socialFeedAbi,
      functionName: "post",
      args: [minted.agentId, process.env.POST_CONTENT_URI],
      account
    });
    console.log(`Posted to social feed in tx ${postHash}`);
  }
}

async function mintAgent() {
  if (process.env.AGENT_ID) {
    return { agentId: BigInt(process.env.AGENT_ID), salt: resolveSalt() };
  }

  const agentId = await publicClient.readContract({
    address: deployment.contracts.agentNFT,
    abi: agentAbi,
    functionName: "nextTokenId"
  });
  const salt = resolveSalt();

  const hash = await walletClient.writeContract({
    address: deployment.contracts.agentNFT,
    abi: agentAbi,
    functionName: "mintAgent",
    args: [
      account.address,
      "ClusterFi Agent",
      "Creative Strategist",
      "ERC-6551 workforce agent",
      salt
    ],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Minted agent ${agentId} in tx ${hash}`);
  return { agentId, salt };
}

async function ensureTba(agentId, salt) {
  let tba = await publicClient.readContract({
    address: deployment.contracts.agentNFT,
    abi: agentAbi,
    functionName: "tbas",
    args: [agentId]
  });

  if (tba !== "0x0000000000000000000000000000000000000000") {
    return tba;
  }

  const predicted = await publicClient.readContract({
    address: deployment.registry,
    abi: registryAbi,
    functionName: "account",
    args: [
      deployment.contracts.accountImplementation,
      salt,
      BigInt(deployment.chainId),
      deployment.contracts.agentNFT,
      agentId
    ]
  });

  const hash = await walletClient.writeContract({
    address: deployment.registry,
    abi: registryAbi,
    functionName: "createAccount",
    args: [
      deployment.contracts.accountImplementation,
      salt,
      BigInt(deployment.chainId),
      deployment.contracts.agentNFT,
      agentId
    ],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return predicted;
}

async function equipSkill(skillNftAddress, defaultAgentId) {
  const agentId = process.env.AGENT_ID ? BigInt(process.env.AGENT_ID) : defaultAgentId;
  const skillId = BigInt(process.env.SKILL_ID_TO_EQUIP);

  await walletClient.writeContract({
    address: skillNftAddress,
    abi: skillAbi,
    functionName: "setApprovalForAll",
    args: [deployment.contracts.skillManager, true],
    account
  });

  const hash = await walletClient.writeContract({
    address: deployment.contracts.skillManager,
    abi: skillManagerAbi,
    functionName: "equipSkill",
    args: [agentId, skillId, 1n],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash });

  const tba = await publicClient.readContract({
    address: deployment.contracts.agentNFT,
    abi: agentAbi,
    functionName: "tbas",
    args: [agentId]
  });

  const balance = await publicClient.readContract({
    address: skillNftAddress,
    abi: skillAbi,
    functionName: "balanceOf",
    args: [tba, skillId]
  });

  console.log(`Equipped skill ${skillId} to ${tba}. TBA balance: ${balance}`);
}

function resolveSalt() {
  if (process.env.AGENT_SALT) {
    return process.env.AGENT_SALT;
  }
  return padHex(toHex(BigInt(Date.now())), { size: 32 });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
