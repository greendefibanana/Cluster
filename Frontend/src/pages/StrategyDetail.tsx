import { Link, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { EmptyState } from "../components/StateBlocks";
import { formatRelativeTime, truncateAddress } from "../lib/format";
import { useAppContext } from "../hooks/useAppContext";

export default function StrategyDetail() {
  const [searchParams] = useSearchParams();
  const { feed, userStrategyAccounts, wallet, createAndDepositStrategyAccount } = useAppContext();
  const [amount, setAmount] = useState("100");
  const [asset, setAsset] = useState<"erc20" | "native">("native");
  const [isOpening, setIsOpening] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const strategyId = searchParams.get("strategyId") ?? feed[0]?.strategyId;
  const post = feed.find((item) => item.strategyId === strategyId) ?? feed[0];
  const accounts = userStrategyAccounts.filter((account) => account.strategyId === post?.strategyId);
  const approvedExecutor = post?.tbaAddress || post?.contractAddress || "";

  if (!post) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8">
        <EmptyState title="No strategy selected" message="Open a feed post to inspect its proof, PnL, and Sovereign Account safety controls." />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-28 text-left md:px-8 md:py-12">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <p className="font-label text-xs uppercase tracking-widest text-primary">{post.instrumentType ?? "strategy"} strategy</p>
          <h1 className="mt-2 font-headline text-3xl font-semibold text-on-surface md:text-4xl">{post.title ?? post.insightTitle ?? "Investable agent post"}</h1>
          <p className="mt-3 font-body text-sm leading-6 text-on-surface-variant">{post.content}</p>
        </div>
        <Link
          to={`/proof-viewer?proofURI=${encodeURIComponent(post.proofURI ?? "")}&strategyId=${encodeURIComponent(post.strategyId ?? "")}`}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 px-4 py-2 font-headline text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          View proof
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["PnL", post.pnl ? `${post.pnl > 0 ? "+" : ""}${post.pnl.toLocaleString()} mUSD` : "Pending"],
          ["TVL", post.tvl ? `${post.tvl.toLocaleString()} mUSD` : "0 mUSD"],
          ["Risk", `${post.riskScore ?? 50}/100`],
          ["Chain", post.chainId ? `Chain ${post.chainId}` : "Demo"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">{label}</p>
            <p className="mt-2 font-headline text-xl font-semibold text-on-surface">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-headline text-lg font-semibold text-on-surface">Invest Flow</h2>
              <p className="mt-1 font-body text-sm text-on-surface-variant">
                Investing opens an isolated Sovereign Account. Funds stay controlled by the user; agents only get limited adapter permissions.
              </p>
            </div>
            <button
              onClick={async () => {
                if (!post.strategyId || !approvedExecutor) {
                  setActionError("This strategy is missing an executor address.");
                  return;
                }
                setIsOpening(true);
                setActionError(null);
                try {
                  await createAndDepositStrategyAccount({
                    approvedExecutor,
                    strategyId: post.strategyId,
                    instrumentType: post.instrumentType,
                    amount,
                    asset,
                    maxSlippageBps: 100,
                  });
                } catch (error) {
                  setActionError(error instanceof Error ? error.message : "Could not open Sovereign Account");
                } finally {
                  setIsOpening(false);
                }
              }}
              disabled={wallet.status !== "connected" || isOpening || !amount || Number(amount) <= 0}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-gradient-primary px-4 py-2 font-headline text-sm font-semibold text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isOpening ? "Opening..." : wallet.status === "connected" ? "Open Sovereign Account" : "Connect wallet"}
            </button>
          </div>

          <div className="mt-5 max-w-sm">
            <label className="font-label text-xs uppercase tracking-widest text-on-surface-variant" htmlFor="sovereign-account-amount">
              Initial {asset === "native" ? "MNT" : "cfUSD"} deposit
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                ["native", "MNT"],
                ["erc20", "cfUSD"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAsset(value as "erc20" | "native")}
                  className={`min-h-9 rounded-lg border px-3 font-headline text-sm ${
                    asset === value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              id="sovereign-account-amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className="mt-2 w-full rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-3 font-body text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            {actionError ? <p className="mt-2 text-sm text-error">{actionError}</p> : null}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {["Create Sovereign Account", "Deposit testnet funds", "Revoke or exit anytime"].map((item, index) => (
              <div key={item} className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4">
                <span className="font-label text-xs text-primary">0{index + 1}</span>
                <p className="mt-2 font-body text-sm text-on-surface">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
          <h2 className="font-headline text-lg font-semibold text-on-surface">Proof Trail</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-label text-xs uppercase tracking-widest text-on-surface-variant">Strategy ID</dt>
              <dd className="mt-1 break-all font-body text-on-surface">{post.strategyId}</dd>
            </div>
            <div>
              <dt className="font-label text-xs uppercase tracking-widest text-on-surface-variant">0G URI</dt>
              <dd className="mt-1 break-all font-body text-primary">{post.proofURI}</dd>
            </div>
            <div>
              <dt className="font-label text-xs uppercase tracking-widest text-on-surface-variant">Contract</dt>
              <dd className="mt-1 font-body text-on-surface">{truncateAddress(post.contractAddress ?? "0x0000000000000000000000000000000000000000", 6)}</dd>
            </div>
            <div>
              <dt className="font-label text-xs uppercase tracking-widest text-on-surface-variant">Created</dt>
              <dd className="mt-1 font-body text-on-surface">{formatRelativeTime(post.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
        <h2 className="font-headline text-lg font-semibold text-on-surface">Your Sovereign Accounts</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {accounts.length ? accounts.map((account) => (
            <Link
              key={account.id}
              to="/sovereign-accounts"
              className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-headline text-sm font-semibold text-on-surface">{account.strategyTitle}</p>
                <span className="rounded-sm border border-outline-variant/20 px-2 py-1 font-label text-xs text-primary">{account.status}</span>
              </div>
              <p className="mt-2 font-body text-sm text-on-surface-variant">{account.balanceLabel} controlled by {truncateAddress(account.accountAddress, 6)}</p>
            </Link>
          )) : (
            <p className="font-body text-sm text-on-surface-variant">No Sovereign Account has been opened for this strategy yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
