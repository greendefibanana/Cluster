import { createContext } from "react";
import type { AppBootstrap, ExecutionRecord, FeedMode, LoadStatus } from "../types/domain";
import type { EIP6963ProviderDetail } from "../lib/web3";

export interface WalletState {
  account: string | null;
  chainId: number | null;
  status: "disconnected" | "connecting" | "connected" | "error";
  error: string | null;
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
  connectWallet: (provider?: any) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  ensureCorrectNetwork: () => Promise<void>;
  resetToChain: () => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);
