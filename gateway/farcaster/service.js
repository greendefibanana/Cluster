import fs from "fs";
import path from "path";

const DEFAULT_APP_URL = process.env.FARCASTER_APP_URL || process.env.TUNNEL_URL || process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.GATEWAY_PORT || 3000}`;
const APP_NAME = "ClusterFi";
const LOCAL_FEED_FILES = [
  path.join(process.cwd(), "deployments", "local-feed-event.json"),
  path.join(process.cwd(), "deployments", "local-prediction-feed-event.json"),
];

export const demoFeedEvents = [
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
    timestamps: { createdAt: new Date(Date.now() - 18 * 60_000).toISOString(), updatedAt: new Date().toISOString() },
  },
];

export function normalizeWidgetData(input, { appUrl = DEFAULT_APP_URL } = {}) {
  const event = { ...input };
  const strategyId = event.strategy?.id || event.strategyId || event.id;
  const agentId = event.agent?.id || event.agentId || null;
  const clusterId = event.cluster?.id || event.clusterId || null;
  const type = normalizeType(event.type || event.instrumentType || event.strategy?.type);
  const feedEventId = event.feedEventId || event.id;
  const actionUrl = buildFarcasterActionUrl({ ...event, type, feedEventId, strategy: { ...(event.strategy || {}), id: strategyId }, agent: event.agent || (agentId ? { id: agentId } : null), cluster: event.cluster || (clusterId ? { id: clusterId } : null) }, { appUrl });
  return {
    id: event.id || feedEventId,
    feedEventId,
    type,
    title: event.title || event.insightTitle || event.strategy?.name || "ClusterFi Strategy",
    subtitle: event.subtitle || event.strategySummary || "",
    description: event.description || event.content || "",
    agent: event.agent === null ? null : event.agent || {
      id: agentId || "agent-demo",
      name: event.authorName || "ClusterFi Agent",
      avatar: event.avatarUrl || "https://placeholder.pics/svg/300",
      verified: true,
      role: event.roleLabel || "Strategy Agent",
      reputationScore: event.score || 80,
    },
    cluster: event.cluster || null,
    strategy: {
      id: strategyId,
      type,
      name: event.strategy?.name || event.title || event.insightTitle || "Investable strategy",
      chain: event.strategy?.chain || (event.chainId ? `Chain ${event.chainId}` : "Mantle"),
      protocol: event.strategy?.protocol || "ClusterFi",
      status: event.strategy?.status || "active",
      riskScore: Number(event.strategy?.riskScore ?? event.riskScore ?? 50),
      proofURI: event.strategy?.proofURI || event.proofURI || "",
      validationStatus: event.strategy?.validationStatus || "pending",
    },
    metrics: {
      tvl: Number(event.metrics?.tvl ?? event.tvl ?? 0),
      investors: Number(event.metrics?.investors ?? event.investors ?? 0),
      suppliers: Number(event.metrics?.suppliers ?? event.suppliers ?? 0),
      alphaBridge: Number(event.metrics?.alphaBridge ?? event.alphaBridge ?? 1),
      returnPercent: Number(event.metrics?.returnPercent ?? event.returnPercent ?? 0),
      predictionWins: event.metrics?.predictionWins ?? event.predictionWins ?? null,
      pnl: Number(event.metrics?.pnl ?? event.pnl ?? 0),
      apy: event.metrics?.apy ?? event.apy ?? null,
      liquidity: Number(event.metrics?.liquidity ?? event.liquidity ?? 0),
    },
    action: { label: "Enter Strategy", url: actionUrl },
    timestamps: event.timestamps || { createdAt: event.createdAt || new Date().toISOString(), updatedAt: event.updatedAt || new Date().toISOString() },
  };
}

export function getFeedEvent(feedEventId) {
  return listFeedEvents().find((item) => item.feedEventId === feedEventId || item.id === feedEventId) || null;
}

export function listFeedEvents() {
  const events = [...demoFeedEvents, ...loadLocalFeedEvents()];
  const seen = new Set();
  return events
    .map((event) => normalizeWidgetData(event))
    .filter((event) => {
      const key = event.feedEventId || event.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function buildFarcasterActionUrl(feedEvent, { appUrl = DEFAULT_APP_URL } = {}) {
  const base = appUrl.replace(/\/$/, "");
  const strategyId = feedEvent.strategy?.id || feedEvent.strategyId || feedEvent.id;
  if (feedEvent.cluster?.id) {
    return `${base}/mini/cluster/${encodeURIComponent(feedEvent.cluster.id)}?strategy=${encodeURIComponent(strategyId)}`;
  }
  if (feedEvent.agent?.id) {
    return `${base}/mini/agent/${encodeURIComponent(feedEvent.agent.id)}?strategy=${encodeURIComponent(strategyId)}`;
  }
  return `${base}/mini/strategy/${encodeURIComponent(strategyId)}`;
}

export function buildFarcasterEmbedUrl(feedEvent, { appUrl = DEFAULT_APP_URL } = {}) {
  return `${appUrl.replace(/\/$/, "")}/api/farcaster/embed/${encodeURIComponent(feedEvent.feedEventId || feedEvent.id)}`;
}

export function buildFarcasterCastText(feedEvent) {
  const data = normalizeWidgetData(feedEvent);
  if (["prediction", "meme"].includes(data.type)) {
    return `${data.title} is up ${formatPercent(data.metrics.returnPercent)} across ${data.metrics.predictionWins || 5} predictions.\nTVL: ${formatCurrency(data.metrics.tvl)}\nAlpha Bridge: ${data.metrics.alphaBridge.toFixed(1)}x\nEnter strategy below.`;
  }
  return `${data.title} found a strategy with ${formatCurrency(data.metrics.tvl)} TVL.\nSuppliers: ${formatCompact(data.metrics.suppliers)}\nAlpha Bridge: ${data.metrics.alphaBridge.toFixed(1)}x\nEnter strategy below.`;
}

export function buildMiniAppEmbed(feedEvent, { appUrl = DEFAULT_APP_URL } = {}) {
  const base = absoluteBaseUrl(appUrl);
  const data = normalizeWidgetData(feedEvent, { appUrl: base });
  return {
    version: "1",
    imageUrl: `${base}/api/farcaster/og/${encodeURIComponent(data.feedEventId)}`,
    button: {
      title: "Enter Strategy",
      action: {
        type: "launch_miniapp",
        name: APP_NAME,
        url: data.action.url,
        splashImageUrl: `${base}/icons.svg`,
        splashBackgroundColor: "#0b1220",
      },
    },
  };
}

export function buildManifest({ appUrl = DEFAULT_APP_URL } = {}) {
  const base = absoluteBaseUrl(appUrl);
  const miniapp = {
    version: "1",
    name: APP_NAME,
    homeUrl: `${base}/mini`,
    iconUrl: `${base}/favicon.svg`,
    splashImageUrl: `${base}/icons.svg`,
    splashBackgroundColor: "#0b1220",
    subtitle: "Investable agent posts",
    description: "AI agent and cluster strategy posts with proof, reputation, risk, and Sovereign Account entry.",
    primaryCategory: "finance",
    tags: ["defi", "agents", "farcaster", "prediction"],
    heroImageUrl: `${base}/api/farcaster/og/feed-yield-vault-9`,
    tagline: "Enter strategies from the feed",
    ogTitle: APP_NAME,
    ogDescription: "Farcaster feed plus AI agents plus internet capital markets.",
    ogImageUrl: `${base}/api/farcaster/og/feed-yield-vault-9`,
    noindex: process.env.FARCASTER_DEBUG === "true",
  };
  return {
    accountAssociation: {
      header: process.env.FARCASTER_ACCOUNT_ASSOCIATION_HEADER || "",
      payload: process.env.FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD || "",
      signature: process.env.FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE || "",
    },
    miniapp,
    frame: miniapp,
  };
}

export function validateFarcasterProductionConfig({ appUrl = DEFAULT_APP_URL } = {}) {
  const issues = [];
  const base = appUrl || "";
  if (!/^https:\/\//i.test(base)) issues.push("FARCASTER_APP_URL/NEXT_PUBLIC_APP_URL must be an HTTPS origin");
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(base)) issues.push("Farcaster production URL must not point at localhost");
  for (const key of ["FARCASTER_ACCOUNT_ASSOCIATION_HEADER", "FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD", "FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE"]) {
    if (!process.env[key]) issues.push(`${key} is required for Farcaster publishing`);
  }
  return { ok: issues.length === 0, issues };
}

export function buildPreviewSvg(feedEvent) {
  const data = normalizeWidgetData(feedEvent);
  const isPrediction = ["prediction", "meme"].includes(data.type);
  const metric = isPrediction ? `${formatPercent(data.metrics.returnPercent)}` : `${formatPercent(data.metrics.apy ?? data.metrics.returnPercent)}`;
  const metricLabel = isPrediction ? `on ${data.metrics.predictionWins || 5}/5 Predictions` : "APY (Net Yield)";
  const leftStat = isPrediction ? `TVL: ${formatCurrency(data.metrics.tvl)}` : `TVL ${formatCurrency(data.metrics.tvl)}`;
  const rightStat = isPrediction ? `${formatCompact(data.metrics.investors)} Investors` : `Suppliers ${formatCompact(data.metrics.suppliers)}`;
  const escaped = {
    title: escapeXml(data.title),
    subtitle: escapeXml(data.subtitle || data.agent?.role || ""),
    metric: escapeXml(metric),
    metricLabel: escapeXml(metricLabel),
    leftStat: escapeXml(leftStat),
    rightStat: escapeXml(rightStat),
    bridge: escapeXml(`Alpha Bridge: ${data.metrics.alphaBridge.toFixed(1)}x`),
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#101418"/><stop offset="1" stop-color="#0b1220"/></linearGradient>
    <linearGradient id="gold" x1="0" x2="1"><stop offset="0" stop-color="#FFD700"/><stop offset="1" stop-color="#FFF099"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1200" height="800" rx="36" fill="url(#bg)"/>
  <path d="M0 620 C240 510 380 710 620 560 C840 420 990 470 1200 330 L1200 800 L0 800Z" fill="${isPrediction ? "#122c35" : "#221f12"}" opacity=".65"/>
  <g opacity=".18" stroke="#a4e6ff"><path d="M0 120H1200M0 240H1200M0 360H1200M0 480H1200M0 600H1200M0 720H1200"/><path d="M120 0V800M240 0V800M360 0V800M480 0V800M600 0V800M720 0V800M840 0V800M960 0V800M1080 0V800"/></g>
  <rect x="52" y="52" width="1096" height="696" rx="32" fill="#151b22" opacity=".72" stroke="#3c494e"/>
  <circle cx="116" cy="120" r="42" fill="#1f2937" stroke="#a4e6ff" stroke-width="3"/>
  <text x="176" y="112" fill="#f6f8fb" font-family="Inter, Arial" font-weight="800" font-size="34">${escaped.title}</text>
  <text x="176" y="148" fill="#a4e6ff" font-family="Inter, Arial" font-size="20">${escaped.subtitle}</text>
  <rect x="874" y="82" width="224" height="44" rx="22" fill="#18242b" stroke="#a4e6ff" opacity=".95"/>
  <text x="908" y="111" fill="#a4e6ff" font-family="Inter, Arial" font-weight="700" font-size="20">${escaped.bridge}</text>
  <text x="600" y="388" text-anchor="middle" fill="${isPrediction ? "#a4e6ff" : "url(#gold)"}" filter="url(#glow)" font-family="Inter, Arial" font-weight="900" font-size="128">${escaped.metric}</text>
  <text x="600" y="446" text-anchor="middle" fill="#e5e2e3" font-family="Inter, Arial" font-weight="700" font-size="32">${escaped.metricLabel}</text>
  <rect x="222" y="618" width="294" height="70" rx="18" fill="#1a2028" stroke="#3c494e"/>
  <rect x="684" y="618" width="294" height="70" rx="18" fill="#1a2028" stroke="#3c494e"/>
  <text x="369" y="662" text-anchor="middle" fill="#f6f8fb" font-family="Inter, Arial" font-weight="800" font-size="26">${escaped.leftStat}</text>
  <text x="831" y="662" text-anchor="middle" fill="#f6f8fb" font-family="Inter, Arial" font-weight="800" font-size="26">${escaped.rightStat}</text>
  <text x="600" y="726" text-anchor="middle" fill="#00f9be" font-family="Inter, Arial" font-weight="800" font-size="22">Enter Strategy</text>
</svg>`;
}

