import { useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../hooks/useAppContext";
import { truncateAddress } from "../lib/format";
import { mintSwarm } from "../lib/web3";
import type { AgentProfile, SwarmProfile } from "../types/domain";

const strategyPresets = [
  "DeFi yield coordination",
  "Prediction market research",
  "Farcaster strategy distribution",
  "Risk review council",
  "Meme launch squad",
];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function makeSalt() {
  const saltBytes = new Uint8Array(32);
  crypto.getRandomValues(saltBytes);
  return `0x${Array.from(saltBytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
}

function agentCapabilities(agent: AgentProfile) {
  return agent.skills
    .filter((skill) => skill.equipped && skill.capabilityTag)
    .map((skill) => skill.capabilityTag as string);
}

function SwarmMetric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/15">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary text-xl" aria-hidden="true">{icon}</span>
        <div>
          <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">{label}</p>
          <p className="font-headline text-lg font-bold text-on-surface">{value}</p>
        </div>
      </div>
    </div>
  );
}

function AgentRow({
  agent,
  actionLabel,
  actionIcon,
  disabled,
  onAction,
  tone = "primary",
}: {
  agent: AgentProfile;
  actionLabel: string;
  actionIcon: string;
  disabled: boolean;
  onAction: () => void;
  tone?: "primary" | "error";
}) {
  const capabilities = agentCapabilities(agent);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-low p-3">
      <div className="flex min-w-0 items-center gap-3">
        <img src={agent.avatarUrl} alt={agent.name} className="h-11 w-11 rounded-lg border border-outline-variant/20 object-cover" />
        <div className="min-w-0">
          <p className="truncate font-headline text-sm font-bold text-on-surface">{agent.name}</p>
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
            #{agent.id} / {agent.evolutionTier}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {(capabilities.length ? capabilities : [agent.title]).slice(0, 2).map((item) => (
              <span key={item} className="rounded border border-outline-variant/15 bg-surface-container-lowest px-1.5 py-0.5 font-label text-[9px] uppercase tracking-wider text-on-surface-variant">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
      <button
        onClick={onAction}
        disabled={disabled}
        className={`flex items-center gap-1 rounded-lg px-3 py-2 font-label text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 ${
          tone === "error"
            ? "bg-error/10 text-error hover:bg-error/20"
            : "bg-primary/10 text-primary hover:bg-primary/20"
        }`}
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{actionIcon}</span>
        {actionLabel}
      </button>
    </div>
  );
}

export default function SwarmWars() {
  const { swarms = [], agents = [], wallet, refreshApp, assignAgentToSwarm, removeAgentFromSwarm } = useAppContext();
  const [showInitializeToast, setShowInitializeToast] = useState(false);
  const [minting, setMinting] = useState(false);
  const [transferringAgentId, setTransferringAgentId] = useState<string | null>(null);
  const [selectedSwarmId, setSelectedSwarmId] = useState<string | null>(null);
  const [swarmName, setSwarmName] = useState("");
  const [strategy, setStrategy] = useState(strategyPresets[0]);
  const [description, setDescription] = useState("Coordinate specialized agents around one proof-backed strategy workflow.");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const walletAddress = wallet.account?.toLowerCase();
  const mySwarms = walletAddress ? swarms.filter((swarm) => swarm.ownerAddress.toLowerCase() === walletAddress) : [];
  const selectedSwarm = mySwarms.find((swarm) => swarm.id === selectedSwarmId) ?? mySwarms[0] ?? null;
  const myIdleAgents = walletAddress ? agents.filter((agent) => agent.ownerAddress.toLowerCase() === walletAddress) : [];
  const selectedCapabilities = selectedSwarm?.agents.flatMap(agentCapabilities) ?? [];

  async function handleAssignAgent(agentId: string, swarmTbaAddress: string) {
    setStatusMessage(null);
    setTransferringAgentId(agentId);
    try {
      await assignAgentToSwarm(agentId, swarmTbaAddress);
      await refreshApp();
      setStatusMessage({ type: "success", text: "Agent assigned to swarm TBA." });
    } catch (error) {
      setStatusMessage({ type: "error", text: `Assignment failed: ${errorMessage(error)}` });
    } finally {
      setTransferringAgentId(null);
    }
  }

  async function handleRemoveAgent(agentId: string, swarmTbaAddress: string) {
    setStatusMessage(null);
    setTransferringAgentId(agentId);
    try {
      await removeAgentFromSwarm(swarmTbaAddress, agentId);
      await refreshApp();
      setStatusMessage({ type: "success", text: "Agent recalled from swarm TBA." });
    } catch (error) {
      setStatusMessage({ type: "error", text: `Recall failed: ${errorMessage(error)}` });
    } finally {
      setTransferringAgentId(null);
    }
  }

  async function handleInitializeSwarm() {
    setStatusMessage(null);
    if (!wallet.account) {
      setStatusMessage({ type: "error", text: "Connect a wallet before initializing a swarm." });
      return;
    }

    const finalName = swarmName.trim() || "Alpha Coordination Swarm";
    const finalStrategy = strategy.trim() || strategyPresets[0];
    const finalDescription = description.trim() || "Coordinated agent strategy execution.";

    setMinting(true);
    try {
      const minted = await mintSwarm(wallet.account, finalName, finalStrategy, finalDescription, makeSalt());
      setSwarmName("");
      setStrategy(strategyPresets[0]);
      setDescription("Coordinate specialized agents around one proof-backed strategy workflow.");
      await refreshApp();
      if (minted.swarmId) {
        setSelectedSwarmId(minted.swarmId);
      }
      setShowInitializeToast(false);
      setStatusMessage({ type: "success", text: `${finalName} initialized${minted.tbaAddress ? ` at ${truncateAddress(minted.tbaAddress)}` : ""}.` });
    } catch (error) {
      setStatusMessage({ type: "error", text: `Swarm initialization failed: ${errorMessage(error)}` });
    } finally {
      setMinting(false);
    }
  }

  return (
    <main className="flex-1 p-6 md:p-10 lg:p-12 space-y-8 max-w-7xl mx-auto w-full">
      <section className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.28em] text-primary">Cluster Coordination</p>
          <h2 className="mt-2 font-headline text-[3.25rem] leading-none font-bold tracking-tighter text-on-surface">
            Swarm <span className="gradient-text">Wars</span>
          </h2>
          <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-on-surface-variant">
            Build production swarms by moving owned agents into a swarm TBA. OpenClaw coordination reads that onchain membership, routes work by equipped skill, and writes proof-backed strategy events.
          </p>
        </div>
        <button
          onClick={() => {
            setStatusMessage(null);
            setShowInitializeToast(true);
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-label font-bold uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="material-symbols-outlined" aria-hidden="true">hive</span>
          Initialize Swarm
        </button>
      </section>

      {statusMessage ? (
        <div className={`rounded-xl border px-4 py-3 font-body text-sm ${
          statusMessage.type === "success"
            ? "border-tertiary/30 bg-tertiary/10 text-tertiary"
            : "border-error/30 bg-error/10 text-error"
        }`}>
          {statusMessage.text}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SwarmMetric icon="groups" label="Owned Swarms" value={String(mySwarms.length)} />
        <SwarmMetric icon="smart_toy" label="Idle Agents" value={String(myIdleAgents.length)} />
        <SwarmMetric icon="account_tree" label="Active Members" value={String(selectedSwarm?.memberCount ?? 0)} />
        <SwarmMetric icon="verified" label="Coordinator" value="Onchain" />
      </section>

      {!wallet.account ? (
        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-primary" aria-hidden="true">account_balance_wallet</span>
          <h3 className="mt-4 font-headline text-xl font-bold text-on-surface">Connect Wallet</h3>
          <p className="mx-auto mt-2 max-w-md font-body text-sm text-on-surface-variant">
            Swarm creation and agent assignment are onchain ownership operations, so this page activates after wallet connection.
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-xl font-bold text-on-surface">Your Swarms</h3>
              <span className="font-label text-xs uppercase tracking-widest text-on-surface-variant">{truncateAddress(wallet.account)}</span>
            </div>
            {mySwarms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container-low p-8 text-center">
                <span className="material-symbols-outlined text-5xl text-outline-variant/60" aria-hidden="true">hub</span>
                <h4 className="mt-3 font-headline text-lg font-bold text-on-surface">No swarms yet</h4>
                <p className="mt-2 font-body text-sm text-on-surface-variant">Initialize one, then move agents into its TBA.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mySwarms.map((swarm) => {
                  const active = selectedSwarm?.id === swarm.id;
                  return (
                    <button
                      key={swarm.id}
                      onClick={() => setSelectedSwarmId(swarm.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        active
                          ? "border-primary/50 bg-primary/10"
                          : "border-outline-variant/15 bg-surface-container-low hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-headline text-lg font-bold text-on-surface">{swarm.name}</p>
                          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Swarm #{swarm.id}</p>
                        </div>
                        <span className="rounded border border-tertiary/25 bg-tertiary/10 px-2 py-1 font-label text-[10px] uppercase tracking-widest text-tertiary">
                          {swarm.status}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 font-body text-sm text-on-surface-variant">{swarm.strategy}</p>
                      <div className="mt-4 flex items-center justify-between border-t border-outline-variant/10 pt-3">
                        <span className="font-mono text-xs text-primary">{truncateAddress(swarm.tbaAddress)}</span>
                        <span className="font-label text-xs text-on-surface-variant">{swarm.memberCount} agents</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="min-h-[560px] rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 md:p-6">
            {selectedSwarm ? (
              <SwarmDashboard
                selectedSwarm={selectedSwarm}
                myIdleAgents={myIdleAgents}
                selectedCapabilities={selectedCapabilities}
                transferringAgentId={transferringAgentId}
                onAssign={handleAssignAgent}
                onRemove={handleRemoveAgent}
              />
            ) : (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-6xl text-outline-variant/50" aria-hidden="true">hive</span>
                <h3 className="mt-4 font-headline text-2xl font-bold text-on-surface">Select or initialize a swarm</h3>
                <p className="mt-2 max-w-md font-body text-sm text-on-surface-variant">
                  A swarm becomes useful once agents are transferred into its TBA and OpenClaw can route work by their skills.
                </p>
              </div>
            )}
          </section>
        </section>
      )}

      {showInitializeToast ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 md:items-center">
          <button
            className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
            onClick={() => !minting && setShowInitializeToast(false)}
            aria-label="Close initialize swarm modal"
          />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-outline-variant/20 bg-surface-container-low shadow-2xl animate-in slide-in-from-bottom-8 md:slide-in-from-center duration-300">
            <div className="p-6">
              <div className="mb-6 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-2xl" aria-hidden="true">hive</span>
                  </div>
                  <div>
                    <h3 className="font-headline text-xl font-bold text-on-surface">Initialize Swarm</h3>
                    <p className="font-body text-xs uppercase tracking-widest text-on-surface-variant">Swarm NFT + TBA</p>
                  </div>
                </div>
                <button
                  disabled={minting}
                  onClick={() => setShowInitializeToast(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-50"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>

              <div className="mb-6 space-y-4">
                <div>
                  <label htmlFor="swarm-name" className="mb-2 block font-label text-sm text-on-surface-variant">Swarm Name</label>
                  <input
                    id="swarm-name"
                    value={swarmName}
                    onChange={(event) => setSwarmName(event.target.value)}
                    placeholder="Alpha Coordination Swarm"
                    className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3 py-3 font-body text-sm text-on-surface transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    disabled={minting}
                  />
                </div>
                <div>
                  <label htmlFor="swarm-strategy" className="mb-2 block font-label text-sm text-on-surface-variant">Strategy Focus</label>
                  <select
                    id="swarm-strategy"
                    value={strategy}
                    onChange={(event) => setStrategy(event.target.value)}
                    className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3 py-3 font-body text-sm text-on-surface transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    disabled={minting}
                  >
                    {strategyPresets.map((preset) => (
                      <option key={preset} value={preset}>{preset}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="swarm-description" className="mb-2 block font-label text-sm text-on-surface-variant">Operating Thesis</label>
                  <textarea
                    id="swarm-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="h-28 w-full resize-none rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3 font-body text-sm text-on-surface transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    disabled={minting}
                  />
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
                  <p className="font-body text-xs leading-relaxed text-on-surface-variant">
                    Initialization mints a Swarm NFT and creates its token-bound account. Agents become members when you transfer their Agent NFTs into that account.
                  </p>
                </div>
              </div>

              {statusMessage?.type === "error" ? (
                <div className="mb-6 rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
                  {statusMessage.text}
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowInitializeToast(false)}
                  disabled={minting}
                  className="flex-1 rounded-xl border border-outline-variant/20 py-3 font-label font-bold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleInitializeSwarm()}
                  disabled={minting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container py-3 font-label font-bold text-on-primary transition-all hover:shadow-[0_0_15px_rgba(164,230,255,0.4)] disabled:opacity-50 disabled:hover:shadow-none"
                >
                  {minting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm" aria-hidden="true">progress_activity</span>
                      Initializing...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">rocket_launch</span>
                      Initialize
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SwarmDashboard({
  selectedSwarm,
  myIdleAgents,
  selectedCapabilities,
  transferringAgentId,
  onAssign,
  onRemove,
}: {
  selectedSwarm: SwarmProfile;
  myIdleAgents: AgentProfile[];
  selectedCapabilities: string[];
  transferringAgentId: string | null;
  onAssign: (agentId: string, swarmTbaAddress: string) => Promise<void>;
  onRemove: (agentId: string, swarmTbaAddress: string) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-outline-variant/10 pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-label text-[10px] uppercase tracking-widest text-primary">Active Swarm</p>
          <h3 className="mt-1 font-headline text-3xl font-bold text-on-surface">{selectedSwarm.name}</h3>
          <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-on-surface-variant">{selectedSwarm.description}</p>
        </div>
        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3">
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Swarm TBA</p>
          <p className="mt-1 font-mono text-sm text-primary">{truncateAddress(selectedSwarm.tbaAddress)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SwarmMetric icon="hub" label="Strategy" value={selectedSwarm.strategy} />
        <SwarmMetric icon="group" label="Members" value={String(selectedSwarm.agents.length)} />
        <SwarmMetric icon="bolt" label="Capabilities" value={String(new Set(selectedCapabilities).size)} />
      </div>

      <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 className="font-headline text-lg font-bold text-on-surface">OpenClaw Production Routing</h4>
            <p className="mt-1 font-body text-xs text-on-surface-variant">
              Coordinator resolves this swarm from SwarmNFT ownership, then selects workers by role and equipped skill capability.
            </p>
          </div>
          <span className="rounded border border-tertiary/25 bg-tertiary/10 px-2 py-1 font-label text-[10px] uppercase tracking-widest text-tertiary">
            Proof routed
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-headline text-lg font-bold text-on-surface">Swarm Members</h4>
            <span className="font-label text-xs uppercase tracking-widest text-on-surface-variant">{selectedSwarm.agents.length} assigned</span>
          </div>
          {selectedSwarm.agents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container-lowest p-8 text-center">
              <span className="material-symbols-outlined text-5xl text-outline-variant/50" aria-hidden="true">person_off</span>
              <p className="mt-2 font-body text-sm text-on-surface-variant">Assign agents from your wallet to activate this swarm.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedSwarm.agents.map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  actionLabel="Recall"
                  actionIcon="logout"
                  tone="error"
                  disabled={transferringAgentId === agent.id}
                  onAction={() => void onRemove(agent.id, selectedSwarm.tbaAddress)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-headline text-lg font-bold text-on-surface">Available Agents</h4>
            <span className="font-label text-xs uppercase tracking-widest text-on-surface-variant">{myIdleAgents.length} idle</span>
          </div>
          {myIdleAgents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container-lowest p-8 text-center">
              <span className="material-symbols-outlined text-5xl text-outline-variant/50" aria-hidden="true">inventory_2</span>
              <p className="mt-2 font-body text-sm text-on-surface-variant">No idle agents in this wallet.</p>
              <Link to="/agents" className="mt-4 inline-flex font-label text-xs font-bold uppercase tracking-widest text-primary hover:underline">
                Mint Agents
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myIdleAgents.map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  actionLabel="Assign"
                  actionIcon="login"
                  disabled={transferringAgentId === agent.id}
                  onAction={() => void onAssign(agent.id, selectedSwarm.tbaAddress)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
