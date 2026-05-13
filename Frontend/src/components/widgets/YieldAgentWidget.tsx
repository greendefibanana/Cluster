import React from 'react';
import type { ClusterFiWidgetData } from '../../lib/farcaster';
import { demoWidgets, formatCurrency, formatCompact, formatPercent } from '../../lib/farcaster';

export const YieldAgentWidget: React.FC<{ data?: ClusterFiWidgetData }> = ({ data = demoWidgets[1] }) => {
  const avatar = data.agent?.avatar || 'https://placeholder.pics/svg/300';
  const name = data.agent?.name || 'Yield Agent Alpha';
  const role = data.agent?.role || 'Rank: Quant';
  const apy = data.metrics.apy ?? data.metrics.returnPercent;
  return (
    <div className="relative w-full max-w-[600px] aspect-[3/2] rounded-xl overflow-hidden shadow-[0_4px_40px_-10px_rgba(164,230,255,0.06)] bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between p-6">
      {/* Background Image/Texture */}
      <div 
        className="absolute inset-0 z-0 bg-cover opacity-60 mix-blend-luminosity" 
        data-alt="Institutional-grade abstract background featuring isometric 3D vault blocks stacking up symmetrically. The lighting is a blend of soft cinematic blue and subtle warm gold accents, creating an atmosphere of safety and high-end financial technology. Clean, minimal geometric lines intersect across a dark, deep obsidian space. The mood is highly professional, secure, and transparent, aligning perfectly with a modern 'Kinetic Vault' dark-mode aesthetic." 
        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBa6UxXZVKS6ni3uZwp4rx01F3FCZb4UZ4K9530sxfkZL_RGMW9poXHR-JVUnKVJBdWsFg0mDXpl6NHjWNugBjlgUVSmj5TPF2wWRYkSxLOVZreSLHkOOOYynUx8ZbWcJ6hxmN5OPSvQHJVg9a08mH64cTABqTJgSUwLPDHOSK0vXH7xaTWRqiiwD-rpz3j5zVvPu74ExDlTga1eMKjCbA4msLAzFxOZ7JNmP43v62qib-3TwNaYQWTm9W2VHAsqHlevTra2baJ1-0')", backgroundPosition: "center right" }}
      />
      {/* Gradient Overlay for depth */}
      <div className="absolute inset-0 z-0 bg-background/60 backdrop-blur-[2px] shadow-inner" />
      
      {/* Header */}
      <header className="relative z-10 flex justify-between items-start w-full">
        {/* Left: Avatar & Rank */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-outline-variant/30 shadow-[0_0_15px_-3px_rgba(164,230,255,0.3)]">
            <img 
              alt={`${name} avatar`} 
              className="w-full h-full object-cover" 
              data-alt="A sleek, futuristic abstract digital avatar portrait inside a circle. The image features a high-tech, algorithmic face structure rendered in glowing neon cyan lines against a deep black background. It exudes an aura of artificial intelligence and quantitative analysis, fitting perfectly within a sophisticated dark-mode 'Kinetic Vault' theme." 
              src={avatar}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-headline font-bold text-on-surface text-lg leading-tight tracking-tight">{name}</span>
            <span className="font-label text-xs text-primary/80 uppercase tracking-widest">{role}</span>
          </div>
        </div>
        
        {/* Right: Badge */}
        <div className="flex items-center bg-surface-container-highest/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-primary/20 shadow-[0_0_10px_-2px_rgba(164,230,255,0.1)]">
          <span className="material-symbols-outlined text-primary text-[14px] mr-1" data-icon="bolt">bolt</span>
          <span className="font-label text-xs font-semibold text-primary uppercase tracking-wider">Alpha Bridge: {data.metrics.alphaBridge.toFixed(1)}x</span>
        </div>
      </header>
      
      {/* Main Metric Center */}
      <main className="relative z-10 flex flex-col items-center justify-center flex-grow w-full">
        <h1 className="font-display font-extrabold text-5xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#FFF099] drop-shadow-[0_0_20px_rgba(255,215,0,0.4)] tracking-tighter mb-2 drop-shadow-[0_0_30px_rgba(0,0,0,0.8)]">
          {formatPercent(apy)}
        </h1>
        <h2 className="font-label text-sm text-on-surface-variant uppercase tracking-widest opacity-80">APY (Net Yield)</h2>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 flex justify-between items-end w-full">
        {/* Bottom-Left: TVL */}
        <div className="flex items-center gap-2 bg-surface-container/50 backdrop-blur-sm px-4 py-2 rounded-lg border border-outline-variant/15">
          <span className="material-symbols-outlined text-tertiary-fixed-dim" data-icon="shield">shield</span>
          <div className="flex flex-col">
            <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">TVL</span>
            <span className="font-headline font-bold text-on-surface text-base">{formatCurrency(data.metrics.tvl)}</span>
          </div>
        </div>
        
        {/* Bottom-Right: Suppliers */}
        <div className="flex items-center gap-2 bg-surface-container/50 backdrop-blur-sm px-4 py-2 rounded-lg border border-outline-variant/15">
          <div className="flex flex-col items-end">
            <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Suppliers</span>
            <span className="font-headline font-bold text-on-surface text-base">{formatCompact(data.metrics.suppliers)}</span>
          </div>
          <span className="material-symbols-outlined text-secondary" data-icon="hub">hub</span>
        </div>
      </footer>
    </div>
  );
};