export function shareStrategyToFarcaster(feedEvent) {
  const data = normalizeWidgetData(feedEvent);
  return {
    text: buildFarcasterCastText(data),
    embedUrl: buildFarcasterEmbedUrl(data),
    actionUrl: data.action.url,
  };
}

export function getActorTxHistory(actorId, actorType = "agent") {
  return [
    { hash: `0x${actorId}001`, chain: "Mantle", type: `${actorType}_strategy_created`, timestamp: new Date(Date.now() - 24 * 60 * 60_000).toISOString(), status: "confirmed", explorerUrl: "", summary: "Strategy proof attached and feed event created." },
    { hash: `0x${actorId}002`, chain: "Mantle", type: "sovereign_permission", timestamp: new Date(Date.now() - 3 * 60 * 60_000).toISOString(), status: "confirmed", explorerUrl: "", summary: "Limited adapter permission granted by user." },
  ];
}

export function getStrategyTxHistory(strategyId) {
  return getActorTxHistory(strategyId, "strategy");
}

export function getStrategyProofs(strategyId) {
  const event = listFeedEvents().find((item) => item.strategy.id === strategyId) || listFeedEvents()[0];
  return [{ proofURI: event.strategy.proofURI, source: "0G", type: "strategy-proof", timestamp: event.timestamps.updatedAt, validationStatus: event.strategy.validationStatus }];
}

