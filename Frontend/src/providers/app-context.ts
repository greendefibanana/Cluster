import { createContext } from "react";
import type { AppBootstrap, ExecutionRecord, FeedMode, LoadStatus } from "../types/domain";
import type { EIP6963ProviderDetail } from "../lib/web3";

export interface WalletState {
  account: string | null;
  chainId: number | null;
  status: "disconnected" | "connecting" | "connected" | "error";
  error: string | null;
  providerName?: string | null;
  source?: "dynamic" | "injected" | "farcaster" | null;
}

export interface AppContextValue extends AppBootstrap {
  appStatus: LoadStatus;
  appError: string | null;
  wallet: WalletState;
  discoveredProviders: EIP6963ProviderDetail[];
  refreshApp: () => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  generatePostForFeed: (mode?: FeedMode) => Promise<void>;
  addComment: (postId: string, body: string) => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
  executeAgent: (input: { agentId: string; message: string; action?: string }) => Promise<ExecutionRecord>;
  connectWallet: (provider?: unknown) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  ensureCorrectNetwork: () => Promise<void>;
  resetToChain: () => Promise<void>;
  createOpenJob: (evaluator: string, budgetAmount: string, expiryDays: number, description: string) => Promise<void>;
  placeBid: (jobId: string, providerKind: number, providerId: string) => Promise<void>;
  acceptBid: (jobId: string, bidIndex: number, budget: bigint) => Promise<void>;
  depositFunds: (targetId: string, isSwarm: boolean, amount: string, currency: "BNB" | "x402") => Promise<void>;
  createAndDepositStrategyAccount: (input: {
    approvedExecutor: string;
    strategyId: string;
    instrumentType?: string;
    amount: string;
    asset?: "erc20" | "native";
    maxSlippageBps?: number;
  }) => Promise<void>;
  addFundsToStrategyAccount: (accountAddress: string, amount: string, asset?: "erc20" | "native") => Promise<void>;
  pauseStrategyAccount: (accountAddress: string) => Promise<void>;
  resumeStrategyAccount: (accountAddress: string) => Promise<void>;
  revokeStrategyExecutor: (accountAddress: string) => Promise<void>;
  withdrawStrategyAccount: (accountAddress: string, amount: string, asset?: "erc20" | "native") => Promise<void>;
  closeStrategyAccount: (accountAddress: string, asset?: "erc20" | "native") => Promise<void>;
  assignAgentToSwarm: (agentId: string, swarmTbaAddress: string) => Promise<void>;
  removeAgentFromSwarm: (swarmTbaAddress: string, agentId: string) => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);
