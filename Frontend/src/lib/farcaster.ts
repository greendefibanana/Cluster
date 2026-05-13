import { appEnv } from "./env";

export type ClusterFiWidgetType = "prediction" | "meme" | "defi" | "yield" | "lp" | "perps";

export interface ClusterFiWidgetData {
  id: string;
  feedEventId: string;
  type: ClusterFiWidgetType;
  title: string;
  subtitle: string;
  description: string;
  agent: {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
    role: string;
    reputationScore: number;
  };
  cluster: {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
    reputationScore: number;
  } | null;
  strategy: {
    id: string;
    type: string;
    name: string;
    chain: string;
    protocol: string;
    status: string;
    riskScore: number;
    proofURI: string;
    validationStatus: string;
  };
  metrics: {
    tvl: number;
    investors: number;
    suppliers: number;
    alphaBridge: number;
    returnPercent: number;
    predictionWins: number | null;
    pnl: number;
    apy: number | null;
    liquidity: number;
  };
  action: {
    label: "Enter Strategy";
    url: string;
  };
  timestamps: {
    createdAt: string;
    updatedAt: string;
  };
}

export interface TxHistoryItem {
  hash: string;
  chain: string;
  type: string;
  timestamp: string;
  status: string;
  explorerUrl: string;
  summary: string;
}

export interface StrategyProof {
  proofURI: string;
  source: "0G";
  type: string;
  timestamp: string;
  validationStatus: string;
}

export const demoWidgets: ClusterFiWidgetData[] = [
  {
    id: "feed-prediction-alpha-7",
    feedEventId: "feed-prediction-alpha-7",
    type: "prediction",
    title: "Prediction Agent Alpha-7",
    subtitle: "30% return on 5 predictions",
    description: "Narrative and market-structure thesis from a verified prediction agent.",
    agent: { id: "alpha-7", name: "Alpha-7", avatar: "https://placeholder.pics/svg/300", verified: true, role: "Prediction Oracle", reputationScore: 91 },
    cluster: null,
    strategy: { id: "strategy-prediction-alpha-7", type: "prediction", name: "BTC probability basket", chain: "Polygon", protocol: "Polymarket", status: "active", riskScore: 42, proofURI: "0g-local://clusterfi/prediction-alpha-7", validationStatus: "valid" },
    metrics: { tvl: 42_500, investors: 128, suppliers: 0, alphaBridge: 2.1, returnPercent: 30, predictionWins: 5, pnl: 12_750, apy: null, liquidity: 58_000 },
    action: { label: "Enter Strategy", url: "/mini/agent/alpha-7?strategy=strategy-prediction-alpha-7" },
    timestamps: { createdAt: new Date(Date.now() - 32 * 60_000).toISOString(), updatedAt: new Date().toISOString() },
  },
  {
    id: "feed-yield-vault-9",
    feedEventId: "feed-yield-vault-9",
    type: "yield",
    title: "Yield Agent Vault-9",
    subtitle: "22.4% net APY on USDC strategy",
    description: "DeFi yield strategy found through free public data and policy-checked before execution.",
    agent: { id: "vault-9", name: "Vault-9", avatar: "https://placeholder.pics/svg/300", verified: true, role: "Yield Quant", reputationScore: 88 },
    cluster: { id: "cluster-defi-1", name: "Kinetic Vault Cluster", avatar: "https://placeholder.pics/svg/300", verified: true, reputationScore: 93 },
    strategy: { id: "strategy-yield-vault-9", type: "yield", name: "USDC guarded yield", chain: "Mantle", protocol: "Morpho / Uniswap", status: "active", riskScore: 55, proofURI: "0g-local://clusterfi/yield-vault-9", validationStatus: "valid" },
    metrics: { tvl: 512_000, investors: 0, suppliers: 1_200, alphaBridge: 1.5, returnPercent: 22.4, predictionWins: null, pnl: 48_200, apy: 22.4, liquidity: 710_000 },
    action: { label: "Enter Strategy", url: "/mini/cluster/cluster-defi-1?strategy=strategy-yield-vault-9" },
    timestamps: { createdAt: new Date(Date.now() - 18 * 60_000).toISOString(), updatedAt: new Date().toISOString() },
  },
];

export function widgetForType(type: ClusterFiWidgetType): "prediction" | "yield" {
  if (type === "prediction" || type === "meme") return "prediction";
  return "yield";
}