export function getValidationStatus(strategyId) {
  const event = listFeedEvents().find((item) => item.strategy.id === strategyId);
  return { strategyId, status: event?.strategy.validationStatus || "pending", checkedAt: new Date().toISOString() };
}

export function getReputationEvents(actorId) {
  return [
    { id: `${actorId}-rep-1`, actorId, scoreDelta: 7, eventType: "policy_safe_output", proofURI: "0g-local://clusterfi/reputation", timestamp: new Date().toISOString() },
  ];
}

function normalizeType(type = "defi") {
  const normalized = String(type).toLowerCase();
  if (["prediction", "meme"].includes(normalized)) return normalized;
  if (["defi", "yield", "lp", "perps"].includes(normalized)) return normalized;
  return "defi";
}

function loadLocalFeedEvents() {
  const events = [];
  for (const filePath of LOCAL_FEED_FILES) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (Array.isArray(parsed)) events.push(...parsed);
      else events.push(parsed);
    } catch {
      // Local E2E feed artifacts are optional and should not block the gateway.
    }
  }
  return events;
}

function formatCurrency(value) {
  const number = Number(value || 0);
  if (number >= 1_000_000) return `$${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `$${(number / 1_000).toFixed(1)}K`;
  return `$${number.toLocaleString()}`;
}

function absoluteBaseUrl(appUrl) {
  const value = String(appUrl || DEFAULT_APP_URL).replace(/\/$/, "");
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function formatCompact(value) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
}

function formatPercent(value) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${number.toFixed(number % 1 ? 1 : 0)}%`;
}

function escapeXml(value) {
  return String(value ?? "").replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[char]));
}
