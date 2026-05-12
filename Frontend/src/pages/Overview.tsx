import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { InlineError, SectionSkeleton } from "../components/StateBlocks";
import { formatRelativeTime, truncateAddress } from "../lib/format";
import { useAppContext } from "../hooks/useAppContext";

type FundingMode = "new" | "existing";
type InstrumentType = "meme" | "lp" | "yield" | "prediction";

export default function Overview() {
  const {
    overview,
    appStatus,
    appError,
    wallet,
    agents,
    swarms,
    feed,
    userStrategyAccounts,
    createAndDepositStrategyAccount,
    addFundsToStrategyAccount,
    refreshApp,
  } = useAppContext();

  const [showFundModal, setShowFundModal] = useState(false);
  const [fundingMode, setFundingMode] = useState<FundingMode>("new");
  const [manualExecutor, setManualExecutor] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [instrumentType, setInstrumentType] = useState<InstrumentType>("yield");
  const [fundAmount, setFundAmount] = useState("100");
  const [selectedAccount, setSelectedAccount] = useState(userStrategyAccounts[0]?.accountAddress ?? "");
  const [isFunding, setIsFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);

  const personalAgents = agents.slice(0, 4);
  const openPositions = userStrategyAccounts;
  const externallyManagedPositions = userStrategyAccounts.filter((account) =>
    !agents.some((agent) => agent.tbaAddress.toLowerCase() === account.approvedExecutor.toLowerCase()) &&
    !swarms.some((swarm) => swarm.tbaAddress.toLowerCase() === account.approvedExecutor.toLowerCase()),
  );

  const suggestedStrategies = useMemo(() => feed.slice(0, 3), [feed]);

  useEffect(() => {
    if (!selectedAccount && userStrategyAccounts[0]?.accountAddress) {
      setSelectedAccount(userStrategyAccounts[0].accountAddress);
    }
  }, [selectedAccount, userStrategyAccounts]);

  const handleFundSubmit = async () => {
    if (!fundAmount || Number(fundAmount) <= 0) {
      setFundError("Enter an amount greater than zero.");
      return;
    }

    setIsFunding(true);
    setFundError(null);
    try {
      if (fundingMode === "existing") {
        if (!selectedAccount) {
          throw new Error("Select an existing Sovereign Account.");
        }
        await addFundsToStrategyAccount(selectedAccount, fundAmount);
      } else {
        if (!/^0x[a-fA-F0-9]{40}$/.test(manualExecutor.trim())) {
          throw new Error("Enter a valid agent or cluster executor address.");
        }
        const labelSlug = (manualLabel || `${instrumentType}-strategy`)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        await createAndDepositStrategyAccount({
          approvedExecutor: manualExecutor.trim(),
          strategyId: `${labelSlug || "manual-strategy"}-${manualExecutor.trim().toLowerCase()}-${Date.now()}`,
          instrumentType,
          amount: fundAmount,
          maxSlippageBps: 100,
        });
      }
      setShowFundModal(false);
      setFundAmount("100");
      setManualExecutor("");
      setManualLabel("");
    } catch (error) {
      setFundError(error instanceof Error ? error.message : "Funding failed");
    } finally {
      setIsFunding(false);
    }
  };

  return (
    <main className="flex-grow pt-24 pb-28 md:pb-12 px-4 md:px-8 max-w-7xl mx-auto w-full flex flex-col gap-8 relative z-10">
      {appStatus === "loading" ? <SectionSkeleton rows={5} /> : null}

      {appStatus === "error" ? (
        <InlineError
          title="Couldn't refresh dashboard"
          message={appError || "This is usually a network hiccup. Try again in a moment."}
          action={
            <button
              onClick={() => void refreshApp()}
              className="rounded-lg border border-outline-variant/20 bg-surface-container-high px-4 py-2 text-sm text-on-surface"
            >
              Try again
            </button>
          }
        />
      ) : null}

      <section className="bg-surface-container-low rounded-xl p-8 relative overflow-hidden group">
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-on-surface-variant font-body text-sm font-medium tracking-wide mb-2 uppercase">
              Personal Strategy Capital
            </h2>
            <div className="flex flex-col gap-1">
              <span className="text-primary font-headline text-5xl md:text-6xl font-bold tracking-tighter drop-shadow-[0_0_12px_rgba(164,230,255,0.3)]">
                {overview.tvlLabel}
              </span>
              <span className="text-tertiary font-label text-lg flex items-center gap-2 mt-2">
                <span className="material-symbols-outlined text-sm" aria-hidden="true">account_balance_wallet</span>
                {openPositions.length} Sovereign Accounts
                <span className="text-on-surface-variant/50 text-sm ml-2">{overview.tvlDeltaLabel}</span>
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => setShowFundModal(true)}
              disabled={wallet.status !== "connected"}
              className="kinetic-gradient text-on-primary font-body font-semibold px-6 py-3 rounded-lg shadow-[0_4px_20px_-4px_rgba(164,230,255,0.4)] hover:shadow-[0_4px_25px_-4px_rgba(164,230,255,0.6)] transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {wallet.status === "connected" ? "Fund a Strategy" : "Connect Wallet to Fund"}
            </button>
            <Link
              to="/sovereign-accounts"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-outline-variant/20 bg-surface-container-high px-5 py-3 font-headline text-sm text-on-surface hover:bg-surface-container-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Manage Sovereign Accounts
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <MetricPanel icon="smart_toy" title="Personal Agents" value={`${personalAgents.length}`} helper="Owned or connected agents" accent="primary" />
        <MetricPanel icon="donut_large" title="Open Positions" value={`${openPositions.length}`} helper="Isolated Sovereign Accounts" accent="secondary" />
        <MetricPanel icon="groups" title="Externally Managed" value={`${externallyManagedPositions.length}`} helper="Other agents or clusters managing execution" accent="tertiary" />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="bg-surface-container-low rounded-xl p-6 ghost-border">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="text-on-surface font-headline text-xl font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" aria-hidden="true">account_tree</span>
              Open Positions
            </h3>
            <Link to="/sovereign-accounts" className="font-label text-sm text-primary hover:text-primary-container">
              View all
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {openPositions.length ? openPositions.slice(0, 4).map((position) => (
              <div key={position.id} className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-headline text-base font-semibold text-on-surface">{position.strategyTitle}</p>
                    <p className="mt-1 font-body text-sm text-on-surface-variant">
                      Managed by {position.executorLabel} / {truncateAddress(position.accountAddress, 6)}
                    </p>
                  </div>
                  <span className="w-fit rounded-sm border border-primary/20 bg-primary/10 px-2 py-1 font-label text-xs uppercase text-primary">
                    {position.status}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <SmallStat label="Balance" value={position.balanceLabel} />
                  <SmallStat label="PnL" value={position.pnlLabel} />
                  <SmallStat label="Risk" value={position.riskProfile} />
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-5 text-sm text-on-surface-variant">
                No funded Sovereign Accounts yet. Start from a Farcaster strategy card or fund manually.
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface-container-low rounded-xl p-6 ghost-border">
          <h3 className="text-on-surface font-headline text-xl font-semibold mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary" aria-hidden="true">dynamic_feed</span>
            Strategy Discovery
          </h3>
          <div className="flex flex-col gap-3">
            {suggestedStrategies.map((post) => (
              <Link
                key={post.id}
                to={`/strategy-detail?strategyId=${encodeURIComponent(post.strategyId ?? post.id)}`}
                className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4 hover:border-primary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-headline text-base font-semibold text-on-surface">{post.insightTitle ?? post.actionType ?? "Agent strategy"}</p>
                    <p className="mt-1 line-clamp-2 font-body text-sm text-on-surface-variant">{post.content}</p>
                  </div>
                  <span className="rounded-sm border border-secondary/20 bg-secondary/10 px-2 py-1 font-label text-xs uppercase text-secondary">
                    {post.instrumentType ?? "yield"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="bg-surface-container-low rounded-xl p-6 ghost-border">
          <h3 className="text-on-surface font-headline text-xl font-semibold mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary" aria-hidden="true">badge</span>
            Personal Agents
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {personalAgents.map((agent) => (
              <Link
                key={agent.id}
                to={`/agent-detail?agentId=${agent.id}`}
                className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="flex items-center gap-3">
                  <img src={agent.avatarUrl} alt={`${agent.name} avatar`} className="h-10 w-10 rounded-full border border-outline-variant/30" />
                  <div className="min-w-0">
                    <p className="truncate font-headline text-sm font-semibold text-on-surface">{agent.name}</p>
                    <p className="truncate font-body text-xs text-on-surface-variant">{agent.title}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="font-label text-primary">Score {agent.score}</span>
                  <span className="font-label text-on-surface-variant">{agent.skills.filter((skill) => skill.equipped).length} skills</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-low rounded-xl p-6 ghost-border">
          <h3 className="text-on-surface font-headline text-xl font-semibold mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" aria-hidden="true">receipt_long</span>
            History
          </h3>
          <div className="flex flex-col gap-3">
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
        </div>
      </section>

      {showFundModal ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 md:items-center">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
            onClick={() => !isFunding && setShowFundModal(false)}
            aria-label="Close fund strategy modal"
          />
          <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low shadow-2xl">
            <div className="p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-2xl" aria-hidden="true">account_balance_wallet</span>
                  </div>
                  <div>
                    <h3 className="font-headline text-xl font-bold text-on-surface">Fund a Strategy</h3>
                    <p className="font-body text-xs uppercase tracking-widest text-on-surface-variant">Non-custodial Sovereign Account</p>
                  </div>
                </div>
                <button
                  disabled={isFunding}
                  onClick={() => setShowFundModal(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
                  aria-label="Close"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-surface-container-lowest p-1">
                <button
                  onClick={() => setFundingMode("new")}
                  className={`min-h-10 rounded-md px-3 py-2 font-label text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${fundingMode === "new" ? "bg-surface-container-high text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  New Strategy
                </button>
                <button
                  onClick={() => setFundingMode("existing")}
                  className={`min-h-10 rounded-md px-3 py-2 font-label text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${fundingMode === "existing" ? "bg-surface-container-high text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  Existing Basket
                </button>
              </div>

              <div className="space-y-4">
                {fundingMode === "new" ? (
                  <>
                    <Field label="Agent or cluster executor address">
                      <input
                        value={manualExecutor}
                        onChange={(event) => setManualExecutor(event.target.value)}
                        placeholder="0x..."
                        autoComplete="off"
                        className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-3 font-body text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </Field>
                    <Field label="Label">
                      <input
                        value={manualLabel}
                        onChange={(event) => setManualLabel(event.target.value)}
                        placeholder="e.g. Quant LP Cluster"
                        autoComplete="off"
                        className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-3 font-body text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </Field>
                    <Field label="Instrument type">
                      <select
                        value={instrumentType}
                        onChange={(event) => setInstrumentType(event.target.value as InstrumentType)}
                        className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-3 font-body text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                      >
                        <option value="yield">Yield</option>
                        <option value="lp">LP</option>
                        <option value="meme">Meme</option>
                        <option value="prediction">Prediction</option>
                      </select>
                    </Field>
                  </>
                ) : (
                  <Field label="Funded basket">
                    <select
                      value={selectedAccount}
                      onChange={(event) => setSelectedAccount(event.target.value)}
                      className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-3 font-body text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    >
                      {userStrategyAccounts.length ? userStrategyAccounts.map((account) => (
                        <option key={account.accountAddress} value={account.accountAddress}>
                          {account.strategyTitle} / {account.balanceLabel}
                        </option>
                      )) : (
                        <option value="">No funded baskets yet</option>
                      )}
                    </select>
                  </Field>
                )}

                <Field label="Amount">
                  <div className="relative">
                    <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant" aria-hidden="true">payments</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={fundAmount}
                      onChange={(event) => setFundAmount(event.target.value)}
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-lowest py-3 pl-10 pr-3 font-body text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                </Field>
              </div>

              {fundError ? <p className="mt-4 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">{fundError}</p> : null}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowFundModal(false)}
                  disabled={isFunding}
                  className="flex-1 rounded-lg border border-outline-variant/20 py-3 font-label font-bold text-on-surface hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFundSubmit}
                  disabled={isFunding || !fundAmount || Number(fundAmount) <= 0 || (fundingMode === "existing" && !selectedAccount)}
                  className="flex-1 rounded-lg bg-gradient-to-br from-primary to-primary-container py-3 font-label font-bold text-on-primary transition-all hover:shadow-[0_0_15px_rgba(164,230,255,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:hover:shadow-none"
                >
                  {isFunding ? "Funding..." : fundingMode === "new" ? "Create & Fund" : "Add Funds"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function MetricPanel({
  icon,
  title,
  value,
  helper,
  accent,
}: {
  icon: string;
  title: string;
  value: string;
  helper: string;
  accent: "primary" | "secondary" | "tertiary";
}) {
  const accentClass = accent === "primary" ? "text-primary bg-primary/10" : accent === "secondary" ? "text-secondary bg-secondary/10" : "text-tertiary bg-tertiary/10";

  return (
    <div className="glass-panel ghost-border rounded-xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-xs uppercase tracking-wider text-on-surface-variant">{title}</p>
          <p className="mt-2 font-label text-3xl font-bold text-on-surface">{value}</p>
          <p className="mt-1 font-body text-sm text-on-surface-variant">{helper}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${accentClass}`}>
          <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        </div>
      </div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-container-low p-2">
      <p className="font-body text-[11px] uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="mt-1 truncate font-label text-sm text-on-surface">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-label text-sm text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}
