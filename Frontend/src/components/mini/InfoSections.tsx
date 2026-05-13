import type { ClusterFiWidgetData, StrategyProof, TxHistoryItem } from '../../lib/farcaster';
import { formatCompact, formatCurrency, formatPercent } from '../../lib/farcaster';

export function MetricsGrid({ data }: { data: ClusterFiWidgetData }) {
  const metrics = [
    ['TVL', formatCurrency(data.metrics.tvl), 'account_balance'],
    [data.type === 'prediction' || data.type === 'meme' ? 'Investors' : 'Suppliers', formatCompact(data.type === 'prediction' || data.type === 'meme' ? data.metrics.investors : data.metrics.suppliers), 'group'],
    ['Alpha Bridge', `${data.metrics.alphaBridge.toFixed(1)}x`, 'bolt'],
    ['Risk', `${data.strategy.riskScore}/100`, 'shield'],
    ['PnL', formatCurrency(data.metrics.pnl), 'show_chart'],
    ['Return/APY', formatPercent(data.metrics.apy ?? data.metrics.returnPercent), 'trending_up'],
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Strategy metrics">
      {metrics.map(([label, value, icon]) => (
        <div key={label} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
          <span className="material-symbols-outlined text-primary text-xl" aria-hidden="true">{icon}</span>
          <p className="mt-3 font-label text-xs uppercase tracking-widest text-on-surface-variant">{label}</p>
          <p className="mt-1 font-headline text-xl font-semibold text-on-surface">{value}</p>
        </div>
      ))}
    </section>
  );
}

export function TxHistorySection({ items }: { items: TxHistoryItem[] }) {
  return (
    <section className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
      <h2 className="font-headline text-lg font-semibold text-on-surface">Transaction History</h2>
      <div className="mt-4 space-y-3">
        {items.length ? items.map((tx) => (
          <article key={tx.hash} className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-label text-sm text-primary">{tx.type.replaceAll('_', ' ')}</p>
              <span className="font-label text-xs uppercase tracking-widest text-tertiary">{tx.status}</span>
            </div>
            <p className="mt-2 font-body text-sm text-on-surface-variant">{tx.summary}</p>
            <p className="mt-2 break-all font-mono text-xs text-outline">{tx.hash} · {tx.chain}</p>
          </article>
        )) : <p className="font-body text-sm text-on-surface-variant">No transactions yet.</p>}
      </div>
    </section>
  );
}

export function ProofSection({ proofs }: { proofs: StrategyProof[] }) {
  return (
    <section className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
      <h2 className="font-headline text-lg font-semibold text-on-surface">Proofs & Validation</h2>
      <div className="mt-4 space-y-3">
        {proofs.length ? proofs.map((proof) => (
          <article key={proof.proofURI} className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-label text-xs uppercase tracking-widest text-primary">{proof.source} {proof.type}</span>
              <span className="rounded-full bg-tertiary/10 px-3 py-1 font-label text-xs text-tertiary">{proof.validationStatus}</span>
            </div>
            <p className="mt-3 break-all font-mono text-xs text-on-surface-variant">{proof.proofURI}</p>
          </article>
        )) : <p className="font-body text-sm text-on-surface-variant">No proofs attached yet.</p>}
      </div>
    </section>
  );
}

export function SovereignActionPanel({ data }: { data: ClusterFiWidgetData }) {
  const actions = ['Open Sovereign Account', 'Enter Strategy', 'View Permissions', 'Revoke', 'Exit'];
  return (
    <section className="rounded-lg border border-primary/20 bg-primary/5 p-5">
      <h2 className="font-headline text-lg font-semibold text-on-surface">Sovereign Account Entry</h2>
      <p className="mt-2 font-body text-sm leading-6 text-on-surface-variant">
        Feed clicks open details first. Funds stay in user-owned Sovereign Accounts; agents receive limited, revocable permissions only.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {actions.map((action, index) => (
          <button
            key={action}
            type="button"
            className={`min-h-10 rounded-lg px-4 py-2 font-headline text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${index === 1 ? 'bg-gradient-primary text-on-primary' : 'border border-outline-variant/20 bg-surface-container-low text-on-surface hover:border-primary/40'}`}
          >
            {action}
          </button>
        ))}
      </div>
      <p className="mt-4 font-label text-xs uppercase tracking-widest text-outline">Strategy: {data.strategy.name}</p>
    </section>
  );
}
