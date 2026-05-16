import { type ReactNode, useMemo } from "react";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { appEnv, runtimeMode } from "../lib/env";
import { wagmiConfig } from "../lib/wagmi";
import { useFarcasterMiniApp } from "../hooks/useFarcasterMiniApp";

function FarcasterReady({ children }: { children: ReactNode }) {
  useFarcasterMiniApp();
  return <>{children}</>;
}

export function ClusterFiDynamicProvider({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);

  if (!runtimeMode.hasDynamic) {
    return <FarcasterReady>{children}</FarcasterReady>;
  }

  return (
    <FarcasterReady>
      <DynamicContextProvider
        settings={{
          environmentId: appEnv.dynamic.environmentId,
          appName: appEnv.dynamic.appName,
          walletConnectors: [EthereumWalletConnectors],
          walletConnectPreferredChains:
            appEnv.agentChain.chainId === appEnv.chainId
              ? [`eip155:${appEnv.chainId}`]
              : [`eip155:${appEnv.chainId}`, `eip155:${appEnv.agentChain.chainId}`],
          initialAuthenticationMode: "connect-only",
          enableConnectOnlyFallback: true,
          displaySiweStatement: true,
          siweStatement: "Connect your wallet to ClusterFi to manage Sovereign Accounts and agent strategy permissions.",
          redirectUrl:
            appEnv.farcaster.appUrl ||
            (typeof window !== "undefined" ? window.location.origin : undefined),
          termsOfServiceUrl: appEnv.dynamic.termsOfServiceUrl || undefined,
          privacyPolicyUrl: appEnv.dynamic.privacyPolicyUrl || undefined,
          socialProvidersFilter: (providers) =>
            providers.filter((provider) => provider === "farcaster" || provider === "google"),
          overrides: {
            evmNetworks: [
              {
                blockExplorerUrls: [appEnv.explorerBaseUrl],
                chainId: appEnv.chainId,
                chainName: appEnv.chainName,
                iconUrls: ["https://app.dynamic.xyz/assets/networks/eth.svg"],
                name: appEnv.chainName,
                nativeCurrency: {
                  decimals: 18,
                  name: appEnv.nativeCurrencyName,
                  symbol: appEnv.nativeCurrencySymbol,
                },
                networkId: appEnv.chainId,
                rpcUrls: [appEnv.rpcUrl],
                vanityName: appEnv.chainName,
              },
              ...(appEnv.agentChain.chainId !== appEnv.chainId ? [{
                blockExplorerUrls: [appEnv.agentChain.explorerBaseUrl],
                chainId: appEnv.agentChain.chainId,
                chainName: appEnv.agentChain.chainName,
                iconUrls: ["https://app.dynamic.xyz/assets/networks/eth.svg"],
                name: appEnv.agentChain.chainName,
                nativeCurrency: {
                  decimals: 18,
                  name: appEnv.agentChain.nativeCurrencyName,
                  symbol: appEnv.agentChain.nativeCurrencySymbol,
                },
                networkId: appEnv.agentChain.chainId,
                rpcUrls: [appEnv.agentChain.rpcUrl || appEnv.rpcUrl],
                vanityName: appEnv.agentChain.chainName,
              }] : [])
            ],
          },
        }}
      >
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <DynamicWagmiConnector>{children}</DynamicWagmiConnector>
          </QueryClientProvider>
        </WagmiProvider>
      </DynamicContextProvider>
    </FarcasterReady>
  );
}
