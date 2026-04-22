import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/StateBlocks";
import { formatRelativeTime } from "../lib/format";
import { useAppContext } from "../hooks/useAppContext";

export default function PostComments() {
  const [searchParams] = useSearchParams();
  const [draft, setDraft] = useState("");
  const { feed, comments, addComment, wallet } = useAppContext();
  const postId = searchParams.get("postId") ?? "";
  const post = feed.find((item) => item.id === postId);
  const postComments = comments.filter((item) => item.postId === postId);

  async function handleSubmit() {
    const trimmed = draft.trim();
    if (!trimmed || !post) {
      return;
    }
    
    if (wallet.status !== "connected") {
      alert("Please connect your wallet to post a comment.");
      return;
    }

    try {
      await addComment(post.id, trimmed);
      setDraft("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to publish comment.");
    }
  }

  return (
    <div className="bg-[#131314] text-[#e5e2e3] min-h-screen flex flex-col relative pb-[80px] w-full">
      <main className="flex-1 px-4 pt-4 pb-24 overflow-y-auto max-w-2xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6 pt-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-[#bbc9cf] hover:text-[#a4e6ff] transition-colors font-body text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">arrow_back</span>
            Back to Feed
          </Link>
          <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-[#bbc9cf]">Post Discussion</h2>
        </div>

        {post ? (
          <article className="bg-[#1c1b1c] rounded-xl p-5 mb-6 relative overflow-hidden group border border-[#3c494e]/20">
            <div className="flex justify-between items-start mb-4 relative z-10 text-left">
              <div className="flex items-center gap-3">
                <img alt={`${post.authorName} avatar`} className="w-10 h-10 rounded-lg border border-[#3c494e]/20" src={post.avatarUrl} />
                <div>
                  <h2 className="font-headline font-semibold text-[#e5e2e3] text-base">{post.authorName}</h2>
                  <p className="font-label text-xs text-[#bbc9cf] uppercase tracking-wider text-left">
                    {post.roleLabel} • {formatRelativeTime(post.createdAt)}
                  </p>
                </div>
              </div>
            </div>
            <div className="relative z-10 space-y-3">
              <p className="font-body text-sm text-[#e5e2e3] leading-relaxed text-left">{post.content}</p>
              <div className="flex gap-2 flex-wrap mt-3">
                {post.tags.map((tag) => (
                  <span key={tag} className="bg-[#0e0e0f] border border-[#3c494e]/30 text-[#bbc9cf] font-label text-[10px] px-2 py-1 rounded-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ) : (
          <EmptyState
            title="Post unavailable"
            message="Return to the feed and open another discussion thread."
          />
        )}

        <div className="flex items-center gap-3 mb-6">
          <h3 className="font-headline text-sm font-semibold text-[#bbc9cf] uppercase tracking-widest text-left">Community Intel</h3>
          <div className="h-px flex-1 bg-gradient-to-r from-[#3c494e]/30 to-transparent" />
        </div>

        <section className="space-y-6">
          {postComments.length ? (
            postComments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <img alt={`${comment.authorName} avatar`} className="w-8 h-8 rounded-full border border-[#3c494e]/20 shrink-0" src={comment.avatarUrl} />
                <div className="flex-1">
                  <div className="bg-[#2a2a2b] rounded-xl rounded-tl-none p-3 border border-[#3c494e]/10 text-left">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-headline font-medium text-sm text-[#e5e2e3]">{comment.authorName}</span>
                      <span className="font-label text-[10px] text-[#bbc9cf]">{formatRelativeTime(comment.createdAt)}</span>
                    </div>
                    <p className="font-body text-sm text-[#bbc9cf]">{comment.body}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title="No intel yet"
              message="Be the first to add context to this strategy."
            />
          )}
        </section>
      </main>

      <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 max-w-2xl w-full px-4 py-3 z-40 bg-[#131314]/80 backdrop-blur-sm">
        <div className="bg-[#353436]/40 backdrop-blur-[20px] rounded-xl border border-[#3c494e]/20 p-2 flex items-center gap-2 shadow-[0_-10px_40px_rgba(164,230,255,0.06)]">
          <label htmlFor="comment-draft" className="sr-only">
            Add a comment
          </label>
          <input
            id="comment-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="flex-1 bg-[#0e0e0f] border border-[#3c494e]/20 text-[#e5e2e3] font-label text-sm rounded-lg px-4 py-2.5 focus:border-[#a4e6ff]/100 focus:ring-0 focus:outline-none placeholder-[#bbc9cf]/50 transition-all"
            placeholder="Inject intel..."
            type="text"
          />
          <button
            onClick={() => void handleSubmit()}
            disabled={!draft.trim() || !post}
            className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#a4e6ff] to-[#00d1ff] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(164,230,255,0.2)] active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Send comment"
          >
            <span className="material-symbols-outlined text-[#003543]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
