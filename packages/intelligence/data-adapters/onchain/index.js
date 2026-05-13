import { ethers } from "ethers";
import { fetchJsonWithRetry, freeDataCache, withQuery } from "../../cache/index.js";
import { buildOnchainStateContext } from "../../context-builder/index.js";

export const PUBLIC_RPCS = {
  ethereum: "https://ethereum.publicnode.com",
  polygon: "https://polygon-bor-rpc.publicnode.com",
  arbitrum: "https://arbitrum-one.publicnode.com",
  optimism: "https://optimism.publicnode.com",
  base: "https://base.publicnode.com",
  bsc: "https://bsc-rpc.publicnode.com",
  mantle: "https://rpc.mantle.xyz",
  solana: "https://api.mainnet-beta.solana.com",
};

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export async function getWalletState({ chain = "ethereum", wallet, tokens = [], rpcUrl } = {}) {
  if (!wallet) throw new Error("wallet is required");
  const [nativeBalance, tokenBalances] = await Promise.all([
    getNativeBalance({ chain, wallet, rpcUrl }),
    Promise.all(tokens.map((token) => getTokenBalance({ chain, wallet, token, rpcUrl }))),
  ]);
  return buildOnchainStateContext({
    chain,
    balances: [nativeBalance, ...tokenBalances],
    liquidityChecks: [],
    protocolState: null,
    poolState: null,
  });
}

export async function getProtocolState({ chain = "ethereum", protocol, contractAddress, abi = [], method, args = [], rpcUrl } = {}) {
  if (!protocol) throw new Error("protocol is required");
  if (!contractAddress || !method) {
    return { chain, protocol, contractAddress: contractAddress || null, state: null, source: "metadata-only" };
  }
  const provider = evmProvider(chain, rpcUrl);
  const contract = new ethers.Contract(contractAddress, abi, provider);
  const value = await contract[method](...(args || []));
  return { chain, protocol, contractAddress, method, state: stringifyBigints(value), source: rpcUrl || PUBLIC_RPCS[chain] };
}

export async function getTokenBalance({ chain = "ethereum", wallet, token, rpcUrl } = {}) {
  if (!wallet || !token) throw new Error("wallet and token are required");
  if (chain === "solana") {
    return getSolanaTokenBalance({ wallet, token, rpcUrl });
  }
  const provider = evmProvider(chain, rpcUrl);
  const contract = new ethers.Contract(token, ERC20_ABI, provider);
  const [raw, decimals, symbol] = await Promise.all([
    contract.balanceOf(wallet),
    contract.decimals().catch(() => 18),
    contract.symbol().catch(() => "TOKEN"),
  ]);
  return {
    chain,
    asset: token,
    symbol,
    raw: raw.toString(),
    decimals: Number(decimals),
    formatted: ethers.formatUnits(raw, decimals),
    source: rpcUrl || PUBLIC_RPCS[chain],
  };
}

export async function getChainState({ chain = "ethereum", rpcUrl } = {}) {
  if (chain === "solana") {
    const endpoint = rpcUrl || PUBLIC_RPCS.solana;
    const result = await solanaRpc(endpoint, "getEpochInfo", []);
    return { chain, epochInfo: result, source: endpoint };
  }
  const provider = evmProvider(chain, rpcUrl);
  const [blockNumber, feeData, network] = await Promise.all([
    provider.getBlockNumber(),
    provider.getFeeData(),
    provider.getNetwork(),
  ]);
  return { chain, chainId: Number(network.chainId), blockNumber, feeData: stringifyBigints(feeData), source: rpcUrl || PUBLIC_RPCS[chain] };
}

export async function validateLiquidity({ poolState, minLiquidityUsd = 100_000, minTvlUsd = 100_000 } = {}) {
  const liquidity = Number(poolState?.liquidityUsd ?? poolState?.tvlUsd ?? poolState?.reserveUsd ?? 0);
  const approved = liquidity >= Number(minLiquidityUsd || minTvlUsd);
  return {
    approved,
    liquidityUsd: liquidity,
    minLiquidityUsd: Number(minLiquidityUsd || minTvlUsd),
    warnings: approved ? [] : ["liquidity below threshold"],
  };
}

export async function getPoolState({ chain = "ethereum", poolAddress, rpcUrl, metadata = {} } = {}) {
  if (!poolAddress) throw new Error("poolAddress is required");
  if (metadata.tvlUsd || metadata.liquidityUsd) {
    return { chain, poolAddress, ...metadata, source: "provided-metadata" };
  }
  const provider = evmProvider(chain, rpcUrl);
  const code = await provider.getCode(poolAddress);
  return {
    chain,
    poolAddress,
    exists: code && code !== "0x",
    liquidityUsd: null,
    tvlUsd: null,
    source: rpcUrl || PUBLIC_RPCS[chain],
  };
}

async function getNativeBalance({ chain, wallet, rpcUrl }) {
  if (chain === "solana") {
    const endpoint = rpcUrl || PUBLIC_RPCS.solana;
    const lamports = await solanaRpc(endpoint, "getBalance", [wallet]);
    return { chain, asset: "native", symbol: "SOL", raw: String(lamports.value), decimals: 9, formatted: String(Number(lamports.value) / 1e9), source: endpoint };
  }
  const provider = evmProvider(chain, rpcUrl);
  const raw = await provider.getBalance(wallet);
  return { chain, asset: "native", symbol: "ETH", raw: raw.toString(), decimals: 18, formatted: ethers.formatEther(raw), source: rpcUrl || PUBLIC_RPCS[chain] };
}

async function getSolanaTokenBalance({ wallet, token, rpcUrl }) {
  const endpoint = rpcUrl || PUBLIC_RPCS.solana;
  const url = withQuery(endpoint, {});
  const { value } = await freeDataCache.getOrFetch(`solana-token:${wallet}:${token}`, () => fetchJsonWithRetry(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [wallet, { mint: token }, { encoding: "jsonParsed" }],
    }),
  }), { ttlMs: 30_000, source: endpoint });
  const accounts = value.result?.value || [];
  const amount = accounts[0]?.account?.data?.parsed?.info?.tokenAmount || {};
  return {
    chain: "solana",
    asset: token,
    symbol: "SPL",
    raw: amount.amount || "0",
    decimals: Number(amount.decimals || 0),
    formatted: amount.uiAmountString || "0",
    source: endpoint,
  };
}

async function solanaRpc(endpoint, method, params) {
  const response = await fetchJsonWithRetry(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (response.error) throw new Error(response.error.message);
  return response.result;
}

function evmProvider(chain, rpcUrl) {
  const url = rpcUrl || PUBLIC_RPCS[String(chain).toLowerCase()];
  if (!url) throw new Error(`No public RPC configured for ${chain}`);
  return new ethers.JsonRpcProvider(url);
}

function stringifyBigints(value) {
  return JSON.parse(JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item));
}
