import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatRelativeTime } from "../lib/format";
import { useAppContext } from "../hooks/useAppContext";
import { fetchMemeAlpha, generateMemeConcept, generateMemeImage } from "../lib/gateway";
import { launchMemeTokenWithConnectedWallet } from "../lib/web3";

export default function AgentEditor() {
  const navigate = useNavigate();
  const { agents, executionHistory, executeAgent, wallet } = useAppContext();
  const [activeTab, setActiveTab] = useState<"chat" | "memory">("chat");
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? "");
  const [draft, setDraft] = useState("Draft a strategy thread for a BNB-native volatility setup.");
  const [pending, setPending] = useState(false);
  const [showSkillToast, setShowSkillToast] = useState(false);
  const [toastType, setShowToastType] = useState<"equip" | "remove">("equip");
  
  // Meme state
  const [theses, setTheses] = useState<any[]>([]);
  const [concept, setConcept] = useState<any>(null);
  const [images, setImages] = useState<any>(null);
  const [launchResult, setLaunchResult] = useState<any>(null);

  const agent = agents.find((item) => item.id === selectedAgentId) ?? agents[0];
  const agentHistory = executionHistory.filter((entry) => entry.agentId === agent?.id);

  const handleSlotClick = (isFull: boolean) => {
    setShowToastType(isFull ? "remove" : "equip");
    setShowSkillToast(true);
  };

  async function handleRun() {
    const trimmed = draft.trim();
    if (!trimmed || !agent) {
      return;
    }

    setPending(true);
    try {
      if (trimmed.startsWith("/scan")) {
        const query = trimmed.replace("/scan", "").trim();
        const res = await fetchMemeAlpha(query || "trending tokens on BSC, Pepe variants");
        setTheses(res.result?.theses || []);
        setDraft("/concept 1");
      } else if (trimmed.startsWith("/concept")) {
        const index = parseInt(trimmed.replace("/concept", "").trim()) - 1 || 0;
        if (!theses[index]) throw new Error("No thesis found at that index. Run /scan first.");
        const res = await generateMemeConcept(theses[index]);
        setConcept(res.result);
        setDraft("/image");
      } else if (trimmed.startsWith("/image")) {
        if (!concept) throw new Error("No concept generated yet. Run /concept first.");
        const res = await generateMemeImage(concept.image_prompt, concept.name, concept.ticker);
        setImages(res.assets);
        setDraft("/launch");
      } else if (trimmed.startsWith("/launch")) {
        if (!concept) throw new Error("No concept generated yet.");
        if (!wallet.account) throw new Error("Connect your wallet to launch a token.");
        const res = await launchMemeTokenWithConnectedWallet(
          wallet.account,
          concept.name,
          concept.ticker,
          "1000000000000000000000000000",
          false
        );
        setLaunchResult(res);
        setDraft("");
      } else {
        await executeAgent({
          agentId: agent.id,
          message: trimmed,
          action: "post",
        });
        setDraft("");
        setActiveTab("memory");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setPending(false);
    }
  }

  if (!agent) {
    return null;
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden pb-24 relative max-w-4xl mx-auto w-full">
      <div className="absolute top-0 left-0 w-full h-[300px] bg-primary/5 blur-[100px] rounded-full pointer-events-none -z-10" />
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-body text-sm font-semibold text-on-surface">Output Workbench</h2>
            <span className="font-label text-[10px] bg-secondary-container/20 text-secondary px-2 py-1 rounded-sm border border-secondary/30 uppercase tracking-widest">
              {pending ? "Running" : "Gateway Ready"}
            </span>
          </div>
          <div className="glass-panel rounded-lg p-3 relative overflow-hidden group">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary opacity-50" />
            <div className="relative w-full aspect-video rounded-sm overflow-hidden mb-3 ghost-border bg-surface-container-highest">
              <img className={`w-full h-full object-cover transition-opacity duration-300 ${images ? 'opacity-100' : 'opacity-80 mix-blend-screen'}`} alt={`${agent.name} preview`} src={images?.banner || agent.avatarUrl} />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-dim/90 to-transparent flex flex-col justify-end p-3">
                <p className="font-label text-xs text-primary">{agent.name}_Execution_Stream</p>
                {images && (
                  <div className="flex gap-2 mt-2">
                    <img src={images.mascot} alt="Mascot" className="w-10 h-10 rounded border border-primary/30" />
                    <img src={images.logo} alt="Logo" className="w-10 h-10 rounded border border-primary/30" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <label htmlFor="agent-select" className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                Active Agent
              </label>
              <select
                id="agent-select"
                value={agent.id}
                onChange={(event) => setSelectedAgentId(event.target.value)}
                className="bg-surface-container-lowest border border-outline-variant/20 rounded px-3 py-2 text-sm text-on-surface"
              >
                {agents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDraft("/scan")}
                className="flex-1 py-2 bg-gradient-to-br from-tertiary to-tertiary-container text-[#001f28] font-headline font-bold text-xs rounded-sm flex items-center justify-center gap-2 shadow-ambient hover:opacity-90"
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">radar</span>
                Scan Alpha
              </button>
              <button
                onClick={() => navigate(`/skill-detail?skillId=1`)}
                className="flex-1 py-2 bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed font-headline font-bold text-xs rounded-sm flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">check_circle</span>
                Review Skills
              </button>
            </div>
          </div>
        </section>

        <section className="bg-surface-container-low rounded-xl p-4 ghost-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-body text-sm font-semibold text-on-surface">Skill Modules (TBA)</h2>
            <span className="font-label text-xs text-on-surface-variant">
              {agent.skills.filter((skill) => skill.equipped).length}/{agent.skills.length} Slots Full
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {agent.skills.map((skill) => (
              <button
                key={skill.slotId}
                onClick={() => handleSlotClick(skill.equipped)}
                className={`rounded-sm p-3 border relative cursor-pointer transition-colors text-left ${skill.equipped ? "bg-surface-container-high hover:border-primary/50" : "bg-surface-container-lowest border-dashed border-outline-variant/20 opacity-60"}`}
              >
                {skill.equipped ? <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${skill.accent === "secondary" ? "bg-secondary" : skill.accent === "tertiary" ? "bg-tertiary" : "bg-primary"}`} /> : null}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${skill.accent === "secondary" ? "bg-secondary/10 text-secondary" : skill.accent === "tertiary" ? "bg-tertiary/10 text-tertiary" : "bg-primary/10 text-primary"}`}>
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">{skill.icon}</span>
                </div>
                <p className="font-headline text-xs font-bold text-on-surface mb-1 truncate">{skill.name}</p>
                <p className="font-label text-[10px] text-on-surface-variant">{skill.equipped ? `Lvl ${skill.level}` : "Open slot"}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-surface-container-highest rounded-xl flex-1 flex flex-col overflow-hidden ghost-border min-h-[300px]">
          <div className="flex border-b border-outline-variant/20">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-3 text-sm font-headline font-bold transition-all ${activeTab === "chat" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-on-surface-variant hover:text-on-surface"}`}
            >
              Directive Chat
            </button>
            <button
              onClick={() => setActiveTab("memory")}
              className={`flex-1 py-3 text-sm font-headline font-bold transition-all flex items-center justify-center gap-1 ${activeTab === "memory" ? "text-secondary border-b-2 border-secondary bg-secondary/5" : "text-on-surface-variant hover:text-on-surface"}`}
            >
              <span className="material-symbols-outlined text-xs" aria-hidden="true">memory</span>
              Memory Stream
            </button>
          </div>

          {activeTab === "chat" ? (
            <>
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="material-symbols-outlined text-[12px] text-primary" aria-hidden="true">smart_toy</span>
                  </div>
                  <div className="bg-surface-container-low p-3 rounded-sm rounded-tl-none ghost-border">
                    <p className="font-body text-sm text-on-surface leading-relaxed mb-2">
                      {agent.name} is ready for a new directive. Use normal chat or DGrid quick commands:
                    </p>
                    <ul className="text-xs text-on-surface-variant list-disc pl-4 space-y-1">
                      <li><code>/scan</code> - Find alpha/theses</li>
                      <li><code>/concept [num]</code> - Generate lore & tokenomics</li>
                      <li><code>/image</code> - Generate visual assets</li>
                      <li><code>/launch</code> - Deploy with connected wallet</li>
                    </ul>
                  </div>
                </div>

                {theses.length > 0 && (
                  <div className="bg-surface-container-low p-3 rounded-sm border border-tertiary/20">
                    <h3 className="text-tertiary font-bold text-xs uppercase tracking-widest mb-3">Alpha Scout Results</h3>
                    <div className="space-y-3">
                      {theses.map((t, i) => (
                        <div key={i} className="text-sm text-on-surface bg-surface-container-lowest p-2 rounded border border-outline-variant/10">
                          <div className="flex justify-between mb-1">
                            <span className="font-bold text-primary">[{i+1}] {t.keyword}</span>
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${t.verdict === 'launch' ? 'bg-tertiary/10 text-tertiary' : 'bg-error/10 text-error'}`}>{t.verdict}</span>
                          </div>
                          <p className="text-xs text-on-surface-variant leading-relaxed">{t.reasoning}</p>
                          <div className="mt-1 text-[10px] text-outline">Signal: {t.signal_strength} | Risk: {t.risk}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {concept && (
                  <div className="bg-surface-container-low p-3 rounded-sm border border-secondary/20 text-sm text-on-surface">
                    <h3 className="text-secondary font-bold text-xs uppercase tracking-widest mb-3">Generated Concept</h3>
                    <div className="bg-surface-container-lowest p-3 rounded border border-outline-variant/10 space-y-2">
                      <p><strong className="text-primary">{concept.name} (${concept.ticker})</strong></p>
                      <p className="text-xs"><strong>Lore:</strong> {concept.lore}</p>
                      <p className="text-xs"><strong>Copy:</strong> {concept.launch_copy}</p>
                      <p className="text-[10px] text-error/80 italic">{concept.risk_notes}</p>
                    </div>
                  </div>
                )}

                {launchResult && (
                  <div className="bg-surface-container-low p-3 rounded-sm border border-primary/20 text-sm text-on-surface">
                    <h3 className="text-primary font-bold text-xs uppercase tracking-widest mb-3">Launch Complete</h3>
                    <div className="bg-surface-container-lowest p-3 rounded border border-outline-variant/10 space-y-1 font-mono text-xs break-all">
                      <p><strong className="text-on-surface-variant">Token:</strong> {launchResult.tokenAddress}</p>
                      <p><strong className="text-on-surface-variant">TX:</strong> {launchResult.txHash}</p>
                      <p><strong className="text-on-surface-variant">Supply:</strong> {launchResult.supply}</p>
                    </div>
                  </div>
                )}

                {agentHistory[0] ? (
                  <>
                    <div className="flex justify-center my-2">
                      <div className="bg-surface-container-lowest px-3 py-1.5 rounded-full border border-outline-variant/30 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[10px] text-secondary animate-pulse" aria-hidden="true">cloud_sync</span>
                        <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-wider">
                          Synced execution history
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-3 flex-row-reverse">
                      <div className="w-6 h-6 rounded-full bg-tertiary/20 flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="material-symbols-outlined text-[12px] text-tertiary" aria-hidden="true">person</span>
                      </div>
                      <div className="bg-surface-container p-3 rounded-sm rounded-tr-none border border-outline-variant/10 text-right">
                        <p className="font-body text-sm text-on-surface leading-relaxed">{agentHistory[0].prompt}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="material-symbols-outlined text-[12px] text-primary" aria-hidden="true">smart_toy</span>
                      </div>
                      <div className="bg-surface-container-low p-3 rounded-sm rounded-tl-none ghost-border">
                        <p className="font-body text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{agentHistory[0].response}</p>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              <div className="p-3 bg-surface-container-low border-t border-outline-variant/20">
                <div className="relative flex items-center">
                  <label htmlFor="agent-directive" className="sr-only">
                    Inject new directive
                  </label>
                  <input
                    id="agent-directive"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRun()}
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 text-on-surface font-label text-sm rounded-sm py-3 pl-4 pr-12 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-on-surface-variant/50"
                    placeholder="Inject new directive or /scan..."
                    type="text"
                  />
                  <button
                    onClick={() => void handleRun()}
                    disabled={pending || !draft.trim()}
                    className="absolute right-2 w-8 h-8 rounded-sm bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Run agent directive"
                  >
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">send</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="flex flex-col gap-4 pl-2 relative border-l border-outline-variant/15 py-2">
                {agentHistory.map((entry) => (
                  <div key={entry.id} className="relative pl-6 flex flex-col gap-2">
                    <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-surface-container-lowest border border-primary z-10 shadow-[0_0_5px_rgba(164,230,255,0.5)]" />
                    <div className="flex items-center justify-between w-full">
                      <span className="font-label text-[10px] text-primary-fixed-dim bg-primary/10 px-2 py-0.5 rounded-sm">
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                      <div className="flex items-center gap-1.5 bg-surface-container-highest px-2 py-0.5 rounded-sm ghost-border">
                        <span className="material-symbols-outlined text-[12px] text-tertiary" aria-hidden="true">verified</span>
                        <span className="font-label text-[9px] text-tertiary">{entry.status.toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="bg-surface-container-low rounded-lg p-3 border border-outline-variant/10">
                      <h3 className="font-headline text-xs text-on-surface mb-2 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-sm" aria-hidden="true">analytics</span>
                        {entry.action} via {entry.selectedSkillName ?? "Fallback Skill"}
                      </h3>
                      <div className="bg-surface-container-lowest p-2 rounded-md font-mono text-[10px] text-on-surface-variant whitespace-pre-wrap leading-tight border border-outline-variant/20 shadow-inner overflow-x-auto">
                        {entry.response}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
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
                  {[...agent.skills.filter((skill) => skill.equipped), ...agent.skills.filter((skill) => !skill.equipped)].map((skill, index) => (
                    <button
                      key={`${skill.slotId}-${index}`}
                      className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5 hover:border-primary/50 transition-all group text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                        <span className="material-symbols-outlined" aria-hidden="true">{skill.icon}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-body font-bold text-sm text-white">{skill.name}</span>
                          <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-400 uppercase font-black">{skill.equipped ? "Equipped" : "Available"}</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                          {skill.equipped ? `Level ${skill.level}` : "Ready to equip"}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-zinc-600 group-hover:text-primary" aria-hidden="true">add_circle</span>
                    </button>
                  ))}
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
