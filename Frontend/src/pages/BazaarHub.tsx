import { useState } from 'react';
import { mintSkill } from '../lib/web3';
import { useAppContext } from '../hooks/useAppContext';

export default function BazaarHub() {
  const { wallet, refreshApp } = useAppContext();
  const [mintingId, setMintingId] = useState<number | null>(null);

  const handleMintSkill = async (skillId: number) => {
    if (!wallet.account) {
      alert("Please connect wallet first");
      return;
    }
    setMintingId(skillId);
    try {
      await mintSkill(wallet.account, skillId, 1);
      alert(`Skill NFT ${skillId} minted successfully!`);
      await refreshApp();
    } catch (e: any) {
      alert("Mint failed: " + e.message);
    } finally {
      setMintingId(null);
    }
  };

  return (
    <main className="flex-1 w-full p-4 md:p-8 md:pt-24 mt-16 md:mt-0 flex flex-col gap-8 max-w-7xl mx-auto">
      
{/*  Marketplace Tabs  */}
<section className="flex flex-wrap gap-4 bg-surface-container-low p-2 rounded-xl border border-outline-variant/15 w-fit">
<button className="px-6 py-2 rounded-lg bg-surface-container-highest border border-primary/20 text-primary font-label text-sm tracking-wide kinetic-shadow">
                Skills
            </button>
<button className="px-6 py-2 rounded-lg text-on-surface-variant hover:text-on-surface font-label text-sm tracking-wide transition-colors">
                Agents
            </button>
<button className="px-6 py-2 rounded-lg text-on-surface-variant hover:text-on-surface font-label text-sm tracking-wide transition-colors">
                Baskets
            </button>
</section>
{/*  Skill Shop Area (Bento Grid)  */}
<section className="flex flex-col gap-6">
<header className="flex justify-between items-end mb-2">
<div>
<h2 className="font-headline text-headline-md text-on-surface">Skill Shop</h2>
<p className="font-body text-body-md text-on-surface-variant mt-1">Acquire execution modules for your agents.</p>
</div>
<button className="flex items-center gap-2 text-primary font-label text-sm hover:text-primary-container transition-colors">
                    View All <span className="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
</button>
</header>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
{/*  Skill Card 1  */}
<article className="bg-surface-container-high rounded-xl p-5 border border-outline-variant/20 flex flex-col gap-4 relative overflow-hidden group">
<div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-10 -mt-10 blur-2xl"></div>
<div className="flex justify-between items-start z-10">
<div className="w-12 h-12 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-center">
<span className="material-symbols-outlined text-primary text-2xl" data-icon="bolt" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
</div>
<div className="bg-tertiary/10 text-tertiary font-label text-xs px-2 py-1 rounded-full border border-tertiary/20 flex items-center gap-1">
<span className="material-symbols-outlined text-[12px]" data-icon="trending_up">trending_up</span> Top Rated
                        </div>
</div>
<div className="z-10">
<h3 className="font-headline text-lg font-semibold text-on-surface">Advanced Perps v2</h3>
<p className="font-body text-sm text-on-surface-variant mt-1 line-clamp-2">High-frequency perpetual trading module optimized for Binance Smart Chain liquidity pools.</p>
</div>
<div className="grid grid-cols-2 gap-4 mt-2 z-10">
<div className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/10">
<p className="font-label text-xs text-on-surface-variant uppercase tracking-wider mb-1">Win Rate</p>
<p className="font-headline text-tertiary text-lg">68.4%</p>
</div>
<div className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/10">
<p className="font-label text-xs text-on-surface-variant uppercase tracking-wider mb-1">Executions</p>
<p className="font-headline text-on-surface text-lg">12.4k</p>
</div>
</div>
<div className="mt-auto pt-4 flex items-center justify-between border-t border-outline-variant/10 z-10">
<div className="flex items-baseline gap-1">
<span className="font-headline text-xl font-bold text-primary">Free</span>
</div>
<button 
  onClick={() => handleMintSkill(1)}
  disabled={mintingId === 1}
  className="kinetic-btn px-4 py-2 rounded-md font-label text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
>
                            {mintingId === 1 ? "Minting..." : "Mint"} <span className="material-symbols-outlined text-[16px]" data-icon="shopping_cart">shopping_cart</span>
</button>
</div>
</article>
{/*  Skill Card 2  */}
<article className="bg-surface-container-high rounded-xl p-5 border border-outline-variant/20 flex flex-col gap-4 relative overflow-hidden">
<div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-bl-full -mr-10 -mt-10 blur-2xl"></div>
<div className="flex justify-between items-start z-10">
<div className="w-12 h-12 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-center">
<span className="material-symbols-outlined text-secondary text-2xl" data-icon="sync_alt">sync_alt</span>
</div>
</div>
<div className="z-10">
<h3 className="font-headline text-lg font-semibold text-on-surface">Flash Loan Arbitrage</h3>
<p className="font-body text-sm text-on-surface-variant mt-1 line-clamp-2">Identifies and executes zero-risk arbitrage opportunities across major DEXs instantly.</p>
</div>
<div className="grid grid-cols-2 gap-4 mt-2 z-10">
<div className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/10">
<p className="font-label text-xs text-on-surface-variant uppercase tracking-wider mb-1">Win Rate</p>
<p className="font-headline text-tertiary text-lg">99.1%</p>
</div>
<div className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/10">
<p className="font-label text-xs text-on-surface-variant uppercase tracking-wider mb-1">Avg Profit</p>
<p className="font-headline text-on-surface text-lg">$4.12</p>
</div>
</div>
<div className="mt-auto pt-4 flex items-center justify-between border-t border-outline-variant/10 z-10">
<div className="flex items-baseline gap-1">
<span className="font-headline text-xl font-bold text-primary">Free</span>
</div>
<button 
  onClick={() => handleMintSkill(2)}
  disabled={mintingId === 2}
  className="kinetic-btn px-4 py-2 rounded-md font-label text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
>
                            {mintingId === 2 ? "Minting..." : "Mint"} <span className="material-symbols-outlined text-[16px]" data-icon="shopping_cart">shopping_cart</span>
</button>
</div>
</article>
{/*  Skill Card 3 (AI Insight Style)  */}
<article className="bg-surface-container-high rounded-xl p-5 border-l-2 border-l-secondary border-y border-r border-outline-variant/20 bg-secondary-container/10 flex flex-col gap-4 relative overflow-hidden">
<div className="flex justify-between items-start z-10">
<div className="w-12 h-12 rounded-lg bg-surface-container-lowest border border-secondary/30 flex items-center justify-center">
<span className="material-symbols-outlined text-secondary text-2xl" data-icon="auto_awesome" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
</div>
<div className="bg-secondary/10 text-secondary font-label text-xs px-2 py-1 rounded-full border border-secondary/20">
                            AI Generated
                        </div>
</div>
<div className="z-10">
<h3 className="font-headline text-lg font-semibold text-on-surface">Sentiment Sniper</h3>
<p className="font-body text-sm text-on-surface-variant mt-1 line-clamp-2">Scans social signals to front-run micro-cap token launches with high probability.</p>
</div>
<div className="grid grid-cols-2 gap-4 mt-2 z-10">
<div className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/10">
<p className="font-label text-xs text-on-surface-variant uppercase tracking-wider mb-1">Risk Level</p>
<p className="font-headline text-[#ffb4ab] text-lg">High</p>
</div>
<div className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/10">
<p className="font-label text-xs text-on-surface-variant uppercase tracking-wider mb-1">Signals/Day</p>
<p className="font-headline text-on-surface text-lg">~14</p>
</div>
</div>
<div className="mt-auto pt-4 flex items-center justify-between border-t border-outline-variant/10 z-10">
<div className="flex items-baseline gap-1">
<span className="font-headline text-xl font-bold text-primary">Free</span>
</div>
<button 
  onClick={() => handleMintSkill(3)}
  disabled={mintingId === 3}
  className="kinetic-btn px-4 py-2 rounded-md font-label text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
>
                            {mintingId === 3 ? "Minting..." : "Mint"} <span className="material-symbols-outlined text-[16px]" data-icon="shopping_cart">shopping_cart</span>
</button>
</div>
</article>
</div>
</section>

    </main>
  );
}
