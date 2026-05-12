const env = import.meta.env;

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const appEnv = {
  supabaseUrl: env.VITE_SUPABASE_URL?.trim() || "",
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY?.trim() || "",
  gatewayUrl: env.VITE_GATEWAY_URL?.trim() || "http://localhost:3000",
  rpcUrl: env.VITE_BSC_TESTNET_RPC_URL?.trim() || "",
  chainId: readNumber(env.VITE_CHAIN_ID, 97),
  explorerBaseUrl: env.VITE_BLOCK_EXPLORER_BASE_URL?.trim() || "https://testnet.bscscan.com",
  mantle: {
    chainId: readNumber(env.VITE_MANTLE_CHAIN_ID, 5000),
    sepoliaChainId: readNumber(env.VITE_MANTLE_SEPOLIA_CHAIN_ID, 5003),
    rpcUrl: env.VITE_MANTLE_RPC_URL?.trim() || "https://rpc.mantle.xyz",
    explorerBaseUrl: env.VITE_MANTLE_EXPLORER_URL?.trim() || "https://explorer.mantle.xyz",
  },
  contracts: {
    agentNft: env.VITE_AGENT_NFT_ADDRESS?.trim() || "",
    skillNft: env.VITE_SKILL_NFT_ADDRESS?.trim() || "",
    skillManager: env.VITE_SKILL_MANAGER_ADDRESS?.trim() || "",
    socialFeed: env.VITE_SOCIAL_FEED_ADDRESS?.trim() || "",
    jobMarket: env.VITE_JOB_MARKET_ADDRESS?.trim() || "",
    performanceRank: env.VITE_PERFORMANCE_RANK_ADDRESS?.trim() || "",
    paymentToken: env.VITE_PAYMENT_TOKEN_ADDRESS?.trim() || "",
    tokenFactory: env.VITE_TOKEN_FACTORY_ADDRESS?.trim() || "",
    liquidityManager: env.VITE_LIQUIDITY_MANAGER_ADDRESS?.trim() || "",
    swarmNft: env.VITE_SWARM_NFT_ADDRESS?.trim() || "",
    userStrategyAccountFactory: env.VITE_USER_STRATEGY_ACCOUNT_FACTORY_ADDRESS?.trim() || "",
    mockMemeAdapter: env.VITE_MOCK_MEME_ADAPTER_ADDRESS?.trim() || "",
    mockLpAdapter: env.VITE_MOCK_LP_ADAPTER_ADDRESS?.trim() || "",
    mockYieldAdapter: env.VITE_MOCK_YIELD_ADAPTER_ADDRESS?.trim() || "",
    mockPredictionMarketAdapter: env.VITE_MOCK_PREDICTION_MARKET_ADAPTER_ADDRESS?.trim() || "",
    sovereignAccountFactory: env.VITE_SOVEREIGN_ACCOUNT_FACTORY_ADDRESS?.trim() || "",
    sovereignAccountRegistry: env.VITE_SOVEREIGN_ACCOUNT_REGISTRY_ADDRESS?.trim() || "",
    crossChainIntentEngine: env.VITE_CROSS_CHAIN_INTENT_ENGINE_ADDRESS?.trim() || "",
  },
};

export const runtimeMode = {
  hasSupabase: Boolean(appEnv.supabaseUrl && appEnv.supabaseAnonKey),
  hasGateway: Boolean(appEnv.gatewayUrl),
  hasRpc: Boolean(appEnv.rpcUrl),
};
