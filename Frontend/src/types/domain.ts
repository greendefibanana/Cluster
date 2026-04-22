export type LoadStatus = "idle" | "loading" | "success" | "error";

export type FeedMode = "social" | "yield";

export interface FeedPost {
  id: string;
  agentId: string;
  authorName: string;
  authorHandle: string;
  avatarUrl: string;
  roleLabel: string;
  score: number;
  mode: FeedMode;
  content: string;
  insightTitle?: string;
  tags: string[];
  likes: number;
  commentsCount: number;
  shares: number;
  chartPoints: number[];
  createdAt: string;
  strategySummary: string;
  tbaAddress: string;
  capabilityTag?: string;
}

export interface FeedComment {
  id: string;
  postId: string;
  authorName: string;
  authorHandle: string;
  avatarUrl: string;
  body: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  kind: "success" | "info" | "warning" | "signal";
  title: string;
  body: string;
  createdAt: string;
  accent: "primary" | "secondary" | "tertiary" | "error";
  metric?: string;
  ctaLabel?: string;
}

export interface AgentSkillSlot {
  slotId: string;
  name: string;
  level: number;
  icon: string;
  accent: "primary" | "secondary" | "tertiary";
  equipped: boolean;
  capabilityTag?: string;
}

export interface ProofEvent {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  accent: "primary" | "secondary" | "tertiary";
  txHash: string;
  valueLabel?: string;
}

export interface VaultAsset {
  id: string;
  kind: "token" | "nft";
  name: string;
  symbol: string;
  amountLabel: string;
  usdValueLabel: string;
  accent: string;
  description?: string;
  statusLabel?: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  title: string;
  avatarUrl: string;
  ownerAddress: string;
  tbaAddress: string;
  rank: number;
  score: number;
  winRate: number;
  lifetimeYieldLabel: string;
  evolutionTier: string;
  followerCount: number;
  auraLabel: string;
  alphaRate: number;
  status: "active" | "standby";
  tags: string[];
  performanceSeries: number[];
  skills: AgentSkillSlot[];
  proofs: ProofEvent[];
  vaultAssets: VaultAsset[];
}

export interface SwarmProfile {
  id: string;
  name: string;
  strategy: string;
  description: string;
  ownerAddress: string;
  tbaAddress: string;
  memberCount: number;
  tvlLabel: string;
  roiLabel: string;
  status: "active" | "standby";
  agents: AgentProfile[];
}

export interface SkillListing {
  id: string;
  name: string;
  category: string;
  description: string;
  creatorAddress: string;
  priceLabel: string;
  alphaScore: number;
  rarity: string;
  views: number;
  visualUrl: string;
  accent: "primary" | "secondary" | "tertiary";
  capabilityTag?: string;
  inventoryCount?: number;
}

export interface Bid {
  providerKind: number; // 0: Agent, 1: Swarm
  providerId: string;
  createdAt: number;
}

export interface JobListing {
  id: string;
  title: string;
  subtitle: string;
  rewardLabel: string;
  durationLabel: string;
  bidCount: number;
  stateLabel: string;
  accent: "primary" | "secondary" | "tertiary" | "error";
  summary: string;
  creditedAgents: string[];
  clientAddress?: string;
  evaluatorAddress?: string;
  budget?: string;
  status?: number;
  providerKind?: number;
  providerId?: string;
  bids?: Bid[];
}

export interface OverviewMetrics {
  tvlLabel: string;
  tvlTokenLabel: string;
  tvlDeltaLabel: string;
  totalGeneratedLabel: string;
  ownerSplitLabel: string;
  agentPoolLabel: string;
  growth24h: number[];
  growth7d: number[];
  recentLogs: Array<{
    id: string;
    kind: "deposit" | "rebalance" | "yield";
    title: string;
    createdAt: string;
    valueLabel?: string;
  }>;
}

export interface ExecutionRecord {
  id: string;
  agentId: string;
  prompt: string;
  action: string;
  status: "success" | "error" | "pending";
  createdAt: string;
  response: string;
  selectedSkillName?: string;
}

export interface AppBootstrap {
  overview: OverviewMetrics;
  feed: FeedPost[];
  comments: FeedComment[];
  notifications: NotificationItem[];
  agents: AgentProfile[];
  swarms: SwarmProfile[];
  skills: SkillListing[];
  jobs: JobListing[];
  executionHistory: ExecutionRecord[];
}

export interface AppSliceState<T> {
  data: T;
  status: LoadStatus;
  error: string | null;
}

export interface AgentExecutionInput {
  agentId: string;
  message: string;
  action?: string;
}
