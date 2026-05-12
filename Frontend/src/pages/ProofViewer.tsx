import { Link, useSearchParams } from "react-router-dom";

export default function ProofViewer() {
  const [searchParams] = useSearchParams();
  const proofURI = searchParams.get("proofURI") || "0g://clusterfi-demo/mock-proof";
  const strategyId = searchParams.get("strategyId") || "demo-strategy";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 pb-28 text-left md:px-8 md:py-12">
      <div className="mb-6">
        <p className="font-label text-xs uppercase tracking-widest text-primary">Validation and proof viewer</p>
        <h1 className="mt-2 font-headline text-3xl font-semibold text-on-surface md:text-4xl">Proof object</h1>
        <p className="mt-2 max-w-3xl font-body text-sm leading-6 text-on-surface-variant">
          Demo proofs resolve to mock 0G URIs locally. Real 0G Storage can replace this provider without changing the product flow.
        </p>
      </div>

      <section className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
        <dl className="grid gap-4 md:grid-cols-2">
          <ProofField label="Strategy ID" value={strategyId} />
          <ProofField label="Proof URI" value={proofURI} />
          <ProofField label="Claim status" value="pending validator response" />
          <ProofField label="Provider" value={proofURI.startsWith("0g://") ? "0G-compatible" : "external"} />
        </dl>

        <div className="mt-5 rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4">
          <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">Mock proof payload</p>
          <pre className="mt-3 overflow-auto rounded-lg bg-background p-4 font-mono text-xs leading-5 text-on-surface">
{JSON.stringify({
  type: "strategy-proof",
  strategyId,
  proofURI,
  checks: ["identity", "strategy", "pnl", "receiver-safety"],
  status: "demo-validatable",
}, null, 2)}
          </pre>
        </div>
      </section>

      <Link
        to={`/strategy-detail?strategyId=${encodeURIComponent(strategyId)}`}
        className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-2 font-headline text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Back to strategy
      </Link>
    </main>
  );
}

function ProofField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-4">
      <dt className="font-label text-xs uppercase tracking-widest text-on-surface-variant">{label}</dt>
      <dd className="mt-2 break-all font-body text-sm text-on-surface">{value}</dd>
    </div>
  );
}
