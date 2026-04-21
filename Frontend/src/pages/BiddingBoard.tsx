import { useAppContext } from "../hooks/useAppContext";

const accents = {
  primary: {
    panel: "text-primary border-primary/20 bg-primary/10",
    button: "bg-gradient-to-br from-primary to-primary-container text-on-primary",
  },
  secondary: {
    panel: "text-secondary border-secondary/20 bg-secondary/10",
    button: "bg-surface-variant/40 border-outline-variant/20 hover:border-primary/50 text-on-surface",
  },
  tertiary: {
    panel: "text-tertiary border-tertiary/20 bg-tertiary/10",
    button: "bg-surface-variant/40 border-outline-variant/20 hover:border-tertiary/50 text-on-surface",
  },
  error: {
    panel: "text-error border-error/20 bg-error/10",
    button: "bg-surface-container-high border-outline-variant/20 hover:border-error/50 text-on-surface",
  },
} as const;

export default function BiddingBoard() {
  const { jobs, agents } = useAppContext();

  return (
    <main className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full relative z-10 mt-6 md:mt-16">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl lg:text-5xl font-bold text-on-surface mb-2">Bidding Board</h1>
          <p className="font-body text-on-surface-variant text-sm md:text-base flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_rgba(0,249,190,0.6)]" />
            Active x402 Jobs
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-surface-container-high border border-outline-variant/20 text-on-surface hover:text-primary px-4 py-2 rounded-lg font-label text-sm flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">filter_list</span>
            Filter
          </button>
          <button className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-4 py-2 rounded-lg font-label text-sm flex items-center gap-2 shadow-[0_0_15px_-3px_rgba(164,230,255,0.4)] hover:shadow-[0_0_20px_0_rgba(164,230,255,0.6)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">add</span>
            Post Job
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {jobs.map((job, index) => {
          const accent = accents[job.accent];
          const relatedAgents = agents.filter((agent) => job.creditedAgents.includes(agent.id));
          return (
            <div
              key={job.id}
              className={`${index === 0 ? "col-span-1 md:col-span-2 xl:col-span-2" : "col-span-1"} ${index === 3 ? "bg-surface-container-lowest" : "bg-surface-container-low"} rounded-xl p-6 border border-outline-variant/15 hover:border-outline-variant/30 transition-colors group relative overflow-hidden ${job.accent === "secondary" ? "bg-secondary-container/10 border-l-2 border-secondary" : ""}`}
            >
              <div className={`w-10 h-10 rounded bg-surface-container border flex items-center justify-center ${accent.panel}`}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  {job.accent === "secondary" ? "troubleshoot" : job.accent === "primary" ? "rocket_launch" : job.accent === "tertiary" ? "data_exploration" : "gavel"}
                </span>
              </div>
              <div className="mt-4 flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-headline text-lg font-semibold text-on-surface">{job.title}</h3>
                  <p className="font-body text-xs text-on-surface-variant">{job.subtitle}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-1 rounded-full font-label text-xs border ${accent.panel}`}>
                  {job.stateLabel}
                </span>
              </div>
              <p className="font-body text-sm text-on-surface-variant leading-relaxed mt-4">{job.summary}</p>
              <div className="space-y-3 my-6">
                <div className="flex justify-between items-center bg-surface-container-lowest border border-outline-variant/20 rounded p-2">
                  <span className="font-label text-xs text-on-surface-variant uppercase tracking-wider">Reward</span>
                  <span className={`font-headline font-bold ${job.accent === "error" ? "text-on-surface" : job.accent === "secondary" ? "text-secondary" : job.accent === "tertiary" ? "text-tertiary" : "text-primary"}`}>{job.rewardLabel}</span>
                </div>
                <div className="flex justify-between items-center bg-surface-container-lowest border border-outline-variant/20 rounded p-2">
                  <span className="font-label text-xs text-on-surface-variant uppercase tracking-wider">Duration</span>
                  <span className={`font-headline font-bold text-sm ${job.accent === "error" ? "text-error" : "text-on-surface"}`}>{job.durationLabel}</span>
                </div>
              </div>
              <div className="flex justify-between items-center gap-4">
                <div className="flex -space-x-2">
                  {relatedAgents.slice(0, 3).map((agent) => (
                    <img key={agent.id} alt={`${agent.name} avatar`} className="w-8 h-8 rounded-full border-2 border-surface-container-low object-cover" src={agent.avatarUrl} />
                  ))}
                  {relatedAgents.length > 3 ? (
                    <div className="w-8 h-8 rounded-full border-2 border-surface-container-low bg-surface-container-highest flex items-center justify-center text-[10px] text-on-surface-variant">
                      +{relatedAgents.length - 3}
                    </div>
                  ) : null}
                </div>
                <button className={`px-6 py-2 rounded-lg font-label text-sm transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${accent.button}`}>
                  Bid with Agent
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
