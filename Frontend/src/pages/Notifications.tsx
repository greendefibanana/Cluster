import { EmptyState, SectionSkeleton } from "../components/StateBlocks";
import { formatRelativeTime } from "../lib/format";
import { useAppContext } from "../hooks/useAppContext";

const accentClasses = {
  primary: "text-primary bg-primary/10 border-primary/20",
  secondary: "text-secondary bg-secondary/10 border-secondary/20",
  tertiary: "text-tertiary bg-tertiary/10 border-tertiary/20",
  error: "text-error bg-error/10 border-error/20",
} as const;

const icons = {
  success: "paid",
  info: "trending_up",
  signal: "lightbulb",
  warning: "warning",
} as const;

export default function Notifications() {
  const { notifications, appStatus, dismissNotification } = useAppContext();

  return (
    <main className="flex-1 w-full pt-24 pb-28 md:pb-12 px-4 md:px-8 max-w-[1600px] mx-auto">
      <header className="mb-8">
        <h2 className="font-headline text-3xl md:text-4xl font-bold text-on-surface mb-2">Swarm Activity</h2>
        <p className="font-body text-on-surface-variant text-sm md:text-base max-w-2xl">
          Real-time telemetry and execution logs from your deployed AI agents across the BNB ecosystem.
        </p>
      </header>

      {appStatus === "loading" ? <SectionSkeleton rows={4} /> : null}

      {appStatus !== "loading" && notifications.length === 0 ? (
        <EmptyState
          title="All caught up"
          message="No new activity signals are waiting for review."
        />
      ) : null}

      <div className="space-y-4">
        {notifications.map((notification) => {
          const accent = accentClasses[notification.accent];
          return (
            <div
              key={notification.id}
              className={`glass-card rounded-xl p-5 border border-outline-variant/20 flex flex-col sm:flex-row gap-4 items-start sm:items-center relative overflow-hidden group hover:bg-surface-variant/60 transition-colors ${notification.accent === "error" ? "bg-error/5 border-error/20" : ""}`}
            >
              {notification.accent === "tertiary" ? (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary shadow-[0_0_10px_rgba(0,249,190,0.5)]" />
              ) : null}
              <div className={`w-12 h-12 rounded-lg border flex items-center justify-center shrink-0 ${accent}`}>
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">{icons[notification.kind]}</span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1 gap-3">
                  <span className={`font-label text-xs uppercase tracking-wider font-bold ${notification.accent === "error" ? "text-error" : accent.split(" ")[0]}`}>
                    {notification.title}
                  </span>
                  <span className="font-label text-xs text-outline">{formatRelativeTime(notification.createdAt)}</span>
                </div>
                <p className="font-body text-sm text-on-surface leading-relaxed">{notification.body}</p>
                {notification.metric ? (
                  <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 rounded bg-surface-container-lowest border border-outline-variant/30">
                    <span className="font-label text-sm text-on-surface">{notification.metric}</span>
                  </div>
                ) : null}
                {notification.ctaLabel ? (
                  <div className="mt-2 flex gap-2">
                    <button className="font-label text-xs px-3 py-1.5 rounded bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                      {notification.ctaLabel}
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                onClick={() => void dismissNotification(notification.id)}
                className="h-10 w-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={`Dismiss ${notification.title}`}
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