export function buildEnterStrategyUrl(data: ClusterFiWidgetData): string {
  if (data.cluster?.id) return `/mini/cluster/${encodeURIComponent(data.cluster.id)}?strategy=${encodeURIComponent(data.strategy.id)}`;
  if (data.agent?.id) return `/mini/agent/${encodeURIComponent(data.agent.id)}?strategy=${encodeURIComponent(data.strategy.id)}`;
  return `/mini/strategy/${encodeURIComponent(data.strategy.id)}`;
}

export async function fetchWidgetData(feedEventId: string): Promise<ClusterFiWidgetData> {
  try {
    const response = await fetch(`${appEnv.gatewayUrl}/api/widget/${encodeURIComponent(feedEventId)}`);
    if (!response.ok) throw new Error("Widget not found");
    const payload = await response.json() as { widget: ClusterFiWidgetData };
    return payload.widget;
  } catch {
    const fallback = demoWidgets.find((item) => item.feedEventId === feedEventId || item.id === feedEventId);
    if (!fallback) throw new Error("Widget not found");
    return fallback;
  }
}

export async function fetchMiniStrategy(strategyId: string): Promise<{
  widget: ClusterFiWidgetData;
  txHistory: TxHistoryItem[];
  proofs: StrategyProof[];
  validation: { status: string; checkedAt: string };
  reputation: Array<{ id: string; eventType: string; scoreDelta: number; proofURI: string; timestamp: string }>;
}> {
  try {
    const response = await fetch(`${appEnv.gatewayUrl}/api/strategy/${encodeURIComponent(strategyId)}`);
    if (!response.ok) throw new Error("Strategy not found");
    return response.json();
  } catch {
    const widget = demoWidgets.find((item) => item.strategy.id === strategyId) ?? demoWidgets[0];
    return {
      widget,
      txHistory: demoTxHistory(widget.strategy.id),
      proofs: [{ proofURI: widget.strategy.proofURI, source: "0G", type: "strategy-proof", timestamp: widget.timestamps.updatedAt, validationStatus: widget.strategy.validationStatus }],
      validation: { status: widget.strategy.validationStatus, checkedAt: new Date().toISOString() },
      reputation: [{ id: "rep-1", eventType: "policy_safe_output", scoreDelta: 7, proofURI: widget.strategy.proofURI, timestamp: new Date().toISOString() }],
    };
  }
}

export async function fetchMiniProfile(kind: "agent" | "cluster", id: string) {
  try {
    const response = await fetch(`${appEnv.gatewayUrl}/api/${kind}/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error(`${kind} not found`);
    return response.json();
  } catch {
    const strategies = demoWidgets.filter((item) => kind === "agent" ? item.agent.id === id : item.cluster?.id === id);
    return {
      [kind]: kind === "agent" ? strategies[0]?.agent || demoWidgets[0].agent : strategies[0]?.cluster || demoWidgets[1].cluster,
      strategies: strategies.length ? strategies : demoWidgets,
      txHistory: demoTxHistory(id),
      reputation: [{ id: `${id}-rep`, eventType: "policy_safe_output", scoreDelta: 7, proofURI: strategies[0]?.strategy.proofURI || demoWidgets[0].strategy.proofURI, timestamp: new Date().toISOString() }],
    };
  }
}

export function buildFarcasterCastText(data: ClusterFiWidgetData): string {
  if (widgetForType(data.type) === "prediction") {
    return `${data.title} is up ${formatPercent(data.metrics.returnPercent)} across ${data.metrics.predictionWins || 5} predictions.\nTVL: ${formatCurrency(data.metrics.tvl)}\nAlpha Bridge: ${data.metrics.alphaBridge.toFixed(1)}x\nEnter strategy below.`;
  }
  return `${data.title} found a strategy with ${formatCurrency(data.metrics.tvl)} TVL.\nSuppliers: ${formatCompact(data.metrics.suppliers)}\nAlpha Bridge: ${data.metrics.alphaBridge.toFixed(1)}x\nEnter strategy below.`;
}

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(value % 1 ? 1 : 0)}%`;
}

function demoTxHistory(id: string): TxHistoryItem[] {
  return [
    { hash: `0x${id.slice(0, 8)}001`, chain: "Mantle", type: "strategy_created", timestamp: new Date(Date.now() - 86_400_000).toISOString(), status: "confirmed", explorerUrl: "", summary: "Strategy proof attached and feed event created." },
    { hash: `0x${id.slice(0, 8)}002`, chain: "Mantle", type: "sovereign_permission", timestamp: new Date(Date.now() - 10_800_000).toISOString(), status: "confirmed", explorerUrl: "", summary: "Limited adapter permission granted by user." },
  ];
}
