import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
import { walletConnect } from "wagmi/connectors";
import { createConfig } from "wagmi";
import { defineChain, http } from "viem";
import { appEnv } from "./env";

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";

export const clusterFiChain = defineChain({
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
    default: {
      name: "Explorer",
      url: appEnv.explorerBaseUrl,
    },
  },
});

export const clusterFiAgentChain = defineChain({
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
    default: {
      name: "Explorer",
      url: appEnv.agentChain.explorerBaseUrl,
    },
  },
});

const chains = clusterFiAgentChain.id === clusterFiChain.id ? [clusterFiChain] as const : [clusterFiChain, clusterFiAgentChain] as const;

export const wagmiConfig = createConfig({
  chains,
  connectors: [
    farcasterFrame(),
    ...(walletConnectProjectId
      ? [walletConnect({ projectId: walletConnectProjectId, showQrModal: true })]
      : []),
  ],
  multiInjectedProviderDiscovery: false,
  transports: {
    [clusterFiChain.id]: http(appEnv.rpcUrl || undefined),
    [clusterFiAgentChain.id]: http(appEnv.agentChain.rpcUrl || appEnv.rpcUrl || undefined),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
