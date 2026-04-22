import { useState } from "react";
import { useAppContext } from "../hooks/useAppContext";
import { mintSwarm } from "../lib/web3";
import { truncateAddress } from "../lib/format";

export default function SwarmWars() {
  const { swarms = [], agents = [], wallet, refreshApp, assignAgentToSwarm, removeAgentFromSwarm } = useAppContext();
  const [minting, setMinting] = useState(false);
  const [swarmName, setSwarmName] = useState("");
  const [strategy, setStrategy] = useState("");
  const [description, setDescription] = useState("");
  
  const [selectedSwarmId, setSelectedSwarmId] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const mySwarms = swarms.filter(s => s.ownerAddress.toLowerCase() === wallet.account?.toLowerCase());
  const selectedSwarm = swarms.find(s => s.id === selectedSwarmId);

  // My unassigned agents (owned directly by the user's wallet)
  const myIdleAgents = agents.filter(a => a.ownerAddress.toLowerCase() === wallet.account?.toLowerCase());

  const handleAssignAgent = async (agentId: string, swarmTba: string) => {
    setIsTransferring(true);
    try {
      await assignAgentToSwarm(agentId, swarmTba);
      await refreshApp();
    } catch (e: any) {
      alert("Failed to assign agent: " + e.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleRemoveAgent = async (agentId: string, swarmTba: string) => {
    setIsTransferring(true);
    try {
      await removeAgentFromSwarm(swarmTba, agentId);
      await refreshApp();
    } catch (e: any) {
      alert("Failed to remove agent: " + e.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleMint = async () => {
    if (!wallet.account) {
      alert("Please connect wallet first");
      return;
    }
    const finalName = swarmName.trim() || "Alpha Swarm";
    const finalStrategy = strategy.trim() || "Yield Aggregator";
    const finalDesc = description.trim() || "Coordinated optimization.";

    setMinting(true);
    try {
      const saltBytes = new Uint8Array(32);
      crypto.getRandomValues(saltBytes);
      const saltHex = "0x" + Array.from(saltBytes).map(b => b.toString(16).padStart(2, "0")).join("") as `0x${string}`;

      await mintSwarm(wallet.account, finalName, finalStrategy, finalDesc, saltHex);
      alert("Swarm minted successfully!");
      setSwarmName("");
      setStrategy("");
      setDescription("");
      await refreshApp();
    } catch (e: any) {
      alert("Mint failed: " + e.message);
    } finally {
      setMinting(false);
    }
  };

  return (
    <main className="flex-1 p-6 md:p-10 lg:p-12 space-y-12 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="font-headline text-[3.5rem] leading-none font-bold text-on-surface tracking-tighter mb-2">
            Swarm <span className="gradient-text">Nexus</span>
          </h2>
          <p className="font-body text-on-surface-variant text-sm max-w-xl">
            Deploy and manage autonomous agent clusters. Organize your agents into specialized swarms for coordinated on-chain execution.
          </p>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-xl p-6 md:p-8 ghost-border glow-shadow">
        <h3 className="font-headline text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">hive</span>
          Deploy New Swarm
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="flex flex-col gap-2">
            <label className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Swarm Name</label>
            <input
              type="text"
              placeholder="e.g. Bull Runners"
              value={swarmName}
              onChange={(e) => setSwarmName(e.target.value)}
              className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/50"
              disabled={minting}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Strategy Focus</label>
            <input
              type="text"
              placeholder="e.g. DeFi Arbitrage"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/50"
              disabled={minting}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Description</label>
            <input
              type="text"
              placeholder="Operational parameters..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/50"
              disabled={minting}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button 
            onClick={handleMint}
            disabled={minting}
            className="flex items-center gap-2 bg-primary text-on-primary font-bold px-6 py-3 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
          >
            <span className="material-symbols-outlined">rocket_launch</span>
            {minting ? "Deploying..." : "Initialize Swarm"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-tertiary" aria-hidden="true">dashboard_customize</span>
          <h3 className="font-headline text-2xl font-bold text-on-surface">Active Fleets</h3>
        </div>
        
        {mySwarms.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-xl p-10 border border-outline-variant/10 flex flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-5xl text-outline-variant/50 mb-4">hexagon</span>
            <h4 className="font-headline text-lg font-bold text-on-surface mb-2">No Swarms Deployed</h4>
            <p className="font-body text-sm text-on-surface-variant max-w-md">
              Initialize your first swarm fleet above to begin coordinating multi-agent operations.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mySwarms.map((swarm) => (
              <button 
                key={swarm.id} 
                onClick={() => setSelectedSwarmId(swarm.id)}
                className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/15 hover:border-primary/30 transition-all group flex flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="flex justify-between items-start mb-4 w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                      <span className="material-symbols-outlined text-primary">hive</span>
                    </div>
                    <div>
                      <h4 className="font-headline font-bold text-lg text-on-surface group-hover:text-primary transition-colors">{swarm.name}</h4>
                      <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">Swarm #{swarm.id}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-tertiary/10 text-tertiary font-label text-[10px] uppercase tracking-widest rounded border border-tertiary/20">
                    {swarm.status}
                  </span>
                </div>
                
                <div className="bg-surface-container-lowest rounded-lg p-3 border border-outline-variant/10 mb-4 flex-grow w-full">
                  <p className="font-body text-sm text-on-surface-variant line-clamp-2 mb-2">
                    {swarm.description}
                  </p>
                  <div className="flex flex-col gap-1 mt-auto">
                    <span className="font-label text-[10px] text-outline-variant uppercase">Core Strategy</span>
                    <span className="font-body text-sm text-on-surface font-semibold">{swarm.strategy}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-outline-variant/15 w-full">
                  <div className="flex flex-col gap-1">
                    <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">TBA Account</span>
                    <span className="font-body text-xs text-primary font-mono">{truncateAddress(swarm.tbaAddress)}</span>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">Member Count</span>
                    <div className="flex items-center gap-1 text-on-surface font-bold text-sm">
                      <span className="material-symbols-outlined text-[14px] text-secondary">group</span>
                      {swarm.memberCount}
                    </div>
                  </div>
                </div>
                <div className="w-full mt-4 flex items-center justify-center py-2 bg-primary/10 text-primary rounded-md font-label text-xs uppercase tracking-widest group-hover:bg-primary group-hover:text-on-primary transition-colors font-bold">
                  Manage Fleet
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Manage Swarm Modal */}
      {selectedSwarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container border border-outline-variant/20 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
              <div>
                <h3 className="font-headline text-2xl font-bold text-on-surface flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-3xl">hive</span>
                  {selectedSwarm.name}
                </h3>
                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest mt-1">Fleet Management Dashboard</p>
              </div>
              <button 
                onClick={() => setSelectedSwarmId(null)}
                className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-outline-variant/20 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow flex flex-col md:flex-row gap-8 min-h-[400px]">
              {/* Assigned Agents */}
              <div className="flex-1 flex flex-col gap-4 border border-outline-variant/10 bg-surface-container-lowest rounded-xl p-4 overflow-hidden">
                <div className="flex items-center justify-between border-b border-outline-variant/10 pb-3 flex-shrink-0">
                  <h4 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-tertiary">group</span>
                    Assigned Operatives
                  </h4>
                  <span className="bg-tertiary/10 text-tertiary font-label text-xs px-2 py-1 rounded border border-tertiary/20">
                    {selectedSwarm.agents?.length || 0} Agents
                  </span>
                </div>
                
                <div className="flex flex-col gap-3 flex-grow overflow-y-auto pr-2">
                  {!selectedSwarm.agents || selectedSwarm.agents.length === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center py-10">
                      <span className="material-symbols-outlined text-4xl text-outline-variant/50 mb-2">person_off</span>
                      <p className="font-body text-sm text-on-surface-variant">No agents assigned to this swarm.</p>
                    </div>
                  ) : (
                    selectedSwarm.agents.map(agent => (
                      <div key={agent.id} className="bg-surface-container flex items-center justify-between p-3 rounded-lg border border-outline-variant/15 flex-shrink-0">
                        <div className="flex items-center gap-3">
                          <img src={agent.avatarUrl} alt={agent.name} className="w-10 h-10 rounded bg-surface-container-highest border border-outline-variant/20" />
                          <div>
                            <div className="font-headline font-bold text-sm text-on-surface">{agent.name}</div>
                            <div className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">#{agent.id} • {agent.evolutionTier}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleRemoveAgent(agent.id, selectedSwarm.tbaAddress)}
                          disabled={isTransferring}
                          className="flex items-center gap-1 bg-error/10 text-error px-3 py-1.5 rounded hover:bg-error/20 transition-colors disabled:opacity-50 text-xs font-bold uppercase tracking-widest"
                        >
                          <span className="material-symbols-outlined text-[16px]">logout</span>
                          Recall
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Available Agents */}
              <div className="flex-1 flex flex-col gap-4 border border-outline-variant/10 bg-surface-container-lowest rounded-xl p-4 overflow-hidden">
                <div className="flex items-center justify-between border-b border-outline-variant/10 pb-3 flex-shrink-0">
                  <h4 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">person_add</span>
                    Available Deployments
                  </h4>
                  <span className="bg-primary/10 text-primary font-label text-xs px-2 py-1 rounded border border-primary/20">
                    {myIdleAgents.length} Available
                  </span>
                </div>
                
                <div className="flex flex-col gap-3 flex-grow overflow-y-auto pr-2">
                  {myIdleAgents.length === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center py-10">
                      <span className="material-symbols-outlined text-4xl text-outline-variant/50 mb-2">inventory_2</span>
                      <p className="font-body text-sm text-on-surface-variant max-w-[200px]">You have no unassigned agents in your wallet.</p>
                      <a href="/agents" className="mt-4 text-primary text-xs uppercase tracking-widest font-bold hover:underline">Mint more agents</a>
                    </div>
                  ) : (
                    myIdleAgents.map(agent => (
                      <div key={agent.id} className="bg-surface-container flex items-center justify-between p-3 rounded-lg border border-outline-variant/15 flex-shrink-0">
                        <div className="flex items-center gap-3">
                          <img src={agent.avatarUrl} alt={agent.name} className="w-10 h-10 rounded bg-surface-container-highest border border-outline-variant/20" />
                          <div>
                            <div className="font-headline font-bold text-sm text-on-surface">{agent.name}</div>
                            <div className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">#{agent.id} • {agent.evolutionTier}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleAssignAgent(agent.id, selectedSwarm.tbaAddress)}
                          disabled={isTransferring}
                          className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded hover:bg-primary/20 transition-colors disabled:opacity-50 text-xs font-bold uppercase tracking-widest"
                        >
                          <span className="material-symbols-outlined text-[16px]">login</span>
                          Assign
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-outline-variant/10 bg-surface-container-low flex justify-between items-center">
              <div className="flex items-center gap-2 text-on-surface-variant font-label text-xs uppercase tracking-widest">
                <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                Swarm TBA: <span className="font-mono text-primary">{selectedSwarm.tbaAddress}</span>
              </div>
              <button 
                onClick={() => setSelectedSwarmId(null)}
                className="bg-surface text-on-surface border border-outline-variant/20 px-6 py-2 rounded-lg font-bold hover:bg-surface-container-highest transition-colors"
              >
                Close Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
