import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppContext } from "../hooks/useAppContext";
import { mintSkill } from "../lib/web3";

export default function SkillDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { skills, agents, wallet, refreshApp } = useAppContext();
  const [minting, setMinting] = useState(false);

  const skillId = searchParams.get("skillId") ?? "";
  const skill = skills.find((item) => item.id === skillId) ?? skills[0];

  const handleMintSkill = async () => {
    if (!wallet.account) {
      alert("Please connect wallet first");
      return;
    }
    if (!skill) return;

    setMinting(true);
    try {
      await mintSkill(wallet.account, Number(skill.id), 1);
      alert("Skill minted successfully!");
      await refreshApp();
    } catch (e: any) {
      console.error("Mint failed", e);
      alert("Mint failed: " + e.message);
    } finally {
      setMinting(false);
    }
  };

  const compatibleAgents = agents.filter((agent) =>
    agent.skills.some((slot) => slot.capabilityTag === skill?.capabilityTag || slot.name.toLowerCase().includes(skill?.name.split(" ")[0].toLowerCase() ?? "")),
  );

  if (!skill) {
    return (
      <main className="flex-1 p-8 flex items-center justify-center">
        <div className="text-zinc-500">Construct not found.</div>
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full flex flex-col gap-6 mb-24">
      <div className="flex items-center gap-4 mb-2">
        <button
          onClick={() => navigate("/skills")}
          className="text-zinc-400 hover:text-white transition-colors p-2 rounded-lg active:scale-95 duration-100 flex items-center justify-center bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="material-symbols-outlined text-[#00d1ff]" aria-hidden="true">arrow_back</span>
        </button>
        <div>
          <h1 className="text-xl font-black tracking-tighter text-[#00d1ff] uppercase">Skill Detail</h1>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">{skill.name}</p>
        </div>
      </div>

      <section className="relative rounded-2xl overflow-hidden glass-panel ambient-shadow border border-white/10">
        <img alt={`${skill.name} visual`} className="w-full h-64 object-cover opacity-70 mix-blend-screen" src={skill.visualUrl} />
        <div className="absolute top-4 right-4 bg-[#00d1ff]/20 border border-[#00d1ff]/30 text-[#00d1ff] px-3 py-1.5 rounded-full text-xs font-bold tracking-widest flex items-center gap-1.5 backdrop-blur-md uppercase">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">star</span>
          {skill.rarity}
        </div>
        <div className="p-6 relative z-10 bg-gradient-to-t from-[#131314] via-[#131314]/80 to-transparent mt-[-80px]">
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight drop-shadow-md">{skill.name}</h2>
          <p className="text-[#00d1ff] text-sm font-medium tracking-wide uppercase">{skill.category}</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="col-span-2 glass-card rounded-xl p-5 flex justify-between items-center relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#00d1ff] shadow-[0_0_15px_#00d1ff]" />
          <div>
            <p className="text-zinc-400 text-xs mb-1 tracking-widest uppercase font-medium">Alpha Score</p>
            <p className="text-4xl font-black text-white tracking-tighter">{skill.alphaScore}</p>
          </div>
          <div className="text-right">
            <span className="material-symbols-outlined text-[#00d1ff] text-5xl opacity-80 group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(0,209,255,0.5)]" aria-hidden="true">trending_up</span>
          </div>
        </div>
        <div className="glass-card rounded-xl p-5 flex flex-col justify-center">
          <p className="text-zinc-400 text-xs mb-1.5 tracking-widest uppercase font-medium">Price</p>
          <p className="text-xl font-bold text-[#00d1ff]">{skill.priceLabel}</p>
        </div>
        <div className="glass-card rounded-xl p-5 flex flex-col justify-center">
          <p className="text-zinc-400 text-xs mb-1.5 tracking-widest uppercase font-medium">Views</p>
          <p className="text-xl font-bold text-white">{skill.views}</p>
        </div>
      </section>

      <section className="glass-card border-l-2 border-l-[#00d1ff] rounded-r-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00d1ff]/5 rounded-full blur-2xl -mt-10 -mr-10" />
        <h3 className="text-lg text-white mb-3 flex items-center gap-2 font-bold tracking-wide">
          <span className="material-symbols-outlined text-[#00d1ff] text-base" aria-hidden="true">psychology</span>
          Alpha Strategy
        </h3>
        <p className="text-sm text-zinc-300 leading-relaxed font-medium relative z-10">{skill.description}</p>
      </section>

      <section className="glass-card rounded-xl p-6">
        <h3 className="text-xs text-zinc-400 mb-4 uppercase tracking-widest font-bold">Equippable Agents</h3>
        <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide">
          {compatibleAgents.map((agent) => (
            <button key={agent.id} onClick={() => navigate(`/agent-detail?agentId=${agent.id}`)} className="flex flex-col items-center gap-3 min-w-[64px] group cursor-pointer">
              <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-[#00d1ff]/50 group-hover:bg-[#00d1ff]/10 transition-all overflow-hidden">
                <img alt={agent.name} className="w-full h-full object-cover" src={agent.avatarUrl} />
              </div>
              <span className="text-[11px] text-zinc-300 text-center font-bold tracking-wide">{agent.name}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="fixed bottom-0 left-0 w-full p-5 bg-[#131314]/95 backdrop-blur-xl border-t border-white/10 flex justify-between items-center z-40 pb-safe md:pb-5">
        <div className="flex flex-col">
          <span className="text-xs text-zinc-400 font-medium tracking-widest uppercase mb-0.5">Mint Cost</span>
          <span className="font-black text-2xl text-white tracking-tighter">{skill.priceLabel}</span>
        </div>
        <button 
          onClick={handleMintSkill}
          disabled={minting}
          className="bg-[#00D1FF] text-[#131314] font-bold py-3.5 px-7 rounded-xl flex items-center gap-2 shadow-[0_0_20px_#00D1FF] hover:shadow-[0_0_30px_#00D1FF] transition-all uppercase tracking-wide text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">shopping_cart_checkout</span>
          {minting ? "Minting..." : "Mint Now"}
        </button>
      </div>
    </main>
  );
}
