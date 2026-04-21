import { useDeferredValue, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../hooks/useAppContext";

const categories = ["All Skills", "Execution", "DeFi", "Social Graph"];

export default function Skills() {
  const navigate = useNavigate();
  const { skills } = useAppContext();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Skills");
  const deferredQuery = useDeferredValue(query);

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      const matchesCategory = category === "All Skills" || skill.category === category;
      const normalized = deferredQuery.trim().toLowerCase();
      const matchesQuery =
        !normalized ||
        skill.name.toLowerCase().includes(normalized) ||
        skill.description.toLowerCase().includes(normalized) ||
        skill.creatorAddress.toLowerCase().includes(normalized);

      return matchesCategory && matchesQuery;
    });
  }, [skills, category, deferredQuery]);

  const [featuredSkill, ...restSkills] = filteredSkills;

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-3xl md:text-5xl font-headline font-bold text-on-surface mb-2">Skill Marketplace</h2>
          <p className="text-on-surface-variant font-body text-sm md:text-base max-w-2xl">
            Acquire hyper-specialized AI trading and social models. Integrate them into your vault for kinetic alpha generation.
          </p>
        </div>
        <div className="relative w-full max-w-3xl">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-primary/70" aria-hidden="true">search</span>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant/20 text-on-surface rounded-lg pl-12 pr-4 py-4 font-label text-sm md:text-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[0_0_15px_rgba(164,230,255,0.2)] transition-all placeholder-on-surface-variant/50"
            placeholder="Search by model name, utility, or creator address..."
            type="text"
          />
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 pt-1">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`whitespace-nowrap px-6 py-2 rounded-full font-headline text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${category === item ? "bg-[#4cd6ff] text-[#001f28] font-bold shadow-[0_0_15px_rgba(76,214,255,0.3)]" : "bg-surface-container text-on-surface-variant border border-outline-variant/20 font-medium hover:bg-surface-variant hover:text-on-surface"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {featuredSkill ? (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 relative rounded-xl overflow-hidden glass-panel flex flex-col md:flex-row min-h-[300px] ghost-border">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-secondary/20 rounded-full blur-[80px] pointer-events-none" />
            <button
              className="w-full md:w-2/5 h-48 md:h-full relative overflow-hidden bg-surface-container-low border-r border-outline-variant/15 flex-shrink-0 cursor-pointer group text-left"
              onClick={() => navigate(`/skill-detail?skillId=${featuredSkill.id}`)}
            >
              <img alt={`${featuredSkill.name} visual`} className="w-full h-full object-cover opacity-80 mix-blend-screen transition-transform duration-500 group-hover:scale-110" src={featuredSkill.visualUrl} />
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent md:bg-gradient-to-r md:from-transparent md:to-surface-variant/80" />
              <div className="absolute top-4 left-4 bg-tertiary text-on-tertiary px-3 py-1 rounded-full font-headline text-xs font-bold shadow-[0_0_20px_rgba(0,249,190,0.4)] flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">local_fire_department</span>
                {featuredSkill.rarity}
              </div>
            </button>
            <div className="flex-1 p-6 flex flex-col justify-between relative z-10">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-secondary font-headline text-xs uppercase tracking-widest border border-secondary/30 px-2 py-0.5 rounded-sm">{featuredSkill.category}</span>
                  <div className="flex items-center gap-1 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">visibility</span>
                    <span className="font-label text-xs">{featuredSkill.views}</span>
                  </div>
                </div>
                <button
                  className="text-2xl font-headline font-bold text-on-surface mb-2 text-left hover:text-primary transition-colors"
                  onClick={() => navigate(`/skill-detail?skillId=${featuredSkill.id}`)}
                >
                  {featuredSkill.name}
                </button>
                <p className="text-on-surface-variant font-body text-sm mb-4 line-clamp-2">{featuredSkill.description}</p>
                <div className="flex items-center gap-3 mb-6 bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/15 w-max">
                  <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-primary text-[10px] font-label">
                    {featuredSkill.creatorAddress.slice(2, 4).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-body text-xs text-on-surface-variant">Creator</span>
                    <span className="font-label text-xs text-primary truncate max-w-[120px]">{featuredSkill.creatorAddress.slice(0, 10)}...</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-4 mt-auto">
                <div className="flex flex-col gap-1">
                  <span className="font-body text-xs text-on-surface-variant">Mint Cost</span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-headline text-3xl font-bold text-on-surface">{featuredSkill.priceLabel.split(" ")[0]}</span>
                    <span className="font-label text-primary">{featuredSkill.priceLabel.split(" ")[1]}</span>
                  </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <div className="flex flex-col items-center justify-center bg-secondary-container/10 border-l-2 border-secondary px-4 py-2 rounded-r-lg">
                    <span className="font-body text-[10px] text-on-surface-variant uppercase tracking-wider">Alpha Score</span>
                    <span className="font-headline text-lg font-bold text-secondary">{featuredSkill.alphaScore}</span>
                  </div>
                  <button 
                    onClick={() => navigate(`/skill-detail?skillId=${featuredSkill.id}`)}
                    className="flex-1 sm:flex-none bg-gradient-primary text-[#003543] font-headline font-bold text-sm px-8 py-3 rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-[inset_0_0_10px_rgba(0,53,67,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">shopping_cart</span>
                    Mint Now
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel ghost-border rounded-xl p-6 flex flex-col h-full border-l-[3px] border-l-tertiary bg-gradient-to-br from-surface-variant/40 to-surface-container-low/20">
            <h4 className="font-headline font-bold text-lg text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary" aria-hidden="true">trending_up</span>
              Network Kinetics
            </h4>
            <div className="flex flex-col gap-6 flex-1 justify-center">
              <div>
                <div className="flex justify-between items-end mb-1">
                  <span className="font-body text-sm text-on-surface-variant">24h Volume</span>
                  <span className="font-label text-xs text-tertiary flex items-center gap-1"><span className="material-symbols-outlined text-[12px]" aria-hidden="true">arrow_upward</span> 12.4%</span>
                </div>
                <div className="font-headline text-2xl font-bold text-on-surface">1,420.5 <span className="text-sm text-primary font-label">BNB</span></div>
                <div className="w-full bg-surface-container-lowest h-1.5 rounded-full mt-2 overflow-hidden border border-outline-variant/10">
                  <div className="bg-tertiary h-full w-[65%] rounded-full shadow-[0_0_10px_rgba(0,249,190,0.5)]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-end mb-1">
                  <span className="font-body text-sm text-on-surface-variant">Active Vaults</span>
                  <span className="font-label text-xs text-error flex items-center gap-1"><span className="material-symbols-outlined text-[12px]" aria-hidden="true">arrow_downward</span> 2.1%</span>
                </div>
                <div className="font-headline text-2xl font-bold text-on-surface">3,892</div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <div className="flex justify-between items-center mb-6 mt-4">
          <h3 className="font-headline text-xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" aria-hidden="true">grid_view</span>
            Available Constructs
          </h3>
          <div className="flex items-center gap-2">
            <span className="font-body text-sm text-on-surface-variant hidden sm:inline">Sort by:</span>
            <button className="bg-surface-container-lowest border border-outline-variant/20 rounded-md px-3 py-1.5 flex items-center gap-2 font-body text-sm hover:border-primary/50 transition-colors">
              Alpha Score
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">expand_more</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {restSkills.map((skill) => (
            <div key={skill.id} className="bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/10 hover:border-primary/30 transition-all duration-300 group hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(164,230,255,0.1)] flex flex-col">
              <div className="h-40 bg-surface-container-highest relative overflow-hidden">
                <img alt={`${skill.name} visual`} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500 mix-blend-screen" src={skill.visualUrl} />
                <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-md px-2 py-1 rounded-md border border-outline-variant/30 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-primary" aria-hidden="true">bolt</span>
                  <span className="font-label text-xs font-bold text-primary">{skill.alphaScore}</span>
                </div>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[#4cd6ff] font-headline text-[10px] uppercase tracking-wider">{skill.category}</span>
                </div>
                <h4 className="font-headline font-bold text-base text-on-surface mb-3 line-clamp-1">{skill.name}</h4>
                <div className="flex items-center gap-2 mb-4 bg-surface-container-lowest px-2 py-1.5 rounded-md border border-outline-variant/10 w-fit">
                  <div className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center text-primary text-[9px] font-label">
                    {skill.creatorAddress.slice(2, 4).toUpperCase()}
                  </div>
                  <span className="font-label text-[10px] text-on-surface-variant">{skill.creatorAddress.slice(0, 10)}...</span>
                </div>
                <div className="mt-auto pt-4 border-t border-outline-variant/15 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="font-body text-[10px] text-on-surface-variant">Price</span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-headline font-bold text-lg text-on-surface">{skill.priceLabel.split(" ")[0]}</span>
                      <span className="font-label text-xs text-primary">{skill.priceLabel.split(" ")[1]}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/skill-detail?skillId=${skill.id}`)}
                    className="bg-surface-container-high hover:bg-surface-variant border border-outline-variant/20 rounded-md px-3 py-1.5 font-headline text-sm font-medium transition-colors text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
