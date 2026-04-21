import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../hooks/useAppContext";
import { mintNewAgent } from "../lib/web3";

export default function Agents() {
  const navigate = useNavigate();
  const { agents, wallet, refreshApp } = useAppContext();
  const [featured, secondary, ...rest] = [...agents].sort((a, b) => a.rank - b.rank);
  const [minting, setMinting] = useState(false);
  const [agentName, setAgentName] = useState("");

  // Filter agents owned by the current user
  const myAgents = agents.filter(a => a.ownerAddress.toLowerCase() === wallet.account?.toLowerCase());

  const handleMint = async () => {
    if (!wallet.account) {
      alert("Please connect wallet first");
      return;
    }
    const finalName = agentName.trim() || "New Swarm Agent";
    setMinting(true);
    try {
      await mintNewAgent(wallet.account, finalName, "Operative", "Freshly minted operative agent.");
      alert("Agent minted successfully!");
      setAgentName("");
      await refreshApp();
    } catch (e: any) {
      alert("Mint failed: " + e.message);
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
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Agent Name..."
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50"
              disabled={minting}
            />
            <button 
              onClick={handleMint}
              disabled={minting}
              className="flex items-center gap-2 bg-primary text-on-primary font-bold px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              <span className="material-symbols-outlined">add_circle</span>
              {minting ? "Minting..." : "Mint Agent"}
            </button>
          </div>
        </div>
      </div>

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
    </main>
  );
}
