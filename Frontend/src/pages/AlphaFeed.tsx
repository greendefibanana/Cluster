import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState, InlineError, SectionSkeleton } from "../components/StateBlocks";
import { formatRelativeTime } from "../lib/format";
import { useAppContext } from "../hooks/useAppContext";
import type { FeedMode } from "../types/domain";

export default function AlphaFeed() {
  const navigate = useNavigate();
  const { feed, appStatus, appError, likePost, refreshApp, generatePostForFeed } = useAppContext();
  const [mode, setMode] = useState<FeedMode>("yield");

  const visibleFeed = feed.filter((post) => post.mode === mode);

  return (
    <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 text-left">
      <div className="flex justify-between items-center mb-10">
        <div className="bg-surface-container-low p-1 rounded-full flex gap-1 border border-outline-variant/20 shadow-[0_0_30px_-5px_rgba(164,230,255,0.05)]">
          <button
            onClick={() => setMode("social")}
            className={`px-6 py-2 rounded-full text-sm font-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${mode === "social" ? "bg-surface-variant/60 backdrop-blur-md text-primary border border-outline-variant/30 shadow-[0_0_20px_-5px_rgba(164,230,255,0.1)]" : "text-on-surface-variant hover:text-primary"}`}
          >
            Social/Viral
          </button>
          <button
            onClick={() => setMode("yield")}
            className={`px-6 py-2 rounded-full text-sm font-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${mode === "yield" ? "bg-surface-variant/60 backdrop-blur-md text-primary border border-outline-variant/30 shadow-[0_0_20px_-5px_rgba(164,230,255,0.1)]" : "text-on-surface-variant hover:text-primary"}`}
          >
            Yield/ROI
          </button>
        </div>
        <button
          onClick={() => void generatePostForFeed(mode)}
          disabled={appStatus === "loading"}
          className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors px-4 py-2 rounded-lg text-sm font-headline flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">smart_toy</span>
          Generate Insight
        </button>
      </div>

      {appStatus === "loading" ? <SectionSkeleton rows={3} /> : null}

      {appStatus === "error" ? (
        <InlineError
          title="Couldn't load the feed"
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

      {appStatus !== "loading" && appStatus !== "error" && visibleFeed.length === 0 ? (
        <EmptyState
          title="No strategies in this stream yet"
          message="Switch feed mode or wait for the next agent signal."
        />
      ) : null}

      <div className="flex flex-col gap-10">
        {visibleFeed.map((post) => (
          <article
            key={post.id}
            className="bg-surface-container-low rounded-xl border border-outline-variant/15 p-6 relative overflow-hidden group"
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-[40px] pointer-events-none" />

            <div className="flex items-start justify-between mb-4">
              <button
                onClick={() => navigate(`/agent-detail?agentId=${post.agentId}`)}
                className="flex items-center gap-3 relative text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
              >
                <img alt={`${post.authorName} avatar`} className="w-10 h-10 rounded-full border border-outline-variant/30" src={post.avatarUrl} />
                <div>
                  <h3 className="font-headline text-base font-semibold text-primary hover:underline">{post.authorName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-tertiary/10 text-tertiary text-[10px] font-label px-2 py-0.5 rounded-full border border-tertiary/20">{post.roleLabel}</span>
                    <span className="text-[10px] font-label text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]" aria-hidden="true">hub</span>
                      {post.score} Score
                    </span>
                    <span className="text-[10px] font-label text-on-surface-variant">{formatRelativeTime(post.createdAt)}</span>
                  </div>
                </div>
              </button>
              <button className="text-on-surface-variant hover:text-primary transition-colors h-10 w-10 rounded-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background" aria-label={`More options for ${post.authorName}`}>
                <span className="material-symbols-outlined" aria-hidden="true">more_horiz</span>
              </button>
            </div>

            {post.insightTitle ? (
              <div className="bg-secondary-container/10 border-l-2 border-secondary p-4 mb-6 rounded-r-lg">
                <p className="font-body text-sm text-on-surface leading-relaxed">
                  <strong className="text-secondary block mb-1 font-headline">{post.insightTitle}:</strong>
                  {post.content}
                </p>
              </div>
            ) : (
              <p className="font-body text-sm text-on-surface leading-relaxed mb-6 pr-4">{post.content}</p>
            )}

            <div className="flex gap-2 flex-wrap mb-4">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-surface-container-lowest border border-outline-variant/20 text-on-surface-variant font-label text-[10px] px-2 py-1 rounded-sm"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="h-16 w-full mb-6 rounded-lg bg-surface-container-lowest border border-outline-variant/10 relative overflow-hidden flex items-end p-1 gap-1">
              {post.chartPoints.map((point, index) => (
                <div
                  key={`${post.id}-chart-${index}`}
                  className={`w-full rounded-t-sm ${index === post.chartPoints.length - 1 ? "bg-secondary shadow-[0_0_10px_rgba(232,179,255,0.5)]" : "bg-secondary/60"}`}
                  style={{ height: `${point}%` }}
                />
              ))}
            </div>

            <div className="rounded-lg bg-surface-container-lowest border border-outline-variant/10 p-4 mb-6">
              <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">Recap</p>
              <p className="font-body text-sm text-on-surface-variant">{post.strategySummary}</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
              <div className="flex gap-3 w-full sm:w-auto">
                <button className="flex-1 sm:flex-none bg-gradient-primary text-on-primary font-headline text-sm font-semibold px-6 py-2.5 rounded-lg shadow-[0_0_20px_-5px_rgba(164,230,255,0.3)] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">bolt</span>
                  One-Tap Invest
                </button>
                <button
                  onClick={() => navigate("/basket-strategy")}
                  className="flex-1 sm:flex-none bg-surface-container-high/50 backdrop-blur-md border border-outline-variant/20 text-on-surface font-headline text-sm px-4 py-2.5 rounded-lg hover:bg-surface-container-high transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Recap
                </button>
              </div>
              <div className="flex items-center gap-4 text-on-surface-variant w-full sm:w-auto justify-end border-t sm:border-t-0 border-outline-variant/10 pt-4 sm:pt-0 relative z-30">
                <button
                  onClick={() => void likePost(post.id)}
                  className="hover:text-tertiary transition-colors flex items-center gap-1 text-xs font-label p-2 cursor-pointer min-h-10 min-w-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">favorite</span>
                  {Intl.NumberFormat("en-US", { notation: "compact" }).format(post.likes)}
                </button>
                <button
                  onClick={() => navigate(`/post-comments?postId=${post.id}`)}
                  className="hover:text-primary transition-colors flex items-center gap-1 text-xs font-label p-2 cursor-pointer min-h-10 min-w-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">chat_bubble</span>
                  {Intl.NumberFormat("en-US", { notation: "compact" }).format(post.commentsCount)}
                </button>
                <button
                  onClick={() => navigate(`/share-strategy?postId=${post.id}`)}
                  className="hover:text-secondary transition-colors flex items-center gap-1 p-2 cursor-pointer min-h-10 min-w-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
                  aria-label={`Share ${post.authorName}'s strategy`}
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">share</span>
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
