import { Link } from "react-router-dom";
import { useState } from "react";
import { EmptyState } from "../components/StateBlocks";
import { truncateAddress } from "../lib/format";
import { useAppContext } from "../hooks/useAppContext";

export default function UserStrategyAccounts() {
  const {
    userStrategyAccounts,
    wallet,
    pauseStrategyAccount,
    resumeStrategyAccount,
    revokeStrategyExecutor,
    withdrawStrategyAccount,
    closeStrategyAccount,
  } = useAppContext();
  const [busyAccount, setBusyAccount] = useState<string | null>(null);
  const [withdrawAmounts, setWithdrawAmounts] = useState<Record<string, string>>({});
  const [withdrawAssets, setWithdrawAssets] = useState<Record<string, "native" | "erc20">>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const runAccountAction = async (accountAddress: string, action: () => Promise<void>) => {
    setBusyAccount(accountAddress);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Sovereign Account action failed");
    } finally {
      setBusyAccount(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-28 text-left md:px-8 md:py-12">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-label text-xs uppercase tracking-widest text-primary">Non-custodial Sovereign Accounts</p>
          <h1 className="mt-2 font-headline text-3xl font-semibold text-on-surface md:text-4xl">Your Sovereign Accounts</h1>
          <p className="mt-2 max-w-3xl font-body text-sm leading-6 text-on-surface-variant">
            ClusterFi does not pool user funds into agent-owned vaults. Each Sovereign Account is owned by one user, with revocable executor permission and adapter allowlists.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-2 font-headline text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Back to feed
        </Link>
      </div>

      {userStrategyAccounts.length === 0 ? (
        <EmptyState title="No Sovereign Accounts yet" message="Open a strategy from the feed to create your first isolated Sovereign Account." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {userStrategyAccounts.map((account) => (
            <article key={account.id} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-headline text-lg font-semibold text-on-surface">{account.strategyTitle}</h2>
                  <p className="mt-1 font-body text-sm text-on-surface-variant">{truncateAddress(account.accountAddress, 6)} - {account.assetSymbol}</p>
                </div>
                <span className="inline-flex w-fit rounded-sm border border-primary/20 bg-primary/10 px-2 py-1 font-label text-xs uppercase text-primary">
                  {account.status}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Metric label="Balance" value={account.balanceLabel} />
                <Metric label="Max allocation" value={account.maxAllocationLabel} />
                <Metric label="PnL" value={account.pnlLabel} />
              </div>

              <div className="mt-5 rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4">
                <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">Execution permission</p>
                <p className="mt-2 font-body text-sm text-on-surface">
                  {account.executorLabel} can execute through {account.allowedAdapters.join(", ")} with max slippage {account.maxSlippageBps} bps.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => runAccountAction(
                    account.accountAddress,
                    () => account.status === "paused"
                      ? resumeStrategyAccount(account.accountAddress)
                      : pauseStrategyAccount(account.accountAddress)
                  )}
                  disabled={wallet.status !== "connected" || busyAccount === account.accountAddress}
                  className="min-h-10 rounded-lg border border-outline-variant/20 bg-surface-container-high px-4 py-2 font-headline text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {account.status === "paused" ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={() => runAccountAction(account.accountAddress, () => revokeStrategyExecutor(account.accountAddress))}
                  disabled={wallet.status !== "connected" || busyAccount === account.accountAddress}
                  className="min-h-10 rounded-lg border border-error/30 bg-error/10 px-4 py-2 font-headline text-sm text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Revoke executor
                </button>
                <input
                  aria-label={`Withdraw amount for ${account.strategyTitle}`}
                  value={withdrawAmounts[account.accountAddress] ?? ""}
                  onChange={(event) => setWithdrawAmounts((current) => ({ ...current, [account.accountAddress]: event.target.value }))}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  className="min-h-10 w-28 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 font-body text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <select
                  aria-label={`Withdraw asset for ${account.strategyTitle}`}
                  value={withdrawAssets[account.accountAddress] ?? "native"}
                  onChange={(event) => setWithdrawAssets((current) => ({
                    ...current,
                    [account.accountAddress]: event.target.value as "native" | "erc20",
                  }))}
                  className="min-h-10 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 font-body text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="native">MNT</option>
                  <option value="erc20">cfUSD</option>
                </select>
                <button
                  onClick={() => runAccountAction(
                    account.accountAddress,
                    () => withdrawStrategyAccount(
                      account.accountAddress,
                      withdrawAmounts[account.accountAddress] || "0",
                      withdrawAssets[account.accountAddress] ?? "native"
                    )
                  )}
                  disabled={wallet.status !== "connected" || busyAccount === account.accountAddress || !(Number(withdrawAmounts[account.accountAddress]) > 0)}
                  className="min-h-10 rounded-lg bg-gradient-primary px-4 py-2 font-headline text-sm font-semibold text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Withdraw
                </button>
                <button
                  onClick={() => runAccountAction(account.accountAddress, () => closeStrategyAccount(
                    account.accountAddress,
                    withdrawAssets[account.accountAddress] ?? "native"
                  ))}
                  disabled={wallet.status !== "connected" || busyAccount === account.accountAddress}
                  className="min-h-10 rounded-lg border border-outline-variant/20 px-4 py-2 font-headline text-sm text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Close
                </button>
              </div>
              {busyAccount === account.accountAddress ? <p className="mt-3 text-sm text-primary">Waiting for wallet confirmation...</p> : null}
            </article>
          ))}
        </div>
      )}
      {actionError ? <p className="mt-4 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">{actionError}</p> : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-3">
      <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className="mt-1 font-headline text-base font-semibold text-on-surface">{value}</p>
    </div>
  );
}
