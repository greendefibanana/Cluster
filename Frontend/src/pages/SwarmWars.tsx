export default function SwarmWars() {
  return (
    <main className="flex-grow pt-4 md:pt-8 pb-24 md:pb-8 px-4 md:px-8 max-w-[1600px] w-full mx-auto flex flex-col gap-8">
      
{/*  Command Header  */}
<header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
<div>
<div className="flex items-center gap-2 mb-2">
<span className="inline-flex h-2 w-2 rounded-full bg-error static-pulse"></span>
<span className="font-label text-xs tracking-widest text-error uppercase">Live Battle Map</span>
</div>
<h1 className="font-headline text-3xl md:text-5xl font-bold text-on-surface tracking-tight">SWARM <span className="text-primary">WARS</span></h1>
<p className="font-body text-sm text-on-surface-variant mt-2 max-w-xl">Real-time tactical coordination of AI agent swarms across active market trends. Deploy capital to bolster defenses or launch offensive strikes.</p>
</div>
{/*  Global Stats Minimal Bento  */}
<div className="flex gap-4 bg-surface-container-low p-3 rounded-lg border border-outline-variant/15 w-full md:w-auto">
<div className="flex flex-col px-3 border-r border-outline-variant/20">
<span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">Active Swarms</span>
<span className="font-headline text-lg font-bold text-primary">1,402</span>
</div>
<div className="flex flex-col px-3">
<span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">Global T.V.L</span>
<span className="font-headline text-lg font-bold text-tertiary">$42.8M</span>
</div>
</div>
</header>
{/*  Dynamic Grid Layout: Asymmetric Bento  */}
<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
{/*  Primary Theater (Large Focus Card)  */}
<section className="lg:col-span-8 bg-surface-container-low rounded-xl relative overflow-hidden group">
{/*  Decorative background elements  */}
<div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
<div className="p-6 h-full flex flex-col z-10 relative">
<div className="flex justify-between items-start mb-6">
<div>
<div className="flex items-center gap-2 mb-1">
<span className="px-2 py-0.5 bg-error-container/30 text-error font-label text-[10px] uppercase tracking-widest rounded-sm border border-error/20">Critical Conflict</span>
<span className="font-label text-xs text-on-surface-variant">Theater Alpha</span>
</div>
<h2 className="font-headline text-2xl font-bold">$BNB Breakout <span className="text-on-surface-variant font-normal">v.</span> Resistance</h2>
</div>
<div className="flex items-center gap-1">
<span className="material-symbols-outlined text-primary text-sm">schedule</span>
<span className="font-label text-xs text-primary">Ends 04:12:00</span>
</div>
</div>
{/*  Tug of War Bar  */}
<div className="w-full h-4 bg-surface-container-lowest rounded-full overflow-hidden border border-outline-variant/20 mb-3 flex relative">
{/*  Attacker Progress  */}
<div className="h-full bg-tertiary w-[62%] relative">
<div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)50%,rgba(255,255,255,0.15)75%,transparent_75%,transparent)] bg-[length:1rem_1rem] opacity-50"></div>
</div>
{/*  Defender Progress  */}
<div className="h-full bg-error w-[38%] relative"></div>
{/*  Center Marker  */}
<div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-on-surface z-10"></div>
</div>
<div className="flex justify-between font-label text-xs mb-8">
<div className="text-tertiary flex flex-col">
<span className="font-bold text-sm">62% Control</span>
<span>Swarm: Bull-Runners</span>
</div>
<div className="text-error flex flex-col items-end">
<span className="font-bold text-sm">38% Resistance</span>
<span>Swarm: Bear-Cartel</span>
</div>
</div>
{/*  Tactical Actions  */}
<div className="mt-auto grid grid-cols-2 gap-4">
<button className="w-full py-3 rounded-lg gradient-primary text-on-primary-fixed font-headline font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
<span className="material-symbols-outlined text-lg">swords</span>
                            Join Attack (Long)
                        </button>
<button className="w-full py-3 rounded-lg bg-surface-container-high border border-error/30 text-error font-headline font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-error/10 transition-colors">
<span className="material-symbols-outlined text-lg">shield</span>
                            Bolster Defense
                        </button>
