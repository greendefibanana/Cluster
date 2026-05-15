import { Link } from 'react-router-dom';
import { demoWidgets, formatCompact, formatCurrency, formatPercent } from '../lib/farcaster';

const totalTvl = demoWidgets.reduce((sum, item) => sum + item.metrics.tvl, 0);
const totalActors = demoWidgets.reduce((sum, item) => sum + item.metrics.investors + item.metrics.suppliers, 0);
const averageBridge = demoWidgets.reduce((sum, item) => sum + item.metrics.alphaBridge, 0) / demoWidgets.length;
const activeProofs = demoWidgets.filter((item) => item.strategy.validationStatus === 'valid').length;

const menuItems = [
  { label: 'Dashboard', icon: 'dashboard', to: '/mini', active: true },
  { label: 'Agents', icon: 'smart_toy', to: '/agents' },
  { label: 'Clusters', icon: 'hub', to: '/swarm-wars' },
  { label: 'Strategies', icon: 'query_stats', to: '/feed' },
  { label: 'Sovereign', icon: 'account_balance_wallet', to: '/sovereign-accounts' },
  { label: 'Proofs', icon: 'verified', to: '/proof-viewer' },
];

export default function MiniApp() {
  return (
    <main className="min-h-screen bg-background text-on-surface">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-0 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-outline-variant/20 bg-surface-container-low px-4 py-4 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex items-center justify-between gap-3 lg:block">
            <Link to="/mini" className="inline-flex min-h-10 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <span className="grid size-10 place-items-center rounded-lg bg-gradient-primary text-on-primary" aria-hidden="true">
                <span className="material-symbols-outlined text-xl">conversion_path</span>
              </span>
              <span>
                <span className="block font-headline text-base font-semibold">ClusterFi</span>
                <span className="block font-body text-xs text-on-surface-variant">Mini App</span>
              </span>
            </Link>
            <Link
              to="/feed"
              className="inline-flex min-h-10 items-center rounded-lg border border-outline-variant/20 px-3 py-2 font-label text-xs text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
            >
              Feed
            </Link>
          </div>

          <nav className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-1" aria-label="Mini App navigation">
            {menuItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 font-label text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:justify-start lg:text-sm ${item.active ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <section className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <header className="flex flex-col gap-4 border-b border-outline-variant/20 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-label text-xs uppercase tracking-widest text-primary">Command dashboard</p>
              <h1 className="mt-2 font-headline text-3xl font-semibold md:text-4xl">Autonomous finance desk</h1>
              <p className="mt-2 max-w-prose font-body text-sm leading-6 text-on-surface-variant">
                Track agent strategies, proofs, reputation, and Sovereign Account readiness from one Mini App home.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/sovereign-accounts"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gradient-primary px-4 py-2 font-headline text-sm font-semibold text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">account_balance</span>
                Sovereign Account
              </Link>
              <Link
                to="/feed"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant/20 px-4 py-2 font-headline text-sm font-semibold text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">dynamic_feed</span>
                Strategy Feed
              </Link>
            </div>
          </header>

          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Mini App metrics">
            <MetricTile icon="account_balance" label="Total TVL" value={formatCurrency(totalTvl)} />
            <MetricTile icon="groups" label="Investors / suppliers" value={formatCompact(totalActors)} />
            <MetricTile icon="bolt" label="Alpha Bridge" value={`${averageBridge.toFixed(1)}x`} />
            <MetricTile icon="verified" label="Valid proofs" value={`${activeProofs}/${demoWidgets.length}`} />
          </section>

          <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-headline text-lg font-semibold">Active strategies</h2>
                  <p className="mt-1 font-body text-sm text-on-surface-variant">Deep links from Farcaster land on full strategy profiles.</p>
                </div>
                <Link to="/feed" className="inline-flex min-h-10 items-center rounded-lg px-3 py-2 font-label text-xs text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                  View all
                </Link>
              </div>

              <div className="mt-4 divide-y divide-outline-variant/20">
                {demoWidgets.map((item) => (
                  <Link
                    key={item.feedEventId}
                    to={item.action.url}
                    className="grid min-h-20 gap-3 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background md:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-surface-container-high px-2 py-1 font-label text-xs uppercase text-primary">{item.type}</span>
                        <span className="font-body text-xs text-on-surface-variant">{item.strategy.chain} / {item.strategy.protocol}</span>
                      </div>
                      <h3 className="mt-2 font-headline text-base font-semibold">{item.strategy.name}</h3>
                      <p className="mt-1 line-clamp-2 font-body text-sm text-on-surface-variant">{item.description}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-left md:min-w-72">
                      <SmallStat label="TVL" value={formatCurrency(item.metrics.tvl)} />
                      <SmallStat label="Return" value={formatPercent(item.metrics.returnPercent)} />
                      <SmallStat label="Risk" value={`${item.strategy.riskScore}/100`} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <section className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
                <h2 className="font-headline text-lg font-semibold">Proof status</h2>
                <div className="mt-4 space-y-3">
                  {demoWidgets.map((item) => (
                    <Link
                      key={item.strategy.id}
                      to={`/proof-viewer?uri=${encodeURIComponent(item.strategy.proofURI)}`}
                      className="flex min-h-12 items-center justify-between gap-3 rounded-lg bg-surface-container-lowest px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <span className="truncate font-body text-sm">{item.strategy.name}</span>
                      <span className="font-label text-xs uppercase text-primary">{item.strategy.validationStatus}</span>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
                <h2 className="font-headline text-lg font-semibold">Farcaster entry points</h2>
                <p className="mt-2 font-body text-sm leading-6 text-on-surface-variant">
                  Feed cards use preview images and an Enter Strategy action. The Mini App home remains this dashboard.
                </p>
                <div className="mt-4 grid gap-2">
                  <Link to="/mini/feed/feed-prediction-alpha-7" className="inline-flex min-h-10 items-center justify-between rounded-lg border border-outline-variant/20 px-3 py-2 font-body text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                    Prediction feed card
                    <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_forward</span>
                  </Link>
                  <Link to="/mini/feed/feed-yield-vault-9" className="inline-flex min-h-10 items-center justify-between rounded-lg border border-outline-variant/20 px-3 py-2 font-body text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                    Yield feed card
                    <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_forward</span>
                  </Link>
                </div>
              </section>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function MetricTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-label text-xs uppercase tracking-wider text-on-surface-variant">{label}</span>
        <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">{icon}</span>
      </div>
      <p className="mt-3 font-headline text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-container-lowest p-3">
      <p className="font-label text-[11px] uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="mt-1 font-headline text-sm font-semibold">{value}</p>
    </div>
  );
}
