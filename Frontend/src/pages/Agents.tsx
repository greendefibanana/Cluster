import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../hooks/useAppContext";
import {
  saveAgentIntelligenceConfig,
  saveByokCredential,
  type IntelligenceProvider,
} from "../lib/gateway";
import { mintNewAgent } from "../lib/web3";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

const intelligenceSources: Array<{ value: IntelligenceProvider; label: string; model: string; needsKey: boolean; needsEndpoint?: boolean }> = [
  { value: "mock", label: "Mock Local", model: "mock-fast", needsKey: false },
  { value: "gemini", label: "Gemini BYOK", model: "gemini-2.5-flash", needsKey: true },
  { value: "openai", label: "OpenAI BYOK", model: "gpt-4o-mini", needsKey: true },
  { value: "anthropic", label: "Claude BYOK", model: "claude-3-5-sonnet-latest", needsKey: true },
  { value: "custom-openai", label: "Custom OpenAI-Compatible", model: "custom", needsKey: true, needsEndpoint: true },
];

export default function Agents() {
  const navigate = useNavigate();
  const { agents, wallet, refreshApp } = useAppContext();
  const [featured, secondary, ...rest] = [...agents].sort((a, b) => a.rank - b.rank);
  const [minting, setMinting] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentRole, setAgentRole] = useState("Operative");
  const [agentDescription, setAgentDescription] = useState("Freshly minted operative agent.");
  const [showMintToast, setShowMintToast] = useState(false);
  const [mintMessage, setMintMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [intelligenceProvider, setIntelligenceProvider] = useState<IntelligenceProvider>("mock");
  const [intelligenceModel, setIntelligenceModel] = useState("mock-fast");
  const [intelligenceApiKey, setIntelligenceApiKey] = useState("");
  const [intelligenceEndpoint, setIntelligenceEndpoint] = useState("");

  // Filter agents owned by the current user
  const myAgents = agents.filter(a => a.ownerAddress.toLowerCase() === wallet.account?.toLowerCase());

  const handleMint = async () => {
    setMintMessage(null);
    if (!wallet.account) {
      setMintMessage({ type: "error", text: "Connect a wallet before minting an agent." });
      return;
    }
    const finalName = agentName.trim() || "New Swarm Agent";
    const finalRole = agentRole.trim() || "Operative";
    const finalDescription = agentDescription.trim() || "Freshly minted operative agent.";
    const selectedSource = intelligenceSources.find((source) => source.value === intelligenceProvider) ?? intelligenceSources[0];
    if (selectedSource.needsKey && !intelligenceApiKey.trim()) {
      setMintMessage({ type: "error", text: `Paste a ${selectedSource.label} key or choose Mock Local for this agent.` });
      return;
    }
    if (selectedSource.needsEndpoint && !intelligenceEndpoint.trim()) {
      setMintMessage({ type: "error", text: "Enter the HTTPS endpoint for the custom OpenAI-compatible provider." });
      return;
    }
    setMinting(true);
    try {
      // ── 1. On-chain mint (the real transaction) ──
      const minted = await mintNewAgent(wallet.account, finalName, finalRole, finalDescription);

      // ── 2. Gateway registration (best-effort: auth + config save) ──
      // This step failing does NOT undo the on-chain mint.
      let gatewayWarning: string | null = null;
      if (minted.agentId) {
        try {
          if (selectedSource.needsKey) {
            await saveByokCredential({
              userId: wallet.account,
              agentId: minted.agentId,
              provider: intelligenceProvider,
              apiKey: intelligenceApiKey.trim(),
              endpointUrl: selectedSource.needsEndpoint ? intelligenceEndpoint.trim() : undefined,
              metadata: { model: intelligenceModel, source: "mint-agent" },
            });
          }
          await saveAgentIntelligenceConfig({
            userId: wallet.account,
            agentId: minted.agentId,
            provider: intelligenceProvider,
            model: intelligenceModel,
          });
        } catch (gatewayError) {
          console.warn("Gateway registration failed (non-fatal):", gatewayError);
          gatewayWarning = `Agent minted on-chain (tx: ${minted.hash?.slice(0, 10)}…) but gateway config could not be saved — you can set this later in Agent Editor.`;
        }
      }

      setAgentName("");
      setAgentRole("Operative");
      setAgentDescription("Freshly minted operative agent.");
      setIntelligenceApiKey("");
      setIntelligenceEndpoint("");
      await refreshApp();
      setShowMintToast(false);
      setMintMessage({
        type: "success",
        text: gatewayWarning ?? `${finalName} was minted and linked to ${selectedSource.label} intelligence.`,
      });
    } catch (error) {
      setMintMessage({ type: "error", text: `Mint failed: ${errorMessage(error)}` });
    } finally {
      setMinting(false);
    }
  };

  return (
    <main className="flex-1 p-6 md:p-10 lg:p-12 space-y-12">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="font-headline text-[3.5rem] leading-none font-bold text-on-surface tracking-tighter mb-2">
            Hall of <span className="gradient-text">Fame</span>
          </h2>
          <p className="font-body text-on-surface-variant text-sm max-w-xl">
            The absolute pinnacle of kinetic evolution. These agents are ranked live from the shared Clustr data layer instead of static mock scores.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-3 glass-panel px-4 py-2 rounded-lg ghost-border">
            <span className="material-symbols-outlined text-tertiary text-lg" aria-hidden="true">military_tech</span>
            <span className="font-label text-sm text-tertiary uppercase tracking-widest">Season 04 Elite</span>
          </div>
          <button 
            onClick={() => {
              setMintMessage(null);
              setShowMintToast(true);
            }}
            className="flex items-center gap-2 bg-primary text-on-primary font-bold px-4 py-2 rounded-lg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="material-symbols-outlined" aria-hidden="true">add_circle</span>
            Mint Agent
          </button>
        </div>
      </div>

      {mintMessage ? (
        <div className={`max-w-7xl mx-auto rounded-xl border px-4 py-3 text-sm font-body ${mintMessage.type === "success" ? "border-tertiary/30 bg-tertiary/10 text-tertiary" : "border-error/30 bg-error/10 text-error"}`}>
          {mintMessage.text}
        </div>
      ) : null}

      {myAgents.length > 0 && (
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary" aria-hidden="true">person_search</span>
            <h3 className="font-headline text-2xl font-bold text-on-surface">My Inventory</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {myAgents.map((agent) => (
              <button
                key={`my-${agent.id}`}
                onClick={() => navigate(`/agent-detail?agentId=${agent.id}`)}
                className="bg-surface-container-high rounded-xl p-4 border border-primary/20 hover:border-primary/50 transition-all text-left flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-outline-variant/20 flex-shrink-0">
                  <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-headline font-bold text-on-surface truncate">{agent.name}</h4>
                  <p className="font-label text-[10px] text-primary uppercase tracking-widest">Agent #{agent.id}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="h-px bg-outline-variant/10 w-full" />
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
        {featured ? (
          <button
            onClick={() => navigate(`/agent-detail?agentId=${featured.id}`)}
            className="md:col-span-8 relative rounded-xl overflow-hidden bg-surface-container-low min-h-[500px] flex flex-col justify-end p-8 ghost-border glow-shadow group cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="absolute inset-0 z-0">
              <img alt={`${featured.name} background`} className="w-full h-full object-cover opacity-40 mix-blend-screen transition-transform duration-700 group-hover:scale-105" src={featured.avatarUrl} />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent" />
            </div>
            <div className="relative z-10 flex flex-col gap-6">
              <div className="flex justify-between items-start">
                <div className="flex gap-2">
                  <span className="bg-tertiary text-on-tertiary font-label text-[10px] px-2 py-1 rounded-full uppercase tracking-widest font-bold">Rank #{featured.rank}</span>
                  <span className="bg-secondary-container/20 text-secondary border border-secondary/30 font-label text-[10px] px-2 py-1 rounded-full uppercase tracking-widest">{featured.evolutionTier}</span>
                </div>
                <span className="w-10 h-10 rounded-full glass-panel ghost-border flex items-center justify-center text-on-surface">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">star</span>
                </span>
              </div>
              <div>
                <h3 className="font-headline text-[2.5rem] font-bold text-on-surface leading-tight mb-1">{featured.name}</h3>
                <p className="font-body text-on-surface-variant text-sm">{featured.title}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 border-t border-outline-variant/20 pt-6 mt-2">
                <div className="flex flex-col gap-1">
                  <span className="font-label text-xs text-on-surface-variant uppercase tracking-wider">Lifetime Yield</span>
                  <span className="font-headline text-2xl text-primary font-bold">{featured.lifetimeYieldLabel}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-label text-xs text-on-surface-variant uppercase tracking-wider">Win Rate</span>
                  <span className="font-headline text-2xl text-tertiary font-bold">{featured.winRate}%</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-label text-xs text-on-surface-variant uppercase tracking-wider">Evolution Tier</span>
                  <span className="font-headline text-2xl text-secondary font-bold">{featured.evolutionTier}</span>
                </div>
              </div>
            </div>
          </button>
        ) : null}

        {secondary ? (
          <button
            onClick={() => navigate(`/agent-detail?agentId=${secondary.id}`)}
            className="md:col-span-4 bg-surface-container-high rounded-xl p-6 flex flex-col justify-between ghost-border glow-shadow relative overflow-hidden cursor-pointer group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <div className="flex justify-between items-start mb-8 z-10">
              <span className="bg-surface text-on-surface font-label text-[10px] px-2 py-1 rounded-full border border-outline-variant/30 uppercase tracking-widest">Rank #{secondary.rank}</span>
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-secondary/20">
                <img alt={`${secondary.name} visual`} className="w-full h-full object-cover grayscale mix-blend-luminosity opacity-80 transition-transform duration-500 group-hover:scale-110" src={secondary.avatarUrl} />
              </div>
            </div>
            <div className="z-10">
              <h4 className="font-headline text-xl font-bold text-on-surface mb-1">{secondary.name}</h4>
              <p className="font-body text-xs text-on-surface-variant mb-6">{secondary.title}</p>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="font-label text-xs text-on-surface-variant uppercase">Yield</span>
                  <span className="font-label text-sm text-primary">{secondary.lifetimeYieldLabel}</span>
                </div>
                <div className="w-full bg-surface-container-lowest h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, secondary.alphaRate)}%` }} />
                </div>
                <div className="flex gap-2 pt-2">
                  {secondary.tags.map((tag) => (
                    <span key={tag} className="bg-secondary/10 text-secondary font-label text-[10px] px-2 py-0.5 rounded uppercase border border-secondary/20">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ) : null}

        <div className="md:col-span-6 bg-surface-container-low rounded-xl p-6 ghost-border">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl" aria-hidden="true">account_tree</span>
              Evolution Matrix
            </h3>
            <span className="font-label text-xs text-on-surface-variant uppercase">{featured?.name ?? "Top Agent"} Path</span>
          </div>
          <div className="relative py-4">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-outline-variant/30 -translate-x-1/2 z-0" />
            <div className="space-y-8 relative z-10">
              {[
                { left: "Base Protocol", right: "T-0", accent: "outline-variant" },
                { left: "Neural Mesh Integration", right: "T-14", accent: "primary" },
                { left: "Quantum Routing", right: `T-42 (${featured?.evolutionTier ?? "Apex"})`, accent: "tertiary" },
              ].map((step) => (
                <div key={step.left} className="flex items-center gap-4 w-full">
                  <div className="w-1/2 text-right pr-4">
                    <h5 className={`font-body text-sm font-semibold ${step.accent === "primary" ? "text-primary" : step.accent === "tertiary" ? "text-tertiary" : "text-on-surface"}`}>{step.left}</h5>
                  </div>
                  <div className={`w-4 h-4 rounded-full bg-surface border-2 ${step.accent === "primary" ? "border-primary shadow-[0_0_10px_rgba(164,230,255,0.3)]" : step.accent === "tertiary" ? "border-tertiary shadow-[0_0_15px_rgba(0,249,190,0.4)]" : "border-outline-variant"} relative flex-shrink-0 z-10`} />
                  <div className="w-1/2 pl-4">
                    <span className="font-label text-xs text-outline-variant">{step.right}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-6 grid grid-cols-2 gap-4">
          <div className="bg-surface-container-high rounded-xl p-5 flex flex-col justify-center ghost-border relative overflow-hidden group hover:bg-surface-container-highest transition-colors">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-symbols-outlined text-[100px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">hub</span>
            </div>
            <span className="material-symbols-outlined text-secondary mb-3" aria-hidden="true">hub</span>
            <h5 className="font-label text-xs text-on-surface-variant uppercase tracking-wider mb-1">Total Network Volume</h5>
            <div className="font-headline text-3xl font-bold text-on-surface">14.2B</div>
            <div className="font-body text-xs text-tertiary mt-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">trending_up</span> +12.4% this epoch
            </div>
          </div>
          <div className="bg-surface-container-high rounded-xl p-5 flex flex-col justify-center ghost-border relative overflow-hidden group hover:bg-surface-container-highest transition-colors">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-symbols-outlined text-[100px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">groups</span>
            </div>
            <span className="material-symbols-outlined text-primary mb-3" aria-hidden="true">groups</span>
            <h5 className="font-label text-xs text-on-surface-variant uppercase tracking-wider mb-1">Follower Syndicate</h5>
            <div className="font-headline text-3xl font-bold text-on-surface">{featured?.followerCount.toLocaleString() ?? "0"}</div>
            <div className="font-body text-xs text-tertiary mt-2">Live from the shared app layer</div>
          </div>
          <div className="col-span-2 bg-secondary-container/10 border-l-2 border-secondary rounded-r-xl p-5 flex items-center justify-between">
            <div>
              <h5 className="font-body text-sm font-semibold text-on-surface mb-1">Mint Commemorative NFT</h5>
              <p className="font-label text-xs text-on-surface-variant">Claim proof of watching the top-ranked agent evolve.</p>
            </div>
            <button className="bg-gradient-to-br from-[#a4e6ff] to-[#00d1ff] text-[#001f28] font-label text-sm px-4 py-2 rounded shadow-[inset_0_1px_1px_rgba(0,53,67,0.2)] hover:opacity-90 transition-opacity uppercase tracking-widest font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              Mint
            </button>
          </div>
        </div>

        {rest.map((agent) => (
          <button
            key={agent.id}
            onClick={() => navigate(`/agent-detail?agentId=${agent.id}`)}
            className="md:col-span-4 bg-surface-container-low rounded-xl p-6 border border-outline-variant/15 hover:border-primary/30 transition-colors text-left"
          >
            <div className="flex items-center gap-4">
              <img alt={`${agent.name} avatar`} className="w-14 h-14 rounded-lg object-cover border border-outline-variant/20" src={agent.avatarUrl} />
              <div>
                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Rank #{agent.rank}</p>
                <h4 className="font-headline text-lg font-bold text-on-surface">{agent.name}</h4>
                <p className="font-body text-xs text-on-surface-variant">{agent.title}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {showMintToast ? (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
            onClick={() => !minting && setShowMintToast(false)}
            aria-label="Close mint agent modal"
          />
          <div className="relative w-full max-w-md max-h-[90vh] bg-surface-container-low rounded-2xl border border-outline-variant/20 shadow-2xl overflow-y-auto animate-in slide-in-from-bottom-8 md:slide-in-from-center duration-300">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-2xl" aria-hidden="true">smart_toy</span>
                  </div>
                  <div>
                    <h3 className="font-headline text-xl font-bold text-on-surface">Mint Agent</h3>
                    <p className="font-body text-xs text-on-surface-variant uppercase tracking-widest">Agent Inventory</p>
                  </div>
                </div>
                <button disabled={minting} onClick={() => setShowMintToast(false)} className="text-on-surface-variant hover:text-on-surface transition-colors h-10 w-10 rounded-lg flex items-center justify-center disabled:opacity-50">
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label htmlFor="mint-agent-name" className="block font-label text-sm text-on-surface-variant mb-2">Agent Name</label>
                  <input
                    id="mint-agent-name"
                    type="text"
                    placeholder="New Swarm Agent"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 px-3 text-on-surface font-body text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                    disabled={minting}
                  />
                </div>
                <div>
                  <label htmlFor="mint-agent-role" className="block font-label text-sm text-on-surface-variant mb-2">Role</label>
                  <input
                    id="mint-agent-role"
                    type="text"
                    value={agentRole}
                    onChange={(e) => setAgentRole(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 px-3 text-on-surface font-body text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                    disabled={minting}
                  />
                </div>
                <div>
                  <label htmlFor="mint-agent-description" className="block font-label text-sm text-on-surface-variant mb-2">Description</label>
                  <textarea
                    id="mint-agent-description"
                    value={agentDescription}
                    onChange={(e) => setAgentDescription(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 text-on-surface font-body text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all resize-none h-24"
                    disabled={minting}
                  />
                </div>
                <div className="rounded-xl border border-outline-variant/20 bg-surface-container-high/40 p-3 space-y-3">
                  <div>
                    <h4 className="font-label text-xs uppercase tracking-widest text-primary">Intelligence Source</h4>
                    <p className="font-body text-xs text-on-surface-variant mt-1">
                      Bind the minted agent to BYOK inference now. You can change this later in Agent Editor.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="mint-agent-provider" className="block font-label text-sm text-on-surface-variant mb-2">Provider</label>
                    <select
                      id="mint-agent-provider"
                      value={intelligenceProvider}
                      onChange={(event) => {
                        const next = intelligenceSources.find((source) => source.value === event.target.value) ?? intelligenceSources[0];
                        setIntelligenceProvider(next.value);
                        setIntelligenceModel(next.model);
                        setIntelligenceApiKey("");
                        setIntelligenceEndpoint("");
                      }}
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 px-3 text-on-surface font-body text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                      disabled={minting}
                    >
                      {intelligenceSources.map((source) => (
                        <option key={source.value} value={source.value}>{source.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="mint-agent-model" className="block font-label text-sm text-on-surface-variant mb-2">Model</label>
                    <input
                      id="mint-agent-model"
                      type="text"
                      value={intelligenceModel}
                      onChange={(e) => setIntelligenceModel(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 px-3 text-on-surface font-body text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                      disabled={minting}
                    />
                  </div>
                  {intelligenceSources.find((source) => source.value === intelligenceProvider)?.needsEndpoint ? (
                    <div>
                      <label htmlFor="mint-agent-endpoint" className="block font-label text-sm text-on-surface-variant mb-2">HTTPS Endpoint</label>
                      <input
                        id="mint-agent-endpoint"
                        type="url"
                        value={intelligenceEndpoint}
                        onChange={(e) => setIntelligenceEndpoint(e.target.value)}
                        placeholder="https://api.example.com/v1/chat/completions"
                        className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 px-3 text-on-surface font-body text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                        disabled={minting}
                      />
                    </div>
                  ) : null}
                  {intelligenceSources.find((source) => source.value === intelligenceProvider)?.needsKey ? (
                    <div>
                      <label htmlFor="mint-agent-api-key" className="block font-label text-sm text-on-surface-variant mb-2">BYOK API Key</label>
                      <input
                        id="mint-agent-api-key"
                        type="password"
                        autoComplete="off"
                        value={intelligenceApiKey}
                        onChange={(e) => setIntelligenceApiKey(e.target.value)}
                        placeholder="Stored encrypted on the gateway"
                        className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 px-3 text-on-surface font-body text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                        disabled={minting}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {mintMessage?.type === "error" ? (
                <div className="mb-6 rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
                  {mintMessage.text}
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowMintToast(false)}
                  disabled={minting}
                  className="flex-1 py-3 rounded-xl border border-outline-variant/20 text-on-surface font-label font-bold hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleMint()}
                  disabled={minting}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary font-label font-bold hover:shadow-[0_0_15px_rgba(164,230,255,0.4)] transition-all disabled:opacity-50 disabled:hover:shadow-none flex items-center justify-center gap-2"
                >
                  {minting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm" aria-hidden="true">progress_activity</span>
                      Minting...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">add_circle</span>
                      Mint Agent
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
