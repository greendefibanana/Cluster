import { SectionSkeleton } from "../components/StateBlocks";
import { formatRelativeTime } from "../lib/format";
import { useAppContext } from "../hooks/useAppContext";

export default function Overview() {
  const { overview, appStatus } = useAppContext();

  return (
    <main className="flex-grow pt-24 pb-28 md:pb-12 px-4 md:px-8 max-w-7xl mx-auto w-full flex flex-col gap-8 md:flex-row md:items-start relative z-10">
      {appStatus === "loading" ? (
        <div className="w-full">
          <SectionSkeleton rows={5} />
        </div>
      ) : null}

      <div className="flex-grow flex flex-col gap-8 w-full md:w-3/4">
        <section className="bg-surface-container-low rounded-xl p-8 relative overflow-hidden group">
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <h2 className="text-on-surface-variant font-body text-sm font-medium tracking-wide mb-2 uppercase">
                Total Value Locked (TVL)
              </h2>
              <div className="flex flex-col gap-1">
                <span className="text-primary font-headline text-5xl md:text-6xl font-bold tracking-tighter drop-shadow-[0_0_12px_rgba(164,230,255,0.3)]">
                  {overview.tvlLabel}
                </span>
                <span className="text-tertiary font-label text-lg flex items-center gap-2 mt-2">
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_upward</span>
                  {overview.tvlTokenLabel}
                  <span className="text-on-surface-variant/50 text-sm ml-2">{overview.tvlDeltaLabel}</span>
                </span>
              </div>
            </div>
            <div className="flex gap-4 w-full md:w-auto mt-4 md:mt-0">
              <button className="kinetic-gradient text-on-primary font-body font-semibold px-6 py-3 rounded-lg w-full md:w-auto shadow-[0_4px_20px_-4px_rgba(164,230,255,0.4)] hover:shadow-[0_4px_25px_-4px_rgba(164,230,255,0.6)] transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                Deposit Funds
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          <div className="glass-panel ghost-border rounded-xl p-6 relative overflow-hidden col-span-1 md:col-span-2">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-container/20 blur-3xl rounded-full" />
            <h3 className="text-on-surface font-headline text-xl font-semibold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary" aria-hidden="true">memory</span>
              x402 Agent Earnings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2 bg-surface-container-lowest p-4 rounded-lg ghost-border">
                <span className="text-on-surface-variant font-body text-xs uppercase tracking-wider">Total Generated</span>
                <span className="text-secondary font-label text-2xl font-bold">{overview.totalGeneratedLabel}</span>
              </div>
              <div className="flex flex-col gap-2 bg-surface-container-lowest p-4 rounded-lg ghost-border border-l-2 border-l-tertiary">
                <span className="text-on-surface-variant font-body text-xs uppercase tracking-wider">Owner Split (70%)</span>
                <span className="text-tertiary font-label text-2xl font-bold">{overview.ownerSplitLabel}</span>
              </div>
              <div className="flex flex-col gap-2 bg-surface-container-lowest p-4 rounded-lg ghost-border border-l-2 border-l-primary">
                <span className="text-on-surface-variant font-body text-xs uppercase tracking-wider">Agent Pool (30%)</span>
                <span className="text-primary font-label text-2xl font-bold">{overview.agentPoolLabel}</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-high rounded-xl p-6 ghost-border flex flex-col justify-between min-h-[160px]">
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-on-surface-variant font-body text-sm font-medium">24h Growth</h4>
              <span className="text-tertiary font-label text-sm bg-tertiary/10 px-2 py-1 rounded-full">+4.2%</span>
            </div>
            <div className="w-full h-16 bg-surface-container-lowest rounded-md relative overflow-hidden flex items-end">
              <div className="w-full h-full bg-gradient-to-t from-primary/20 to-transparent absolute bottom-0" />
              {overview.growth24h.map((point, index) => (
                <div key={`growth24-${index}`} className="w-1/4 bg-primary/60 rounded-t-sm mx-[1px]" style={{ height: `${point}%` }} />
              ))}
            </div>
          </div>

          <div className="bg-surface-container-high rounded-xl p-6 ghost-border flex flex-col justify-between min-h-[160px]">
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-on-surface-variant font-body text-sm font-medium">7d Trajectory</h4>
              <span className="text-tertiary font-label text-sm bg-tertiary/10 px-2 py-1 rounded-full">+12.8%</span>
            </div>
            <div className="w-full h-16 bg-surface-container-lowest rounded-md relative overflow-hidden flex items-end">
              <div className="w-full h-full bg-gradient-to-t from-secondary/20 to-transparent absolute bottom-0" />
              {overview.growth7d.map((point, index) => (
                <div key={`growth7-${index}`} className="w-1/5 bg-secondary/70 rounded-t-sm mx-[1px]" style={{ height: `${point}%` }} />
              ))}
            </div>
          </div>
        </section>
      </div>

      <aside className="w-full md:w-1/4 bg-surface-container-low rounded-xl p-6 flex flex-col gap-6">
        <h3 className="text-on-surface font-headline text-lg font-medium border-b border-outline-variant/20 pb-4">Recent Tx Logs</h3>
        <div className="flex flex-col gap-4">
          {overview.recentLogs.map((log) => (
            <div key={log.id} className="flex items-center gap-3 bg-surface-container-highest p-3 rounded-lg">
              <div className={`p-2 rounded-full flex-shrink-0 ${log.kind === "deposit" ? "bg-tertiary/10" : log.kind === "rebalance" ? "bg-primary/10" : "bg-secondary/10"}`}>
                <span className={`material-symbols-outlined text-sm ${log.kind === "deposit" ? "text-tertiary" : log.kind === "rebalance" ? "text-primary" : "text-secondary"}`} style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                  {log.kind === "deposit" ? "arrow_downward" : log.kind === "rebalance" ? "sync" : "memory"}
                </span>
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-on-surface font-body text-sm truncate">{log.title}</span>
                <span className="text-on-surface-variant font-label text-xs">{formatRelativeTime(log.createdAt)}</span>
              </div>
              {log.valueLabel ? <span className="ml-auto text-tertiary font-label text-sm">{log.valueLabel}</span> : null}
            </div>
          ))}
        </div>
        <button className="mt-auto w-full py-2 text-center text-primary hover:text-primary-container font-body text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg">
          View All Logs
        </button>
      </aside>
    </main>
  );
}
