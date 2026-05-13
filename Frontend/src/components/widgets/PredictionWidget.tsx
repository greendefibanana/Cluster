import React from 'react';
import type { ClusterFiWidgetData } from '../../lib/farcaster';
import { demoWidgets, formatCurrency, formatCompact, formatPercent } from '../../lib/farcaster';

export const PredictionWidget: React.FC<{ data?: ClusterFiWidgetData }> = ({ data = demoWidgets[0] }) => {
  const avatar = data.agent?.avatar || 'https://placeholder.pics/svg/300';
  const name = data.agent?.name || 'Nexus Protocol';
  const role = data.agent?.role || 'Rank: Oracle';
  const bridge = `${data.metrics.alphaBridge.toFixed(1)}x`;
  const wins = data.metrics.predictionWins || 5;
  return (
    <div className="farcaster-frame rounded-xl border border-outline-variant/20 shadow-[0_0_40px_-10px_rgba(164,230,255,0.06)] relative isolate aspect-[3/2] flex flex-col" style={{ aspectRatio: '3/2', height: 'auto' }}>
      {/* Background Layer: Grid & Faded Cards */}
      <div className="absolute inset-0 bg-grid-overlay opacity-20 z-0"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-surface/90 via-surface/70 to-surface z-0 pointer-events-none"></div>
      
      {/* Repositioned & Faded Prediction Background Elements */}
      <div className="absolute top-[15%] left-[5%] -rotate-12 opacity-[0.03] z-0 bg-surface-container-high border border-outline-variant/30 rounded-lg p-2 flex items-center gap-2">
        <span className="font-label text-[10px] text-on-surface">BTC &gt; $60k</span>
        <span className="material-symbols-outlined text-tertiary text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
      </div>
      <div className="absolute top-[20%] right-[5%] rotate-6 opacity-[0.03] z-0 bg-surface-container-high border border-outline-variant/30 rounded-lg p-2 flex items-center gap-2">
        <span className="font-label text-[10px] text-on-surface">SOL Breakout</span>
        <span className="material-symbols-outlined text-tertiary text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
      </div>
      <div className="absolute bottom-[20%] left-[10%] -rotate-6 opacity-[0.02] z-0 bg-surface-container-high border border-outline-variant/30 rounded-lg p-2 flex items-center gap-2">
        <span className="font-label text-[10px] text-on-surface">ETH Dominance</span>
        <span className="material-symbols-outlined text-tertiary text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
      </div>
      
      {/* Foreground Content Layer */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between p-5 sm:p-6">
        {/* Header: Agent Stats */}
        <div className="flex justify-between items-start w-full">
          {/* Top-left: Avatar & Rank */}
          <div className="flex items-center gap-2.5 bg-surface-container-low/40 backdrop-blur-2xl border border-outline-variant/30 rounded-xl p-1.5 pr-3 shadow-xl">
            <div className="relative">
              <img alt={`${name} avatar`} className="w-9 h-9 rounded-full border-2 border-primary object-cover" src={avatar} />
              {data.agent?.verified ? <div className="absolute -bottom-0.5 -right-0.5 bg-surface rounded-full p-0.5">
                <span className="material-symbols-outlined text-primary text-[8px] flex" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              </div> : null}
            </div>
            <div className="flex flex-col">
              <span className="font-headline font-bold text-on-surface text-xs tracking-wide leading-none mb-0.5">{name}</span>
              <span className="font-label text-primary text-[8px] uppercase tracking-widest leading-none">{role}</span>
            </div>
          </div>
          {/* Top-right: Tag */}
          <div className="bg-surface-container-highest/60 backdrop-blur-xl border border-outline-variant/30 rounded-full px-2.5 py-1 flex items-center gap-1 shadow-md">
            <span className="material-symbols-outlined text-tertiary text-[10px]">bolt</span>
            <span className="font-label text-on-surface text-[10px] font-semibold tracking-wider">Alpha Bridge: {bridge}</span>
          </div>
        </div>
        
        {/* Main Metric: Center Aligned */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center relative">
            {/* Refined background glow */}
            <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full scale-150"></div>
            <h1 className="font-display text-5xl sm:text-6xl font-extrabold text-primary-container tracking-tighter glow-text-primary relative z-10 leading-none">
              {formatPercent(data.metrics.returnPercent)}
            </h1>
            <p className="font-headline text-base sm:text-lg text-on-surface/90 mt-1 tracking-wide font-medium relative z-10">
              on {wins}/5 Predictions
            </p>
          </div>
        </div>
        
        {/* Proof Icons Footer */}
        <div className="flex justify-center items-center gap-3 sm:gap-4 w-full">
          {/* TVL */}
          <div className="flex items-center gap-2 bg-surface-container-low/60 backdrop-blur-2xl border border-outline-variant/30 rounded-lg px-3 py-1.5 shadow-lg">
            <span className="material-symbols-outlined text-secondary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
            <span className="font-label text-on-surface text-xs tracking-wide">TVL: {formatCurrency(data.metrics.tvl)}</span>
          </div>
          {/* Users */}
          <div className="flex items-center gap-2 bg-surface-container-low/60 backdrop-blur-2xl border border-outline-variant/30 rounded-lg px-3 py-1.5 shadow-lg">
            <span className="material-symbols-outlined text-secondary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
            <span className="font-label text-on-surface text-xs tracking-wide">{formatCompact(data.metrics.investors)} Investors</span>
          </div>
        </div>
      </div>
    </div>
  );
};
