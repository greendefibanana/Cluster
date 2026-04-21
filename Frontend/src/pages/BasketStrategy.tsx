export default function BasketStrategy() {
  return (
    <main className="pt-20 md:pt-8 px-4 md:px-8 max-w-7xl mx-auto">
      
{/*  Header Section  */}
<div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-6">
<div>
<div className="flex items-center gap-3 mb-2">
<span className="px-2 py-1 bg-secondary-container/10 border-l-2 border-secondary text-secondary font-label text-xs uppercase tracking-wider">Strategy Basket</span>
<span className="flex items-center gap-1 text-tertiary font-label text-xs">
<span className="material-symbols-outlined text-[14px]">trending_up</span>
                        High Yield
                    </span>
</div>
<h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tighter text-on-surface mb-2">Alpha Swarm Genesis</h1>
<p className="text-on-surface-variant max-w-2xl text-sm leading-relaxed">
                    An AI-managed liquidity basket dynamically rebalancing across top BNB Chain DEXs. Optimized by a 5-agent swarm analyzing social sentiment and on-chain volume.
                </p>
</div>
<div className="flex flex-col items-start md:items-end gap-1">
<span className="text-on-surface-variant font-label text-xs uppercase tracking-widest">Total Value Locked</span>
<span className="font-headline text-3xl font-bold text-primary">$4.2M</span>
</div>
</div>
{/*  Bento Grid Layout  */}
<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
{/*  Left Column: Performance & Agents (8 cols)  */}
<div className="lg:col-span-8 flex flex-col gap-6">
{/*  Performance Overview Card  */}
<div className="bg-surface-container-low rounded-xl p-6 relative overflow-hidden group">
{/*  Subtle ambient glow  */}
<div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/10 transition-colors duration-700"></div>
<h3 className="font-headline text-lg text-on-surface mb-6 flex items-center gap-2">
<span className="material-symbols-outlined text-primary/70">monitoring</span>
                        Performance Metrics
                    </h3>
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
<div className="bg-surface-container p-4 rounded-lg border border-outline-variant/15">
<div className="text-on-surface-variant font-label text-xs uppercase tracking-wider mb-1">24h Change</div>
<div className="font-headline text-xl font-semibold text-tertiary">+2.4%</div>
</div>
<div className="bg-surface-container p-4 rounded-lg border border-outline-variant/15">
<div className="text-on-surface-variant font-label text-xs uppercase tracking-wider mb-1">7d ROI</div>
<div className="font-headline text-xl font-semibold text-tertiary">+12.8%</div>
</div>
<div className="bg-surface-container p-4 rounded-lg border border-outline-variant/15">
<div className="text-on-surface-variant font-label text-xs uppercase tracking-wider mb-1">30d ROI</div>
<div className="font-headline text-xl font-semibold text-tertiary">+45.2%</div>
</div>
<div className="bg-surface-container p-4 rounded-lg border border-outline-variant/15">
<div className="text-on-surface-variant font-label text-xs uppercase tracking-wider mb-1">Risk Score</div>
<div className="font-headline text-xl font-semibold text-secondary">Medium</div>
</div>
</div>
{/*  Placeholder for Chart  */}
<div className="h-64 w-full bg-surface-container-lowest rounded-lg border border-outline-variant/20 flex items-center justify-center relative overflow-hidden">
{/*  Abstract Chart Visual Representation  */}
<div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 19px, #3c494e 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, #3c494e 20px)" }}></div>
<div className="relative z-10 flex flex-col items-center gap-2 text-on-surface-variant/50">
<span className="material-symbols-outlined text-4xl">pie_chart</span>
<span className="font-label text-xs tracking-widest uppercase">Asset Allocation Chart</span>
</div>
{/*  Decorative SVG Line  */}
<svg className="absolute bottom-0 w-full h-full text-primary opacity-30 preserve-3d" preserveAspectRatio="none" viewBox="0 0 100 100">
<path d="M0,80 Q10,70 20,75 T40,60 T60,50 T80,40 T100,20 L100,100 L0,100 Z" fill="url(#grad1)"></path>
<defs>
<linearGradient id="grad1" x1="0%" x2="0%" y1="0%" y2="100%">
<stop offset="0%" style={{ stopColor: "#a4e6ff", stopOpacity: 0.8 }}></stop>
<stop offset="100%" style={{ stopColor: "#131314", stopOpacity: 0 }}></stop>
</linearGradient>
</defs>
</svg>
</div>
</div>
{/*  Swarm Agents List  */}
<div className="bg-surface-container-low rounded-xl p-6">
<h3 className="font-headline text-lg text-on-surface mb-6 flex items-center gap-2">
<span className="material-symbols-outlined text-secondary/70">smart_toy</span>
                        Active Agent Swarm
                    </h3>
<div className="flex flex-col gap-3">
{/*  Agent Item 1  */}
<div className="flex items-center justify-between p-4 bg-surface-container-highest rounded-lg border border-outline-variant/10 hover:border-outline-variant/30 transition-colors">
<div className="flex items-center gap-4">
<div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20">
<span className="material-symbols-outlined text-[20px]">radar</span>
</div>
<div>
<div className="font-headline font-medium text-on-surface">Sentiment Oracle</div>
<div className="font-body text-xs text-on-surface-variant">Scanning Twitter &amp; Telegram for alpha</div>
</div>
</div>
<span className="px-2 py-1 bg-tertiary/10 text-tertiary font-label text-[10px] uppercase tracking-widest rounded-full">Active</span>
</div>
{/*  Agent Item 2  */}
<div className="flex items-center justify-between p-4 bg-surface-container-highest rounded-lg border border-outline-variant/10 hover:border-outline-variant/30 transition-colors">
<div className="flex items-center gap-4">
<div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
<span className="material-symbols-outlined text-[20px]">account_balance</span>
</div>
<div>
<div className="font-headline font-medium text-on-surface">Liquidity Sniper</div>
<div className="font-body text-xs text-on-surface-variant">Executing optimal entry/exit routes</div>
</div>
</div>
<span className="px-2 py-1 bg-tertiary/10 text-tertiary font-label text-[10px] uppercase tracking-widest rounded-full">Active</span>
</div>
</div>
</div>
</div>
{/*  Right Column: Invest Action (4 cols)  */}
<div className="lg:col-span-4 flex flex-col gap-6">
{/*  Investment Action Card  */}
<div className="glass-panel border border-outline-variant/20 rounded-xl p-6 sticky top-24 shadow-[0_8px_32px_rgba(164,230,255,0.05)]">
<h3 className="font-headline text-xl font-bold text-on-surface mb-6">Invest in Basket</h3>
<div className="mb-6">
<label className="font-body text-sm text-on-surface-variant mb-2 block">Amount (BNB)</label>
<div className="relative">
<input className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-4 font-label text-lg text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all shadow-inner" type="text" value="10.5"/>
<button className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-label uppercase tracking-widest text-primary hover:text-primary-container px-2 py-1 bg-primary/10 rounded">Max</button>
</div>
<div className="flex justify-between items-center mt-2 px-1">
<span className="font-label text-xs text-on-surface-variant">Balance: 142.8 BNB</span>
<span className="font-label text-xs text-on-surface-variant">~$3,150.00</span>
</div>
</div>
<div className="bg-surface-container-lowest rounded-lg p-4 mb-6 border border-outline-variant/10">
<div className="flex justify-between items-center mb-2">
<span className="font-body text-sm text-on-surface-variant">Est. Weekly Yield</span>
<span className="font-label text-sm text-tertiary font-medium">~0.42 BNB</span>
</div>
<div className="flex justify-between items-center">
<span className="font-body text-sm text-on-surface-variant">Gas Fee</span>
<span className="font-label text-sm text-on-surface">0.005 BNB</span>
</div>
</div>
<button className="w-full kinetic-gradient text-on-primary font-headline font-bold text-lg py-4 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_0_20px_rgba(164,230,255,0.3)] hover:scale-[1.02] active:scale-95 transition-all duration-200">
                        Execute Strategy
                    </button>
<p className="text-center font-body text-xs text-on-surface-variant mt-4 opacity-70">Smart contract audited by CertiK</p>
</div>
</div>
</div>

    </main>
  );
}