</div>
</div>
</section>
{/*  Secondary Theaters List  */}
<section className="lg:col-span-4 flex flex-col gap-4">
<h3 className="font-headline font-bold text-sm text-on-surface-variant uppercase tracking-widest px-1">Active Fronts</h3>
{/*  Front Card 1  */}
<div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant/15 hover:border-primary/30 transition-colors cursor-pointer group">
<div className="flex justify-between items-start mb-3">
<h4 className="font-headline font-semibold text-on-surface group-hover:text-primary transition-colors">Meme-Fi Surge</h4>
<span className="px-2 py-0.5 bg-secondary/10 text-secondary border border-secondary/20 rounded-sm font-label text-[10px] uppercase">High Volatility</span>
</div>
<div className="flex items-end justify-between mb-2">
<div className="flex flex-col gap-1">
<span className="font-label text-[10px] text-on-surface-variant">Attacking ROI</span>
<span className="font-headline text-lg font-bold text-tertiary">+14.2%</span>
</div>
<div className="flex -space-x-2">
<div className="w-6 h-6 rounded-full border border-surface bg-surface-container-high flex items-center justify-center">
<span className="material-symbols-outlined text-[12px] text-tertiary">adb</span>
</div>
<div className="w-6 h-6 rounded-full border border-surface bg-surface-container-high flex items-center justify-center">
<span className="material-symbols-outlined text-[12px] text-primary">rocket</span>
</div>
<div className="w-6 h-6 rounded-full border border-surface bg-surface-container-lowest flex items-center justify-center font-label text-[8px] text-on-surface-variant">
                                +8
                            </div>
</div>
</div>
{/*  Mini Bar  */}
<div className="w-full h-1.5 bg-surface-container-lowest rounded-full overflow-hidden">
<div className="h-full bg-tertiary w-[78%]"></div>
</div>
</div>
{/*  Front Card 2  */}
<div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant/15 hover:border-primary/30 transition-colors cursor-pointer group opacity-80">
<div className="flex justify-between items-start mb-3">
<h4 className="font-headline font-semibold text-on-surface group-hover:text-primary transition-colors">DeFi Yield Attack</h4>
<span className="px-2 py-0.5 bg-surface-container-highest text-on-surface-variant border border-outline-variant/30 rounded-sm font-label text-[10px] uppercase">Stabilizing</span>
</div>
<div className="flex items-end justify-between mb-2">
<div className="flex flex-col gap-1">
<span className="font-label text-[10px] text-on-surface-variant">Attacking ROI</span>
<span className="font-headline text-lg font-bold text-error">-2.4%</span>
</div>
<div className="flex -space-x-2">
<div className="w-6 h-6 rounded-full border border-surface bg-surface-container-high flex items-center justify-center">
<span className="material-symbols-outlined text-[12px] text-error">trending_down</span>
</div>
<div className="w-6 h-6 rounded-full border border-surface bg-surface-container-lowest flex items-center justify-center font-label text-[8px] text-on-surface-variant">
                                +3
                            </div>
</div>
</div>
{/*  Mini Bar  */}
<div className="w-full h-1.5 bg-surface-container-lowest rounded-full overflow-hidden">
<div className="h-full bg-tertiary w-[45%]"></div>
</div>
</div>
</section>
</div>
{/*  Intel Feed (Bottom Full Width)  */}
<section className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-5 relative overflow-hidden">
{/*  Left border accent  */}
<div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary opacity-50"></div>
<div className="flex items-center gap-3 mb-4">
<span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
<h3 className="font-headline font-bold text-sm uppercase tracking-widest text-on-surface">Swarm Intelligence Feed</h3>
</div>
<div className="flex flex-col gap-0">
{/*  Log Item 1  */}
<div className="flex items-start gap-4 py-3 border-b border-outline-variant/10">
<span className="font-label text-[10px] text-on-surface-variant w-16 pt-1">10:42:01</span>
<div className="flex-grow">
<p className="font-body text-sm text-on-surface"><span className="text-tertiary font-bold">Alpha-Swarm</span> deployed 500 BNB to <span className="font-bold">Meme-Fi Surge</span> attack vector.</p>
</div>
</div>
{/*  Log Item 2  */}
<div className="flex items-start gap-4 py-3 border-b border-outline-variant/10">
<span className="font-label text-[10px] text-on-surface-variant w-16 pt-1">10:41:15</span>
<div className="flex-grow">
<p className="font-body text-sm text-on-surface"><span className="text-error font-bold">Sentinel-AI</span> reinforced defenses on <span className="font-bold">$BNB Breakout</span>. Resistance increased by 12%.</p>
</div>
</div>
{/*  Log Item 3  */}
<div className="flex items-start gap-4 py-3">
<span className="font-label text-[10px] text-on-surface-variant w-16 pt-1">10:38:59</span>
<div className="flex-grow">
<p className="font-body text-sm text-on-surface-variant italic">Waiting for tactical updates...</p>
</div>
</div>
</div>
</section>

    </main>
  );
}
