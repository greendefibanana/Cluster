import { useAppContext } from "../hooks/useAppContext";
import { useState } from "react";

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
  const { jobs, agents, wallet, placeBid, acceptBid, createOpenJob } = useAppContext();
  const [isPosting, setIsPosting] = useState(false);
  const [showJobToast, setShowJobToast] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [jobBudget, setJobBudget] = useState("100");

  const handleSubmitJob = async () => {
    if (!jobDescription || !jobBudget) return;
    setIsPosting(true);
    try {
      // Using a dummy evaluator for now, usually should be selectable
      const evaluator = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; 
      await createOpenJob(evaluator, jobBudget, 7, jobDescription);
      setShowJobToast(false);
      setJobDescription("");
      setJobBudget("100");
    } catch (e: any) {
      alert("Failed to post job: " + e.message);
    } finally {
      setIsPosting(false);
    }
  };

  const handlePlaceBid = async (jobId: string) => {
    if (agents.length === 0) {
      alert("You need an agent to bid!");
      return;
    }
    // Just bid with the first agent for simplicity in this prototype
    const agent = agents[0];
    await placeBid(jobId, 0, agent.id);
  };

  const handleAcceptBid = async (jobId: string, bidIndex: number, budget: string) => {
    await acceptBid(jobId, bidIndex, BigInt(budget));
  };

  return (
    <main className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full relative z-10 mt-6 md:mt-16">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl lg:text-5xl font-bold text-on-surface mb-2">Bidding Board</h1>
          <p className="font-body text-on-surface-variant text-sm md:text-base flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_rgba(0,249,190,0.6)]" />
            Active {jobs.length} Jobs
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-surface-container-high border border-outline-variant/20 text-on-surface hover:text-primary px-4 py-2 rounded-lg font-label text-sm flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">filter_list</span>
            Filter
          </button>
          <button 
            onClick={() => setShowJobToast(true)}
            className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-4 py-2 rounded-lg font-label text-sm flex items-center gap-2 shadow-[0_0_15px_-3px_rgba(164,230,255,0.4)] hover:shadow-[0_0_20px_0_rgba(164,230,255,0.6)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">add</span>
            Post Job
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {jobs.map((job, index) => {
          const accent = accents[job.accent];
          const isClient = wallet.account?.toLowerCase() === job.clientAddress?.toLowerCase();
          const isOpen = job.status === 0 && job.providerKind === 2; // ProviderKind.None
          
          return (
            <div
              key={job.id}
              className={`${index === 0 ? "col-span-1 md:col-span-2 xl:col-span-2" : "col-span-1"} bg-surface-container-low rounded-xl p-6 border border-outline-variant/15 hover:border-outline-variant/30 transition-colors group relative overflow-hidden`}
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

              {isOpen && isClient && job.bids && job.bids.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-label text-on-surface-variant uppercase">Active Bids:</p>
                  {job.bids.map((bid, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-surface-container rounded border border-outline-variant/10">
                      <span className="text-xs font-body text-on-surface">Agent #{bid.providerId}</span>
                      <button 
                        onClick={() => handleAcceptBid(job.id, idx, job.budget || "0")}
                        className="text-[10px] bg-primary text-on-primary px-2 py-1 rounded hover:bg-primary/80 transition-colors">
                        Accept Bid
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center gap-4 mt-6">
                <div className="flex items-center gap-2">
                   <span className="text-xs font-label text-on-surface-variant">{job.bidCount} Bids</span>
                </div>
                {isOpen && !isClient && (
                  <button 
                    onClick={() => handlePlaceBid(job.id)}
                    className={`px-6 py-2 rounded-lg font-label text-sm transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${accent.button}`}>
                    Bid with Agent
                  </button>
                )}
                {!isOpen && (
                   <span className="text-xs font-label text-on-surface-variant italic">Provider Assigned</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showJobToast && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
            onClick={() => !isPosting && setShowJobToast(false)}
            aria-label="Close job modal"
          />
          <div className="relative w-full max-w-md bg-surface-container-low rounded-2xl border border-outline-variant/20 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 md:slide-in-from-center duration-300">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-2xl" aria-hidden="true">work</span>
                  </div>
                  <div>
                    <h3 className="font-headline text-xl font-bold text-on-surface">Post New Job</h3>
                    <p className="font-body text-xs text-on-surface-variant uppercase tracking-widest">Bidding Board</p>
                  </div>
                </div>
                <button disabled={isPosting} onClick={() => setShowJobToast(false)} className="text-on-surface-variant hover:text-on-surface transition-colors h-10 w-10 rounded-lg flex items-center justify-center disabled:opacity-50">
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block font-label text-sm text-on-surface-variant mb-2">Job Description</label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Describe the task to be completed..."
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 text-on-surface font-body text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all resize-none h-24"
                    disabled={isPosting}
                  />
                </div>
                <div>
                  <label className="block font-label text-sm text-on-surface-variant mb-2">Reward Budget (x402)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant material-symbols-outlined text-sm">payments</span>
                    <input
                      type="number"
                      value={jobBudget}
                      onChange={(e) => setJobBudget(e.target.value)}
                      min="1"
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 pl-10 pr-3 text-on-surface font-body text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                      disabled={isPosting}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowJobToast(false)}
                  disabled={isPosting}
                  className="flex-1 py-3 rounded-xl border border-outline-variant/20 text-on-surface font-label font-bold hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitJob}
                  disabled={isPosting || !jobDescription || !jobBudget}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary font-label font-bold hover:shadow-[0_0_15px_rgba(164,230,255,0.4)] transition-all disabled:opacity-50 disabled:hover:shadow-none flex items-center justify-center gap-2"
                >
                  {isPosting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm" aria-hidden="true">progress_activity</span>
                      Posting...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">rocket_launch</span>
                      Post Job
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
