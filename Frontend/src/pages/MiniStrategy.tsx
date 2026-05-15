import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ClusterFiFeedWidget } from '../components/widgets/ClusterFiFeedWidget';
import { MetricsGrid, ProofSection, SovereignActionPanel, TxHistorySection } from '../components/mini/InfoSections';
import { demoWidgets, fetchMiniProfile, fetchMiniStrategy, fetchWidgetData, type ClusterFiWidgetData, type StrategyProof, type TxHistoryItem } from '../lib/farcaster';
import { appEnv } from '../lib/env';

type LoadState = 'loading' | 'ready' | 'error';

export default function MiniStrategy({ mode }: { mode: 'agent' | 'cluster' | 'strategy' | 'widget' | 'feed' }) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [widget, setWidget] = useState<ClusterFiWidgetData | null>(null);
  const [txHistory, setTxHistory] = useState<TxHistoryItem[]>([]);
  const [proofs, setProofs] = useState<StrategyProof[]>([]);
  const [profile, setProfile] = useState<any>(null);

  const target = useMemo(() => ({
    feedEventId: params.feedEventId,
    strategyId: searchParams.get('strategy') || params.strategyId,
    agentId: params.agentId,
    clusterId: params.clusterId,
  }), [params, searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState('loading');
      setError('');
      try {
        let resolvedWidget: ClusterFiWidgetData | null = null;
        let resolvedTxHistory: TxHistoryItem[] = [];
        let resolvedProofs: StrategyProof[] = [];
        if ((mode === 'widget' || mode === 'feed') && target.feedEventId) {
          resolvedWidget = await fetchWidgetData(target.feedEventId);
        } else if (target.strategyId) {
          const payload = await fetchMiniStrategy(target.strategyId);
          resolvedWidget = payload.widget;
          resolvedTxHistory = payload.txHistory;
          resolvedProofs = payload.proofs;
        } else if (target.agentId) {
          const payload = await fetchMiniProfile('agent', target.agentId);
          resolvedWidget = payload.strategies[0];
          setProfile(payload.agent);
          resolvedTxHistory = payload.txHistory;
        } else if (target.clusterId) {
          const payload = await fetchMiniProfile('cluster', target.clusterId);
          resolvedWidget = payload.strategies[0];
          setProfile(payload.cluster);
          resolvedTxHistory = payload.txHistory;
        }
        if (!resolvedWidget && appEnv.demoMode) resolvedWidget = demoWidgets[0];
        if (!resolvedWidget) throw new Error('Strategy not found');
        if (!resolvedProofs.length && resolvedWidget.strategy.proofURI) {
          resolvedProofs = [{ proofURI: resolvedWidget.strategy.proofURI, source: '0G', type: 'strategy-proof', timestamp: resolvedWidget.timestamps.updatedAt, validationStatus: resolvedWidget.strategy.validationStatus }];
        }
        if (!cancelled) {
          setWidget(resolvedWidget);
          setTxHistory(resolvedTxHistory);
          setProofs(resolvedProofs);
          setState('ready');
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Could not load Mini App strategy');
          setState('error');
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [mode, target]);

  if (state === 'loading') {
    return (
      <main className="min-h-screen bg-background px-4 py-6">
        <div className="mx-auto max-w-5xl animate-pulse space-y-4">
          <div className="h-52 rounded-lg bg-surface-container-low" />
          <div className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 rounded-lg bg-surface-container-low" />)}</div>
        </div>
      </main>
    );
  }

  if (state === 'error' || !widget) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 py-6">
        <section className="max-w-md rounded-lg border border-error/30 bg-surface-container-low p-6 text-center">
          <h1 className="font-headline text-xl font-semibold text-on-surface">Strategy unavailable</h1>
          <p className="mt-2 font-body text-sm text-on-surface-variant">{error || 'This feed event could not be loaded.'}</p>
          <Link to="/mini" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-gradient-primary px-4 py-2 font-headline text-sm text-on-primary">Back to Mini App</Link>
        </section>
      </main>
    );
  }

  const actor = profile || widget.cluster || widget.agent;

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-on-surface sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
          <Link to="/mini" className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
            Mini App Home
          </Link>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-label text-xs uppercase tracking-widest text-primary">{widget.strategy.type} strategy</p>
              <h1 className="mt-1 font-headline text-3xl font-semibold">{widget.strategy.name}</h1>
              <p className="mt-2 max-w-2xl font-body text-sm leading-6 text-on-surface-variant">{widget.description}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4">
              <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">Profile</p>
              <p className="mt-1 font-headline text-lg font-semibold">{actor?.name || widget.agent.name}</p>
              <p className="font-body text-sm text-primary">Reputation {actor?.reputationScore || widget.agent.reputationScore}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-label text-xs uppercase tracking-widest text-primary">Strategy overview</p>
                <h2 className="mt-2 font-headline text-2xl font-semibold">{widget.title}</h2>
                <p className="mt-2 max-w-prose font-body text-sm leading-6 text-on-surface-variant">{widget.subtitle}</p>
              </div>
              <span className="inline-flex min-h-10 items-center rounded-lg bg-surface-container-high px-3 py-2 font-label text-xs uppercase text-primary">
                {widget.strategy.validationStatus}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <SummaryTile label="TVL" value={widget.metrics.tvl ? `$${widget.metrics.tvl.toLocaleString()}` : 'Pending'} />
              <SummaryTile label="Alpha Bridge" value={`${widget.metrics.alphaBridge.toFixed(1)}x`} />
              <SummaryTile label="Risk score" value={`${widget.strategy.riskScore}/100`} />
            </div>
            <div className="mt-5 rounded-lg bg-surface-container-lowest p-4">
              <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">Policy detail</p>
              <p className="mt-2 font-body text-sm leading-6 text-on-surface-variant">
                Protocol {widget.strategy.protocol} on {widget.strategy.chain}. Execution is routed through Sovereign Account permissions, proof validation, adapter allowlists, and revocation controls.
              </p>
            </div>
          </div>
          <SovereignActionPanel data={widget} />
        </section>

        <MetricsGrid data={widget} />

        <section className="grid gap-6 lg:grid-cols-2">
          <TxHistorySection items={txHistory} />
          <ProofSection proofs={proofs} />
        </section>

        <section className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
          <div className="mb-4">
            <h2 className="font-headline text-lg font-semibold">Farcaster Feed Preview</h2>
            <p className="mt-1 font-body text-sm text-on-surface-variant">This is the card users see in the Farcaster feed before opening this full Mini App profile.</p>
          </div>
          <div className="max-w-xl">
            <ClusterFiFeedWidget data={widget} />
          </div>
        </section>

        <section className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
          <h2 className="font-headline text-lg font-semibold">Risk & Policy</h2>
          <p className="mt-2 font-body text-sm leading-6 text-on-surface-variant">
            Risk score {widget.strategy.riskScore}/100. Validation status: {widget.strategy.validationStatus}. Protocol: {widget.strategy.protocol}. Chain: {widget.strategy.chain}.
          </p>
        </section>
      </div>
    </main>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4">
      <p className="font-label text-xs uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="mt-2 font-headline text-xl font-semibold">{value}</p>
    </div>
  );
}
