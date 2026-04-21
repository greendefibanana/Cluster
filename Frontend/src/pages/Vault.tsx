import { useState } from "react";
import { copyToClipboard, truncateAddress } from "../lib/format";
import { useAppContext } from "../hooks/useAppContext";

export default function Vault() {
  const { agents } = useAppContext();
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? "");
  const agent = agents.find((item) => item.id === selectedAgentId) ?? agents[0];

  if (!agent) {
    return null;
  }

  const tokenAssets = agent.vaultAssets.filter((asset) => asset.kind === "token");
  const nftAssets = agent.vaultAssets.filter((asset) => asset.kind === "nft");

  return (
    <main className="flex-1 pt-8 pb-24 md:pb-8 px-4 md:px-8 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl text-primary font-bold tracking-tight">TBA Explorer</h1>
          <p className="font-body text-on-surface-variant mt-2 max-w-lg">Inspect internal assets autonomously acquired by Swarm Agents within their ERC-6551 Token Bound Accounts.</p>
        </div>
        <div className="relative w-full md:w-64 glass-panel rounded-lg ghost-border p-1">
          <label htmlFor="vault-agent" className="sr-only">
            Select agent
          </label>
          <select
            id="vault-agent"
            value={agent.id}
            onChange={(event) => setSelectedAgentId(event.target.value)}
            className="w-full bg-surface-container-lowest px-4 py-3 rounded border border-outline-variant/20 font-label font-medium text-sm text-on-surface focus:border-primary focus:ring-0"
          >
            {agents.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} [{item.status}]
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container-low rounded-xl p-6 ghost-border relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center ghost-border shadow-[0_0_15px_rgba(164,230,255,0.1)]">
                  <span className="material-symbols-outlined text-primary text-[28px]" aria-hidden="true">smart_toy</span>
                </div>
                <div>
                  <h2 className="font-headline font-bold text-xl text-on-surface">{agent.name}</h2>
                  <p className="font-label text-xs text-[#e8b3ff]">ID: #{agent.id}</p>
                </div>
              </div>
              <span className="px-2 py-1 bg-tertiary/10 text-tertiary font-label text-[10px] uppercase rounded-full border border-tertiary/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                {agent.status}
              </span>
            </div>
            <div className="space-y-4">
              <div>
                <p className="font-body text-xs text-on-surface-variant mb-1">TBA Address (ERC-6551)</p>
                <button
                  onClick={() => void copyToClipboard(agent.tbaAddress)}
                  className="w-full flex items-center justify-between bg-surface-container-lowest p-2.5 rounded border border-outline-variant/20 font-label text-xs text-[#4cd6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span className="truncate">{truncateAddress(agent.tbaAddress, 6)}</span>
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">content_copy</span>
                </button>
              </div>
              <div>
                <p className="font-body text-xs text-on-surface-variant mb-1">Total Vault Value</p>
                <h3 className="font-headline text-3xl font-bold text-on-surface tracking-tight">$14,204.50</h3>
              </div>
              <div className="pt-4 border-t border-outline-variant/10">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-body text-on-surface-variant">Autonomy Level</span>
                  <span className="font-label text-secondary">Level {Math.max(1, Math.floor(agent.score / 20))} (High)</span>
                </div>
                <div className="w-full bg-surface-container-highest rounded-full h-1.5 mt-2">
                  <div className="bg-secondary h-1.5 rounded-full shadow-[0_0_8px_rgba(232,179,255,0.5)]" style={{ width: `${Math.min(agent.score, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-secondary-container/10 border-l-2 border-secondary rounded-r-xl p-5 relative overflow-hidden">
            <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-[80px] text-secondary/5 rotate-12 pointer-events-none" aria-hidden="true">psychology</span>
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-secondary text-[18px]" aria-hidden="true">auto_awesome</span>
              <h3 className="font-headline font-semibold text-sm text-secondary">Agent Intel</h3>
            </div>
            <p className="font-body text-sm text-on-surface/80 leading-relaxed">
              {agent.name} is currently running {agent.skills.filter((skill) => skill.equipped).length} equipped modules and maintaining a {agent.winRate}% win rate across its recent execution history.
            </p>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-outline-variant/10 pb-4">
            <h2 className="font-headline text-lg font-medium text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4cd6ff]" aria-hidden="true">account_balance_wallet</span>
              Internal Assets
            </h2>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 bg-surface-container-high rounded font-label text-xs text-on-surface hover:text-primary transition-colors border border-outline-variant/20">All</button>
              <button className="px-3 py-1.5 bg-surface-container-lowest rounded font-label text-xs text-on-surface-variant hover:text-primary transition-colors border border-transparent">Tokens</button>
              <button className="px-3 py-1.5 bg-surface-container-lowest rounded font-label text-xs text-on-surface-variant hover:text-primary transition-colors border border-transparent">NFTs</button>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl ghost-border overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-lowest/50">
              <h3 className="font-headline text-sm font-medium text-on-surface-variant">Liquid Tokens</h3>
            </div>
            <div className="flex flex-col">
              {tokenAssets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between p-4 hover:bg-surface-container-highest/30 transition-colors border-b last:border-b-0 border-outline-variant/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center border" style={{ borderColor: `${asset.accent}55`, backgroundColor: `${asset.accent}11` }}>
                      <span className="font-headline font-bold text-xs" style={{ color: asset.accent }}>{asset.symbol}</span>
                    </div>
                    <div>
                      <h4 className="font-headline font-medium text-on-surface text-sm">{asset.name}</h4>
                      <p className="font-label text-xs text-on-surface-variant">{asset.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-label font-medium text-on-surface">{asset.amountLabel}</p>
                    <p className="font-body text-xs text-on-surface-variant">{asset.usdValueLabel}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <h3 className="font-headline text-sm font-medium text-on-surface-variant mb-4 px-2">Skill Modules & Artifacts (NFTs)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {nftAssets.map((asset) => (
                <div key={asset.id} className="glass-panel p-4 rounded-xl ghost-border flex items-start gap-4 hover:border-secondary/30 transition-colors group">
                  <div className="w-16 h-16 rounded-lg bg-surface-container-lowest overflow-hidden flex-shrink-0 relative">
                    <img alt={asset.name} className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-500" src={agent.avatarUrl} />
                    <div className="absolute inset-0 border border-white/10 rounded-lg pointer-events-none" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-headline text-sm font-semibold text-primary">{asset.name}</h4>
                      <span className="text-[10px] font-label text-outline bg-surface px-1.5 py-0.5 rounded border border-outline-variant/20">{asset.symbol}</span>
                    </div>
                    <p className="font-body text-xs text-on-surface-variant line-clamp-2 mb-2">{asset.description}</p>
                    <div className="flex items-center gap-1 text-[10px] font-label text-[#4cd6ff]">
                      <span className="material-symbols-outlined text-[12px]" aria-hidden="true">verified</span>
                      <span>{asset.usdValueLabel}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
