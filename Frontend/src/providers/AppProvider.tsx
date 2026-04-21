import {
  startTransition,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { clustrRepository } from "../lib/data/repository";
import { connectInjectedWallet, disconnectInjectedWallet, switchToConfiguredChain, getDiscoveredProviders, requestSignature, type EIP6963ProviderDetail } from "../lib/web3";
import { createMockBootstrap } from "../lib/data/mockData";
import type { AppBootstrap, LoadStatus } from "../types/domain";
import { AppContext, type AppContextValue, type WalletState } from "./app-context";

const initialData = createMockBootstrap();

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppBootstrap>(initialData);
  const [appStatus, setAppStatus] = useState<LoadStatus>("loading");
  const [appError, setAppError] = useState<string | null>(null);
  const [discoveredProviders, setDiscoveredProviders] = useState<EIP6963ProviderDetail[]>([]);
  const [wallet, setWallet] = useState<WalletState>({
    account: null,
    chainId: null,
    status: "disconnected",
    error: null,
  });

  useEffect(() => {
    setDiscoveredProviders(getDiscoveredProviders());

    const handleAccounts = (accounts: string[]) => {
      console.log("MetaMask Accounts Changed:", accounts);
      if (accounts[0]) {
        setWallet((current) => ({
          ...current,
          account: accounts[0],
          status: "connected",
        }));
      } else {
        setWallet((current) => ({
          ...current,
          account: null,
          status: "disconnected",
        }));
      }
    };

    const handleChain = (chainIdHex: string) => {
      setWallet((current) => ({
        ...current,
        chainId: Number.parseInt(chainIdHex, 16),
      }));
    };

    if (window.ethereum) {
      // @ts-ignore
      window.ethereum.on("accountsChanged", handleAccounts);
      // @ts-ignore
      window.ethereum.on("chainChanged", handleChain);
    }

    return () => {
      if (window.ethereum) {
        // @ts-ignore
        window.ethereum.removeListener("accountsChanged", handleAccounts);
        // @ts-ignore
        window.ethereum.removeListener("chainChanged", handleChain);
      }
    };
  }, []);

  useEffect(() => {
    if (wallet.status === "connected" && wallet.account) {
      void refreshApp();
    }
  }, [wallet.status, wallet.account]);

  async function refreshApp() {
    setAppStatus("loading");
    setAppError(null);

    try {
      const next = await clustrRepository.bootstrap(wallet.account ?? undefined);
      startTransition(() => {
        setData(next);
        setAppStatus("success");
      });
    } catch (error) {
      setAppStatus("error");
      setAppError(error instanceof Error ? error.message : "Failed to load app data");
    }
  }

  async function likePost(postId: string) {
    const feed = await clustrRepository.toggleLike(postId);
    setData((current) => ({ ...current, feed }));
  }

  async function addComment(postId: string, body: string) {
    await clustrRepository.addComment(postId, body, wallet.account ?? "Vault Operator");
    setData(clustrRepository.snapshot());
  }

  async function dismissNotification(notificationId: string) {
    const notifications = await clustrRepository.dismissNotification(notificationId);
    setData((current) => ({ ...current, notifications }));
  }

  async function executeAgent(input: { agentId: string; message: string; action?: string }) {
    const record = await clustrRepository.executeAgent(input);
    setData((current) => ({
      ...current,
      executionHistory: [record, ...current.executionHistory],
    }));
    return record;
  }

  async function connectWallet(provider?: any) {
    setWallet((current) => ({ ...current, status: "connecting", error: null }));
    try {
      const result = await connectInjectedWallet(provider);
      
      // Force a signature to ensure actual wallet communication
      console.log("Requesting demo signature...");
      await requestSignature(`Authenticate to Kinetic Vault\nAccount: ${result.account}\nNonce: ${Date.now()}`);

      setWallet({
        account: result.account,
        chainId: result.chainId,
        status: "connected",
        error: null,
      });
    } catch (error) {
      setWallet({
        account: null,
        chainId: null,
        status: "error",
        error: error instanceof Error ? error.message : "Wallet connection failed",
      });
    }
  }

  async function disconnectWallet() {
    await disconnectInjectedWallet();
    setWallet({
      account: null,
      chainId: null,
      status: "disconnected",
      error: null,
    });
  }

  async function ensureCorrectNetwork() {
    try {
      await switchToConfiguredChain();
      if (wallet.chainId) {
        setWallet((current) => ({ ...current, chainId: wallet.chainId }));
      }
    } catch (error) {
      setWallet((current) => ({
        ...current,
        status: "error",
        error: error instanceof Error ? error.message : "Network switch failed",
      }));
    }
  }

  async function resetToChain() {
    setAppStatus("loading");
    try {
      const next = await clustrRepository.resetToChain(wallet.account ?? undefined);
      setData(next);
      setAppStatus("success");
    } catch (error) {
      setAppStatus("error");
      setAppError(error instanceof Error ? error.message : "Reset failed");
    }
  }

  const value: AppContextValue = {
    ...data,
    appStatus,
    appError,
    wallet,
    discoveredProviders,
    refreshApp,
    likePost,
    addComment,
    dismissNotification,
    executeAgent,
    connectWallet,
    disconnectWallet,
    ensureCorrectNetwork,
    resetToChain,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
