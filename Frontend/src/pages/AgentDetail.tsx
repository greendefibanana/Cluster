import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/StateBlocks";
import { copyToClipboard, explorerLink, formatRelativeTime, truncateAddress } from "../lib/format";
import { appEnv } from "../lib/env";
import { useAppContext } from "../hooks/useAppContext";
import { equipAgentSkill, fetchOwnedSkills } from "../lib/web3";

export default function AgentDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showSkillToast, setShowSkillToast] = useState(false);
  const [toastType, setShowToastType] = useState<"equip" | "remove">("equip");
  const [equippingId, setEquippingId] = useState<string | null>(null);
  const [ownedSkills, setOwnedSkills] = useState<any[]>([]);
  const { agents, wallet, refreshApp } = useAppContext();

  useEffect(() => {
    if (showSkillToast && toastType === "equip" && wallet.account) {
      fetchOwnedSkills(wallet.account).then(setOwnedSkills);
    }
  }, [showSkillToast, toastType, wallet.account]);

  const agentId = searchParams.get("agentId") ?? "";
  const agent = agents.find((item) => item.id === agentId) ?? agents[0];

  const handleSlotClick = (isFull: boolean) => {
    setShowToastType(isFull ? "remove" : "equip");
    setShowSkillToast(true);
  };

  const handleEquip = async (numericSkillId: number) => {
    if (!wallet.account) {
      alert("Please connect wallet first");
      return;
    }
    
    setEquippingId(`avail-${numericSkillId}`);
    try {
      await equipAgentSkill(wallet.account, agent.id, numericSkillId, 1);
      alert(`Skill equipped successfully!`);
      setShowSkillToast(false);
      await refreshApp();
    } catch (e: any) {
      alert("Equip failed: " + e.message);
    } finally {
      setEquippingId(null);
    }
  };

  if (!agent) {
    return (
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <EmptyState title="Agent not found" message="Return to the rankings and open a tracked agent." />
      </main>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-8 flex flex-col gap-8 max-w-7xl mx-auto w-full relative">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => navigate("/agents")}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-body text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
        >
          <span className="material-symbols-outlined text-lg" aria-hidden="true">arrow_back</span>
          Back to Agents
        </button>
        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-lg bg-surface-container-high border border-outline-variant/20 hover:border-primary/50 text-primary font-label text-sm transition-colors flex items-center gap-2 shadow-ambient focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">share</span>
            Share
          </button>
          <button className="px-6 py-2 rounded-lg bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed font-label font-bold text-sm transition-transform active:scale-95 shadow-ambient flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">gavel</span>
            Place Bid
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container-low rounded-xl p-4 flex flex-col items-center shadow-ambient relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 z-10">
              <span className="bg-tertiary text-on-tertiary px-2 py-1 rounded-full font-label text-[10px] uppercase tracking-widest flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">bolt</span>
                {agent.status}
              </span>
            </div>
            <div className="w-full aspect-square rounded-lg overflow-hidden border-2 border-outline-variant/20 mb-6 relative">
              <img alt={`${agent.name} avatar`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src={agent.avatarUrl} />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-dim/80 to-transparent" />
            </div>
            <h2 className="font-headline text-3xl font-bold text-primary tracking-tight mb-1 w-full text-center">{agent.name}</h2>
            <p className="font-label text-sm text-outline mb-4 w-full text-center">ERC-6551 #{agent.id}</p>
            <div className="w-full flex justify-between items-center p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/20">
              <span className="font-body text-sm text-on-surface-variant">Owner</span>
              <button
                onClick={() => void copyToClipboard(agent.ownerAddress)}
                className="font-label text-sm text-primary flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
              >
                {truncateAddress(agent.ownerAddress)}
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">content_copy</span>
              </button>
            </div>
            <div className="w-full mt-3 flex justify-between items-center p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/20">
              <span className="font-body text-sm text-on-surface-variant">TBA</span>
              <button
                onClick={() => void copyToClipboard(agent.tbaAddress)}
                className="font-label text-sm text-primary flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
              >
                {truncateAddress(agent.tbaAddress)}
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">content_copy</span>
              </button>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl p-6 shadow-ambient">
            <h3 className="font-headline text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary" aria-hidden="true">extension</span>
              Equipped Skills
            </h3>
            <div className="flex flex-col gap-3">
              {agent.skills.map((skill) => (
                <button
                  key={skill.slotId}
                  onClick={() => handleSlotClick(skill.equipped)}
                  className={`flex items-center gap-4 p-3 rounded-lg border transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${skill.equipped ? "bg-surface-container-high border-outline-variant/20 hover:bg-surface-container-highest" : "bg-surface-container-lowest border-dashed border-outline-variant/40 hover:border-primary/50"}`}
                >
                  <div className={`w-10 h-10 rounded flex items-center justify-center ${skill.accent === "secondary" ? "bg-secondary-container/20 border border-secondary/30 text-secondary" : skill.accent === "tertiary" ? "bg-tertiary/10 border border-tertiary/30 text-tertiary" : "bg-primary-container/10 border border-primary/30 text-primary"}`}>
                    <span className="material-symbols-outlined" aria-hidden="true">{skill.icon}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-body font-medium text-sm text-on-surface">{skill.name}</h4>
                    <p className="font-label text-xs text-outline">{skill.equipped ? `Level ${skill.level}` : "Equip NFT"}</p>
                  </div>
                  {skill.equipped ? <span className="material-symbols-outlined text-tertiary text-sm" aria-hidden="true">check_circle</span> : null}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-8">
          <div className="bg-surface-container-low rounded-xl p-6 shadow-ambient">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-headline text-xl font-bold text-on-surface mb-1">Performance (30D)</h3>
                <p className="font-body text-sm text-on-surface-variant">Cumulative yield across all executed strategies.</p>
              </div>
              <div className="flex items-end gap-2">
                <span className="font-headline text-3xl font-bold text-tertiary">+{agent.alphaRate}%</span>
                <span className="material-symbols-outlined text-tertiary mb-1" aria-hidden="true">arrow_upward</span>
              </div>
            </div>
            <div className="w-full h-48 bg-surface-container-lowest rounded-lg border border-outline-variant/20 relative overflow-hidden flex items-end px-2 pb-2">
              <div className="absolute inset-0 flex flex-col justify-between py-4 pointer-events-none opacity-10">
                <div className="w-full border-b border-primary" />
                <div className="w-full border-b border-primary" />
                <div className="w-full border-b border-primary" />
                <div className="w-full border-b border-primary" />
              </div>
              <div className="w-full flex justify-between items-end h-full pt-8 gap-1 z-10">
                {agent.performanceSeries.map((point, index) => (
                  <div
                    key={`${agent.id}-series-${index}`}
                    className={`w-full rounded-t-sm transition-colors ${index === agent.performanceSeries.length - 1 ? "bg-primary/60 hover:bg-primary/80" : index === agent.performanceSeries.length - 3 ? "bg-tertiary/40 hover:bg-tertiary/60" : "bg-primary/30 hover:bg-primary/50"}`}
                    style={{ height: `${point}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl p-6 shadow-ambient flex-1">
            <h3 className="font-headline text-lg font-bold text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" aria-hidden="true">history</span>
              On-Chain Proofs
            </h3>
            <div className="flex flex-col gap-6 relative">
              <div className="absolute left-[19px] top-2 bottom-2 w-[2px] bg-outline-variant/30 z-0" />
              {agent.proofs.map((proof) => (
                <div key={proof.id} className="flex gap-4 relative z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1 ${proof.accent === "secondary" ? "bg-secondary-container/20 border border-secondary/40" : proof.accent === "tertiary" ? "bg-tertiary-container/20 border border-tertiary/40" : "bg-primary/10 border border-primary/40"}`}>
                    <span className={`material-symbols-outlined text-sm ${proof.accent === "secondary" ? "text-secondary" : proof.accent === "tertiary" ? "text-tertiary" : "text-primary"}`} aria-hidden="true">
                      {proof.accent === "secondary" ? "psychology" : proof.accent === "tertiary" ? "swap_calls" : "history"}
                    </span>
                  </div>
                  <div className="flex-1 bg-surface-container-high p-4 rounded-lg border border-outline-variant/20">
                    <div className="flex justify-between items-start mb-2 gap-3">
                      <h4 className="font-body font-medium text-sm text-on-surface">{proof.title}</h4>
                      <span className="font-label text-xs text-outline">{formatRelativeTime(proof.createdAt)}</span>
                    </div>
                    <p className="font-body text-sm text-on-surface-variant mb-3">{proof.description}</p>
                    <div className="flex items-center gap-2">
                      {proof.valueLabel ? <span className="bg-tertiary/10 text-tertiary px-2 py-1 rounded text-xs font-label">{proof.valueLabel}</span> : null}
                      <a
                        className="text-primary hover:underline font-label text-xs flex items-center gap-1 ml-auto"
                        href={explorerLink(appEnv.explorerBaseUrl, proof.txHash)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Tx: {truncateAddress(proof.txHash)}
                        <span className="material-symbols-outlined text-[12px]" aria-hidden="true">open_in_new</span>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showSkillToast ? (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSkillToast(false)}
            aria-label="Close skill modal"
          />
          <div className="relative w-full max-w-lg bg-[#1c1b1c] rounded-2xl border border-outline-variant/20 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 md:slide-in-from-center duration-300">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${toastType === "equip" ? "bg-primary/10 text-primary" : "bg-error/10 text-error"}`}>
                    <span className="material-symbols-outlined text-2xl" aria-hidden="true">{toastType === "equip" ? "extension" : "settings_backup_restore"}</span>
                  </div>
                  <div>
                    <h3 className="font-headline text-xl font-bold text-white">{toastType === "equip" ? "Equip Skill NFT" : "Manage Skill Slot"}</h3>
                    <p className="font-body text-xs text-zinc-500 uppercase tracking-widest">{agent.name} Configuration</p>
                  </div>
                </div>
                <button onClick={() => setShowSkillToast(false)} className="text-zinc-500 hover:text-white transition-colors h-10 w-10 rounded-lg">
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>

              {toastType === "equip" ? (
                <div className="space-y-3 mb-8 max-h-[300px] overflow-y-auto pr-2">
                  {ownedSkills.length > 0 ? ownedSkills.map((skill) => (
                    <button
                      key={`avail-${skill.id}`}
                      onClick={() => handleEquip(skill.id)}
                      disabled={equippingId === `avail-${skill.id}`}
                      className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5 hover:border-primary/50 transition-all group text-left cursor-pointer disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                        <span className="material-symbols-outlined" aria-hidden="true">{skill.icon}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-body font-bold text-sm text-white">{skill.name}</span>
                          <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-label">x{skill.balance}</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter line-clamp-1">
                          {equippingId === `avail-${skill.id}` ? "Equipping..." : skill.desc}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-zinc-600 group-hover:text-primary" aria-hidden="true">add_circle</span>
                    </button>
                  )) : (
                    <div className="text-center p-4 text-zinc-500 text-sm font-body">
                      No skills available to equip. Visit the Bazaar to acquire new constructs.
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-8 p-6 bg-error/5 rounded-xl border border-error/20 flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center text-error border border-error/20 mb-2">
                    <span className="material-symbols-outlined text-4xl" aria-hidden="true">warning</span>
                  </div>
                  <div>
                    <h4 className="text-white font-bold mb-1">Remove Skill NFT?</h4>
                    <p className="text-zinc-400 text-sm">Detaching this construct will stop active execution. You can re-equip it at any time from your inventory.</p>
                  </div>
                  <button className="w-full py-3 rounded-xl bg-error text-white font-bold shadow-[0_0_20px_rgba(255,84,77,0.3)] hover:brightness-110 transition-all flex items-center justify-center gap-2 mt-2">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">delete_forever</span>
                    Remove Skill NFT
                  </button>
                </div>
              )}

              {toastType === "equip" ? (
                <div className="flex gap-4">
                  <button onClick={() => setShowSkillToast(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all">
                    Cancel
                  </button>
                  <button className="flex-1 py-3 rounded-xl bg-[#00D1FF] text-[#131314] font-bold shadow-[0_0_20px_#00D1FF] hover:brightness-110 transition-all">
                    Equip to Slot
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
