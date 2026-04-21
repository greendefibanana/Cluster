import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { copyToClipboard } from "../lib/format";
import { useAppContext } from "../hooks/useAppContext";

export default function ShareStrategy() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { feed } = useAppContext();
  const [copied, setCopied] = useState(false);

  const postId = searchParams.get("postId") ?? "";
  const post = feed.find((item) => item.id === postId);
  const shareUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.pathname = "/";
    url.search = `share=${postId}`;
    return url.toString();
  }, [postId]);

  async function handleCopy() {
    await copyToClipboard(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-background text-on-surface min-h-screen relative overflow-hidden flex items-end justify-center">
      <div className="absolute inset-0 p-6 opacity-30 pointer-events-none">
        <h1 className="font-headline text-3xl mb-4 text-on-surface">ClustrFi Dashboard</h1>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 bg-surface-container-low rounded-lg" />
          <div className="h-32 bg-surface-container-low rounded-lg" />
        </div>
      </div>

      <button
        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-md transition-opacity cursor-pointer"
        onClick={() => navigate(-1)}
        aria-label="Close share sheet"
      />

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 flex justify-center pb-0 md:pb-6 px-4">
        <div className="w-full bg-surface-variant/40 backdrop-blur-[20px] rounded-t-[1.5rem] md:rounded-[1.5rem] shadow-[0_-10px_40px_rgba(164,230,255,0.06)] border border-outline-variant/15 flex flex-col pt-3 pb-8 px-6 transform transition-transform animate-in slide-in-from-bottom duration-300">
          <div className="w-12 h-1.5 bg-outline-variant/40 rounded-full mx-auto mb-6" />

          <div className="flex justify-between items-center mb-6">
            <h2 className="font-headline text-xl text-on-surface font-bold tracking-tight text-left">Share Strategy</h2>
            <button
              onClick={() => navigate(-1)}
              className="text-outline hover:text-primary transition-colors h-10 w-10 flex items-center justify-center rounded-full bg-surface-container-highest/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Close share strategy"
            >
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>

          {post ? (
            <div className="mb-6 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 text-left">
              <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">{post.authorName}</p>
              <p className="font-body text-sm text-on-surface">{post.strategySummary}</p>
            </div>
          ) : null}

          <div className="flex justify-between items-center mb-8 px-2">
            {[
              { icon: "tag", label: "X" },
              { icon: "send", label: "Telegram" },
              { icon: "forum", label: "Discord" },
              { icon: "hub", label: "Farcaster" },
            ].map((social) => (
              <button
                key={social.label}
                className="flex flex-col items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
              >
                <div className="w-14 h-14 rounded-full bg-surface-container-highest/60 flex items-center justify-center border border-outline-variant/20 group-hover:border-primary/50 transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-2xl" aria-hidden="true">{social.icon}</span>
                </div>
                <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">{social.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => void handleCopy()}
            className="w-full py-4 mb-4 bg-gradient-to-br from-primary to-primary-container text-on-primary font-body font-bold rounded-lg shadow-[0_0_20px_rgba(164,230,255,0.15)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="material-symbols-outlined group-hover:scale-110 transition-transform" aria-hidden="true">link</span>
            {copied ? "Strategy Link Copied" : "Copy Strategy Link"}
          </button>

          <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-3 font-label text-xs text-on-surface-variant break-all">
            {shareUrl}
          </div>
        </div>
      </div>
    </div>
  );
}
