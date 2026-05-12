import {
  startTransition,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { clustrRepository } from "../lib/data/repository";
import { appEnv, runtimeMode } from "../lib/env";
import { supabase } from "../lib/supabase";
import {
  connectInjectedWallet, 
  disconnectInjectedWallet, 
  switchToConfiguredChain, 
  getDiscoveredProviders, 
  requestSignature, 
  getWalletClient, 
  getPublicClient, 
  createOpenJob as createOpenJobWeb3, 
  placeBid as placeBidWeb3, 
  acceptBid as acceptBidWeb3, 
  assignAgentToSwarm as assignAgentToSwarmWeb3,
  removeAgentFromSwarm as removeAgentFromSwarmWeb3,
  createUserStrategyAccount,
  depositToUserStrategyAccount,
  pauseUserStrategyAccount,
  resumeUserStrategyAccount,
  revokeUserStrategyExecutor,
  withdrawFromUserStrategyAccount,
  closeUserStrategyAccount,
  type EIP6963ProviderDetail 
} from "../lib/web3";
import { createMockBootstrap } from "../lib/data/mockData";
import { generateFeedPost } from "../lib/gateway";
import { createClientId } from "../lib/id";
import type { AppBootstrap, FeedMode, LoadStatus, FeedPost } from "../types/domain";
import { AppContext, type AppContextValue, type WalletState } from "./app-context";

const initialData = createMockBootstrap();
const SHARED_SYNC_INTERVAL_MS = 30_000;

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
    void refreshApp();
  }, []);

  useEffect(() => {
    if (wallet.status === "connected" && wallet.account) {
      void refreshApp({ silent: true });
    }
  }, [wallet.status, wallet.account]);

  useEffect(() => {
    if (!runtimeMode.hasSupabase) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshApp({ silent: true });
    }, SHARED_SYNC_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [wallet.account]);

  useEffect(() => {
    if (!runtimeMode.hasSupabase || !supabase) {
      return;
    }

    const syncFromShared = () => {
      void refreshApp({ silent: true });
    };

    const channel = supabase
      .channel("clustr-feed-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feed_posts" },
        syncFromShared,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feed_comments" },
        syncFromShared,
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Supabase realtime channel error for feed sync");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [wallet.account]);

  async function refreshApp(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;

    if (!silent) {
      setAppStatus("loading");
      setAppError(null);
    }

    try {
      const next = await clustrRepository.bootstrap(wallet.account ?? undefined);
      startTransition(() => {
        setData(next);
        setAppStatus("success");
        setAppError(null);
      });
    } catch (error) {
      if (!silent) {
        setAppStatus("error");
        setAppError(error instanceof Error ? error.message : "Failed to load app data");
      } else {
        console.error("Background refresh failed:", error);
      }
    }
  }

  async function generatePostForFeed(mode: FeedMode = "social") {
    console.log("generatePostForFeed started...");
    setAppStatus("loading");
    try {
      const agent = data.agents[Math.floor(Math.random() * data.agents.length)];
      if (!agent) throw new Error("No agents available");
      
      console.log(`Calling generateFeedPost for agent ${agent.name}...`);
      const response = await generateFeedPost(agent.name, agent.title || "Agent");
      console.log("Response from gateway:", response);
      
      if (response?.result) {
        const newPost: FeedPost = {
          id: createClientId(),
          agentId: agent.id,
          authorName: agent.name,
          authorHandle: agent.ownerAddress,
          avatarUrl: agent.avatarUrl,
          roleLabel: agent.title || "Agent",
          score: agent.score,
          mode,
          content: response.result.content || "Generated content",
          insightTitle: response.result.insightTitle,
          tags: response.result.tags || [],
          likes: 0,
          commentsCount: 0,
          shares: 0,
          chartPoints: Array.from({ length: 7 }, () => Math.floor(Math.random() * 80) + 20),
          createdAt: new Date().toISOString(),
          strategySummary: response.result.strategySummary || "",
          tbaAddress: agent.tbaAddress,
          capabilityTag: "creative_content",
          actorType: "agent",
          actorId: agent.id,
          actionType: mode === "yield" ? "RUN_YIELD_STRATEGY" : "GENERATE_ALPHA",
          instrumentType: mode === "yield" ? "yield" : "meme",
          chainId: 97,
          contractAddress: appEnv.contracts.agentNft,
          proofURI: `0g://clusterfi-demo/social-feed-proof/${Date.now()}`,
          pnl: 0,
          tvl: 0,
          riskScore: mode === "yield" ? 52 : 68,
          strategyId: `strategy-${createClientId()}`,
        };
        
        console.log("Adding new post to feed:", newPost);
        const nextFeed = await clustrRepository.addFeedPost(newPost);
        startTransition(() => {
          setData((current) => ({ ...current, feed: nextFeed }));
          setAppStatus("success");
          console.log("Feed updated successfully");
        });
      } else {
        throw new Error("Failed to generate post");
      }
    } catch (error) {
      console.error("Error in generatePostForFeed:", error);
      setAppStatus("error");
      setAppError(error instanceof Error ? error.message : "Generation failed");
    }
  }

  async function likePost(postId: string) {
    const feed = await clustrRepository.toggleLike(postId);
    setData((current) => ({ ...current, feed }));
  }

  async function addComment(postId: string, body: string) {
    if (!wallet.account || wallet.status !== "connected") {
      throw new Error("Please connect your wallet to post a comment.");
    }

    await clustrRepository.addComment(postId, body, wallet.account);
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

  async function createOpenJob(evaluator: string, budgetAmount: string, expiryDays: number, description: string) {
    if (!wallet.account) throw new Error("Wallet not connected");
    setAppStatus("loading");
    try {
      await createOpenJobWeb3(
        getWalletClient(),
        getPublicClient(),
        wallet.account,
        evaluator,
        budgetAmount,
        expiryDays,
        description
      );
      await refreshApp();
    } catch (error) {
      setAppError(error instanceof Error ? error.message : "Failed to create job");
      setAppStatus("error");
      throw error;
    }
  }

  async function placeBid(jobId: string, providerKind: number, providerId: string) {
    if (!wallet.account) throw new Error("Wallet not connected");
    setAppStatus("loading");
    try {
      await placeBidWeb3(
        getWalletClient(),
        getPublicClient(),
        wallet.account,
        jobId,
        providerKind,
        providerId
      );
      await refreshApp();
    } catch (error) {
      setAppError(error instanceof Error ? error.message : "Failed to place bid");
      setAppStatus("error");
      throw error;
    }
  }

  async function acceptBid(jobId: string, bidIndex: number, budget: bigint) {
    if (!wallet.account) throw new Error("Wallet not connected");
    setAppStatus("loading");
    try {
      await acceptBidWeb3(
        getWalletClient(),
        getPublicClient(),
        wallet.account,
        jobId,
        bidIndex,
        budget
      );
      await refreshApp();
    } catch (error) {
      setAppError(error instanceof Error ? error.message : "Failed to accept bid");
      setAppStatus("error");
      throw error;
    }
  }

  async function depositFunds() {
    throw new Error("Direct deposits to agent or cluster TBAs are disabled. Open a non-custodial Sovereign Account from a strategy post instead.");
  }

  async function createAndDepositStrategyAccount(input: {
    approvedExecutor: string;
    strategyId: string;
    instrumentType?: string;
    amount: string;
    maxSlippageBps?: number;
  }) {
    if (!wallet.account) throw new Error("Wallet not connected");
    setAppStatus("loading");
    try {
      const result = await createUserStrategyAccount(
        wallet.account,
        input.approvedExecutor,
        input.strategyId,
        input.instrumentType,
        input.amount,
        input.maxSlippageBps ?? 100
      );
      await depositToUserStrategyAccount(wallet.account, result.accountAddress, input.amount);
      await refreshApp({ silent: true });
      setAppStatus("success");
    } catch (error) {
      setAppError(error instanceof Error ? error.message : "Strategy account setup failed");
      setAppStatus("error");
      throw error;
    }
  }

  async function addFundsToStrategyAccount(accountAddress: string, amount: string) {
    if (!wallet.account) throw new Error("Wallet not connected");
    setAppStatus("loading");
    try {
      await depositToUserStrategyAccount(wallet.account, accountAddress, amount);
      await refreshApp({ silent: true });
      setAppStatus("success");
    } catch (error) {
      setAppError(error instanceof Error ? error.message : "Could not add funds to Sovereign Account");
      setAppStatus("error");
      throw error;
    }
  }

  async function pauseStrategyAccount(accountAddress: string) {
    if (!wallet.account) throw new Error("Wallet not connected");
    await pauseUserStrategyAccount(wallet.account, accountAddress);
    await refreshApp({ silent: true });
  }

  async function resumeStrategyAccount(accountAddress: string) {
    if (!wallet.account) throw new Error("Wallet not connected");
    await resumeUserStrategyAccount(wallet.account, accountAddress);
    await refreshApp({ silent: true });
  }

  async function revokeStrategyExecutor(accountAddress: string) {
    if (!wallet.account) throw new Error("Wallet not connected");
    await revokeUserStrategyExecutor(wallet.account, accountAddress);
    await refreshApp({ silent: true });
  }

  async function withdrawStrategyAccount(accountAddress: string, amount: string) {
    if (!wallet.account) throw new Error("Wallet not connected");
    await withdrawFromUserStrategyAccount(wallet.account, accountAddress, amount);
    await refreshApp({ silent: true });
  }

  async function closeStrategyAccount(accountAddress: string) {
    if (!wallet.account) throw new Error("Wallet not connected");
    await closeUserStrategyAccount(wallet.account, accountAddress);
    await refreshApp({ silent: true });
  }

  async function assignAgentToSwarm(agentId: string, swarmTbaAddress: string) {
    if (!wallet.account) throw new Error("Wallet not connected");
    setAppStatus("loading");
    try {
      await assignAgentToSwarmWeb3(wallet.account, agentId, swarmTbaAddress);
      await refreshApp();
    } catch (error) {
      setAppError(error instanceof Error ? error.message : "Failed to assign agent");
      setAppStatus("error");
    }
  }

  async function removeAgentFromSwarm(swarmTbaAddress: string, agentId: string) {
    if (!wallet.account) throw new Error("Wallet not connected");
    setAppStatus("loading");
    try {
      await removeAgentFromSwarmWeb3(wallet.account, swarmTbaAddress, agentId);
      await refreshApp();
    } catch (error) {
      setAppError(error instanceof Error ? error.message : "Failed to remove agent");
      setAppStatus("error");
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
    generatePostForFeed,
    addComment,
    dismissNotification,
    executeAgent,
    connectWallet,
    disconnectWallet,
    ensureCorrectNetwork,
    resetToChain,
    createOpenJob,
    placeBid,
    acceptBid,
    depositFunds,
    createAndDepositStrategyAccount,
    addFundsToStrategyAccount,
    pauseStrategyAccount,
    resumeStrategyAccount,
    revokeStrategyExecutor,
    withdrawStrategyAccount,
    closeStrategyAccount,
    assignAgentToSwarm,
    removeAgentFromSwarm,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
