import { useNavigate } from 'react-router-dom';

export default function EquipSkill() {
  const navigate = useNavigate();

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4">
      
{/*  Blurred Background simulating the Editor  */}
<div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&amp;w=2070&amp;auto=format&amp;fit=crop')] bg-cover bg-center opacity-30 blur-md pointer-events-none" data-alt="Dark, futuristic control panel interface with glowing cyan data streams"></div>
<div className="absolute inset-0 bg-background/80 backdrop-blur-sm pointer-events-none"></div>
{/*  Modal Container (surface-container-highest for top tier pop-over)  */}
<div className="relative z-10 w-full max-w-4xl mx-4 bg-surface-container-highest rounded-xl border border-outline-variant/15 shadow-[0_0_40px_-10px_rgba(164,230,255,0.06)] flex flex-col max-h-[751px] overflow-hidden">
{/*  Header  */}
<div className="flex items-center justify-between p-6 bg-surface-container-low border-b border-outline-variant/15 shrink-0">
<div>
<h2 className="font-headline text-2xl font-bold text-primary flex items-center gap-2">
<span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>extension</span>
                    Equip Skill Module
                </h2>
<p className="font-body text-sm text-on-surface-variant mt-1">Select an NFT skill from your inventory to bind to Agent TBA: <span className="font-label text-primary-fixed-dim">0x8F4...2E1A</span></p>
</div>
<button className="text-on-surface-variant hover:text-primary transition-colors">
<span className="material-symbols-outlined text-2xl">close</span>
</button>
</div>
{/*  Content Area: Bento Grid of Skills  */}
<div className="p-6 overflow-y-auto flex-1 bg-surface-container-low">
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
{/*  Skill Card 1: Selected State  */}
<div 
  onClick={() => navigate('/skill-detail')}
  className="bg-surface-container-high rounded-xl p-5 border border-primary/100 shadow-[0_0_15px_rgba(164,230,255,0.2)] relative cursor-pointer group"
>
<div className="absolute top-4 right-4 text-tertiary">
<span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
</div>
<div className="w-12 h-12 rounded-lg bg-primary-container/20 flex items-center justify-center mb-4 border border-primary/30 text-primary">
<span className="material-symbols-outlined text-2xl">monitoring</span>
</div>
<div className="flex items-center gap-2 mb-2">
<span className="px-2 py-0.5 rounded-full bg-secondary-container/20 text-secondary text-[10px] font-label font-bold uppercase tracking-wider border border-secondary/30">Legendary</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container-lowest text-on-surface-variant text-[10px] font-label border border-outline-variant/20">Lvl 5</span>
</div>
<h3 className="font-headline text-lg font-bold text-on-surface mb-2">Whale Tracker Beta</h3>
<p className="font-body text-sm text-on-surface-variant line-clamp-3">Monitors top 100 wallets for large movements. Triggers alerts and pre-configures sandwich opportunities.</p>
</div>
{/*  Skill Card 2  */}
<div 
  onClick={() => navigate('/skill-detail')}
  className="bg-surface-container rounded-xl p-5 border border-outline-variant/15 hover:bg-surface-container-high hover:border-primary/50 transition-all cursor-pointer group"
>
<div className="w-12 h-12 rounded-lg bg-surface-variant flex items-center justify-center mb-4 text-on-surface">
<span className="material-symbols-outlined text-2xl">bolt</span>
</div>
<div className="flex items-center gap-2 mb-2">
<span className="px-2 py-0.5 rounded-full bg-primary-container/10 text-primary-fixed text-[10px] font-label font-bold uppercase tracking-wider border border-primary/20">Rare</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container-lowest text-on-surface-variant text-[10px] font-label border border-outline-variant/20">Lvl 3</span>
</div>
<h3 className="font-headline text-lg font-bold text-on-surface mb-2">Flash Loan Executor</h3>
<p className="font-body text-sm text-on-surface-variant line-clamp-3">Automates single-block arbitrage paths using Aave flash loans with optimized gas settings.</p>
</div>
{/*  Skill Card 3  */}
<div 
  onClick={() => navigate('/skill-detail')}
  className="bg-surface-container rounded-xl p-5 border border-outline-variant/15 hover:bg-surface-container-high hover:border-primary/50 transition-all cursor-pointer group"
>
<div className="w-12 h-12 rounded-lg bg-surface-variant flex items-center justify-center mb-4 text-on-surface">
<span className="material-symbols-outlined text-2xl">psychology</span>
</div>
<div className="flex items-center gap-2 mb-2">
<span className="px-2 py-0.5 rounded-full bg-tertiary-container/10 text-tertiary text-[10px] font-label font-bold uppercase tracking-wider border border-tertiary/20">Epic</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container-lowest text-on-surface-variant text-[10px] font-label border border-outline-variant/20">Lvl 8</span>
</div>
<h3 className="font-headline text-lg font-bold text-on-surface mb-2">Social Sentiment Engine</h3>
<p className="font-body text-sm text-on-surface-variant line-clamp-3">Ingests Twitter/X and Discord feeds to gauge market sentiment on specific low-cap tokens.</p>
</div>
{/*  Skill Card 4  */}
<div 
  onClick={() => navigate('/skill-detail')}
  className="bg-surface-container rounded-xl p-5 border border-outline-variant/15 hover:bg-surface-container-high hover:border-primary/50 transition-all cursor-pointer group"
>
<div className="w-12 h-12 rounded-lg bg-surface-variant flex items-center justify-center mb-4 text-on-surface">
<span className="material-symbols-outlined text-2xl">shield</span>
</div>
<div className="flex items-center gap-2 mb-2">
<span className="px-2 py-0.5 rounded-full bg-surface-container-lowest text-on-surface-variant text-[10px] font-label border border-outline-variant/20">Common</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container-lowest text-on-surface-variant text-[10px] font-label border border-outline-variant/20">Lvl 1</span>
</div>
<h3 className="font-headline text-lg font-bold text-on-surface mb-2">Basic Slip Guard</h3>
<p className="font-body text-sm text-on-surface-variant line-clamp-3">Automatically adjusts slippage tolerance based on current network congestion and pool liquidity.</p>
</div>
</div>
</div>
{/*  Footer / Action Area  */}
<div className="p-6 bg-surface border-t border-outline-variant/15 flex items-center justify-between shrink-0">
<div className="flex items-center gap-3">
<div className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-2 flex items-center gap-2">
<span className="material-symbols-outlined text-outline text-sm">memory</span>
<span className="font-label text-sm text-on-surface">Slot 2 / 4 Available</span>
</div>
</div>
<div className="flex gap-4">
<button className="px-6 py-2.5 rounded-lg font-body font-medium text-sm text-on-surface bg-surface-container-high border border-outline-variant/20 hover:bg-surface-variant transition-colors">
                    Cancel
                </button>
<button className="px-8 py-2.5 rounded-lg font-headline font-bold text-sm text-on-primary-fixed bg-gradient-to-br from-primary to-primary-container shadow-[inset_0_0_10px_rgba(0,53,67,0.1)] hover:shadow-[0_0_15px_rgba(164,230,255,0.4)] transition-all flex items-center gap-2">
<span className="material-symbols-outlined text-sm">add_link</span>
                    Equip to Slot
                </button>
</div>
</div>
</div>

    </main>
  );
}
