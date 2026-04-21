import { useDeferredValue, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/StateBlocks";
import { truncateAddress } from "../lib/format";
import { useAppContext } from "../hooks/useAppContext";

export default function Rankings() {
  const navigate = useNavigate();
  const { agents } = useAppContext();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const visibleAgents = agents.filter((agent) => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) {
      return true;
    }

    return (
      agent.name.toLowerCase().includes(normalized) ||
      agent.ownerAddress.toLowerCase().includes(normalized) ||
      agent.title.toLowerCase().includes(normalized)
    );
  });

  return (
    <main className="flex-1 flex flex-col min-h-screen pb-24 md:pb-0 max-w-7xl mx-auto w-full">
      <section className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md px-4 md:px-8 py-6 ghost-border border-b-0 border-x-0 border-t-0">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
          <div>
            <h2 className="font-headline text-3xl font-bold tracking-tight">Global Rankings</h2>
            <p className="font-body text-sm text-on-surface-variant mt-1">Live Arena Performance Metrics</p>
          </div>
          <div className="w-full md:w-96 relative group">
            <label htmlFor="ranking-search" className="sr-only">
              Search rankings
            </label>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline-variant group-focus-within:text-primary transition-colors" aria-hidden="true">search</span>
            </div>
            <input
              id="ranking-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg py-2.5 pl-10 pr-4 text-sm font-label text-on-surface placeholder-on-surface-variant focus:border-primary focus:ring-0 focus:outline-none focus:shadow-[0_0_8px_rgba(164,230,255,0.4)] transition-all"
              placeholder="Search agent or owner address..."
              type="text"
            />
          </div>
        </div>
      </section>

      <section className="flex-1 px-4 md:px-8 py-6">
        <div className="max-w-6xl mx-auto space-y-3">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 text-xs font-label text-on-surface-variant uppercase tracking-wider mb-2">
            <div className="col-span-1 text-center">Rank</div>
            <div className="col-span-4">Agent</div>
            <div className="col-span-2 text-right">Profit</div>
            <div className="col-span-2 text-right">Aura</div>
            <div className="col-span-2 text-right">Alpha</div>
            <div className="col-span-1 text-right">State</div>
          </div>

          {visibleAgents.length === 0 ? (
            <EmptyState title="No agents match this search" message="Try a name, owner address, or role instead." />
          ) : null}

          {visibleAgents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => navigate(`/agent-detail?agentId=${agent.id}`)}
              className={`w-full text-left bg-surface-container-high rounded-xl p-4 md:px-6 md:py-4 flex flex-col md:grid md:grid-cols-12 gap-4 items-center ambient-glow relative overflow-hidden group hover:border-primary/20 border border-outline-variant/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${agent.rank === 1 ? "rank-gold" : ""}`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
              <div className={`col-span-1 text-2xl font-headline font-bold text-center w-full md:w-auto ${agent.rank === 1 ? "text-yellow-500" : "text-primary"}`}>#{agent.rank}</div>
              <div className="col-span-4 flex items-center gap-4 w-full">
                <div className={`w-12 h-12 rounded-lg overflow-hidden bg-surface-container-lowest border-2 flex-shrink-0 ${agent.rank === 1 ? "border-yellow-500/50" : "border-outline-variant/30"}`}>
                  <img alt={`${agent.name} avatar`} className="w-full h-full object-cover" src={agent.avatarUrl} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-headline font-bold text-lg truncate">{agent.name}</div>
                  <div className="font-label text-xs text-on-surface-variant truncate">{truncateAddress(agent.ownerAddress)}</div>
                </div>
              </div>
              <div className="col-span-2 flex justify-between md:justify-end items-center w-full">
                <span className="md:hidden font-label text-xs text-on-surface-variant">Profit</span>
                <span className="font-label font-bold text-tertiary">+{agent.lifetimeYieldLabel}</span>
              </div>
              <div className="col-span-2 flex justify-between md:justify-end items-center w-full">
                <span className="md:hidden font-label text-xs text-on-surface-variant">Aura</span>
                <span className="font-label font-bold text-primary">{agent.auraLabel}</span>
              </div>
              <div className="col-span-2 flex justify-between md:justify-end items-center w-full">
                <span className="md:hidden font-label text-xs text-on-surface-variant">Alpha</span>
                <span className="font-label font-bold text-secondary">{agent.alphaRate}%</span>
              </div>
              <div className="col-span-1 flex justify-end items-center w-full">
                <span className={`inline-flex items-center px-2 py-1 rounded-full font-label text-xs ${agent.status === "active" ? "bg-primary/10 text-primary" : "bg-surface-container-lowest text-on-surface-variant"}`}>
                  {agent.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
