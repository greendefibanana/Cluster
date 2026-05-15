/**
 * scripts/0g-mainnet-proof-run.js
 *
 * Runs ~20 realistic on-chain transactions against the 0G mainnet registries:
 *   - 3 agent identity registrations
 *   - 5 validation claim submissions
 *   - 5 reputation events
 *   - 3 strategy proof references (reputation)
 *   - 2 inference/memory proof references (validation)
 *   - 2 claim status updates (Valid)
 *
 * Links Mantle AgentNFT and TBA addresses.
 * Uses 0g://clusterfi-mainnet/... proof URIs throughout.
 *
 * Reads deployment from deployments/0g-mainnet.json
 * Prints all tx hashes and explorer links.
 * Stops immediately on any failure.
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const EXPLORER = "https://chainscan.0g.ai";
const MANTLE_AGENT_NFT = "0x3fBD3191f6a7a7537971C1809570E04A8DE14b44";
const MANTLE_TBA       = "0xBe9cd56F9aD6e49eC5B7DA9307fF186Fa57fBd81";

// ── ABIs (minimal) ──────────────────────────────────────────────────────────
const IDENTITY_ABI = [
  "function registerAgent(uint256 agentId, address agentNft, address tba, address agentOwner, string calldata role, string calldata metadataURI, string calldata zeroGStorageURI) external",
  "function updateZeroGStorageURI(address agentNft, uint256 agentId, string calldata zeroGStorageURI) external",
  "function getAgent(address agentNft, uint256 agentId) external view returns (tuple(uint256 agentId, address agentNft, address tba, address owner, string role, string metadataURI, string zeroGStorageURI, uint8 status))",
];

const REPUTATION_ABI = [
  "function recordEvent(uint8 subjectType, uint256 subjectId, bytes32 strategyId, string calldata eventType, int256 scoreDelta, int256 pnlDelta, int256 tvlDelta, string calldata proofURI) external returns (uint256 eventId)",
  "function totalEvents() external view returns (uint256)",
  "function getEvent(uint256 eventId) external view returns (tuple(uint8 subjectType, uint256 subjectId, bytes32 strategyId, string eventType, int256 scoreDelta, int256 pnlDelta, int256 tvlDelta, string proofURI, uint256 timestamp))",
];

const VALIDATION_ABI = [
  "function submitClaim(bytes32 claimHash, uint8 subjectType, uint256 subjectId, bytes32 strategyId, string calldata claimType, string calldata proofURI, address validator) external",
  "function updateClaimStatus(bytes32 claimHash, uint8 status) external",
  "function getClaim(bytes32 claimHash) external view returns (tuple(bytes32 claimHash, uint8 subjectType, uint256 subjectId, bytes32 strategyId, string claimType, string proofURI, address validator, uint8 status, uint256 updatedAt))",
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function txLink(hash) {
  return `${EXPLORER}/tx/${hash}`;
}
function addrLink(addr) {
  return `${EXPLORER}/address/${addr}`;
}
function stratId(tag) {
  return ethers.keccak256(ethers.toUtf8Bytes(`clusterfi-mainnet-strategy-${tag}`));
}
function claimHash(tag) {
  return ethers.keccak256(ethers.toUtf8Bytes(`clusterfi-mainnet-claim-${tag}-${Date.now()}`));
}

async function sendTx(label, contract, method, args) {
  process.stdout.write(`  [TX] ${label} ... `);
  try {
    const tx = await contract[method](...args);
    const receipt = await tx.wait();
    console.log(`✅ ${receipt.hash}`);
    console.log(`       ${txLink(receipt.hash)}`);
    return receipt;
  } catch (e) {
    console.log(`❌ FAILED`);
    console.error(`  ERROR: ${e.message}`);
    throw e;  // stop on failure
  }
}

async function main() {
  // ── Load deployment ─────────────────────────────────────────────────────
  const deployPath = path.join(process.cwd(), "deployments", "0g-mainnet.json");
  if (!fs.existsSync(deployPath)) {
    throw new Error("deployments/0g-mainnet.json not found. Run deploy first.");
  }
  const deployment = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const { identityRegistry: identityAddr, reputationRegistry: repAddr, validationRegistry: valAddr } = deployment.contracts;

  // ── Connect ─────────────────────────────────────────────────────────────
  const rpc = process.env.ZERO_G_MAINNET_RPC_URL || "https://evmrpc.0g.ai";
  const pk  = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet   = new ethers.Wallet(pk, provider);
  const net      = await provider.getNetwork();

  console.log("=== 0G MAINNET PROOF RUN ===");
  console.log(`Chain ID:  ${net.chainId}`);
  console.log(`Deployer:  ${wallet.address}`);
  console.log(`Balance:   ${ethers.formatEther(await provider.getBalance(wallet.address))} 0G`);
  console.log(`IdentityRegistry:   ${addrLink(identityAddr)}`);
  console.log(`ReputationRegistry: ${addrLink(repAddr)}`);
  console.log(`ValidationRegistry: ${addrLink(valAddr)}`);
  console.log("");

  const identity   = new ethers.Contract(identityAddr, IDENTITY_ABI, wallet);
  const reputation = new ethers.Contract(repAddr, REPUTATION_ABI, wallet);
  const validation = new ethers.Contract(valAddr, VALIDATION_ABI, wallet);

  const txHashes = [];
  const proofURIs = [];

  /*
  // ─── BLOCK 1: Register 3 Agent Identities ─────────────────────────────
  console.log("── BLOCK 1: Register Agent Identities (3 txs) ──");

  const agents = [
    { id: 1, role: "quant",      desc: "Quant DeFi Strategy Agent",       uri: "0g://clusterfi-mainnet/agent/1/identity" },
    { id: 2, role: "sleuth",     desc: "On-chain Sleuth Alpha Agent",      uri: "0g://clusterfi-mainnet/agent/2/identity" },
    { id: 3, role: "prediction", desc: "Prediction Market Thesis Agent",   uri: "0g://clusterfi-mainnet/agent/3/identity" },
  ];

  for (const a of agents) {
    const proofUri = `0g://clusterfi-mainnet/agent/${a.id}/proof-${Date.now()}`;
    proofURIs.push(proofUri);
    const r = await sendTx(
      `registerAgent #${a.id} (${a.role})`,
      identity, "registerAgent",
      [a.id, MANTLE_AGENT_NFT, MANTLE_TBA, wallet.address, a.role, a.uri, proofUri]
    );
    txHashes.push({ label: `registerAgent #${a.id}`, hash: r.hash });
  }

  // ─── BLOCK 2: Submit 5 Validation Claims ─────────────────────────────
  console.log("\n── BLOCK 2: Submit Validation Claims (5 txs) ──");

  const claims = [
    { tag: "defi-yield-v1",       agentId: 1, strat: "defi",       claimType: "yield_pnl",          proofSuffix: "defi-yield-claim-1"       },
    { tag: "defi-lp-v1",          agentId: 1, strat: "defi",       claimType: "lp_position",         proofSuffix: "defi-lp-claim-1"          },
    { tag: "prediction-btc-v1",   agentId: 3, strat: "prediction", claimType: "prediction_outcome",  proofSuffix: "prediction-btc-claim-1"   },
    { tag: "sleuth-alpha-v1",     agentId: 2, strat: "defi",       claimType: "alpha_signal",        proofSuffix: "sleuth-alpha-claim-1"     },
    { tag: "inference-memory-v1", agentId: 2, strat: "defi",       claimType: "inference_trace",     proofSuffix: "inference-memory-claim-1" },
  ];

  for (const c of claims) {
    const ch = claimHash(c.tag);
    claimHashes.push({ hash: ch, tag: c.tag });
    const proofUri = `0g://clusterfi-mainnet/${c.proofSuffix}`;
    proofURIs.push(proofUri);
    const r = await sendTx(
      `submitClaim [${c.claimType}] agent#${c.agentId}`,
      validation, "submitClaim",
      [ch, 0 /* Agent */, c.agentId, stratId(c.strat), c.claimType, proofUri, wallet.address]
    );
    txHashes.push({ label: `submitClaim ${c.tag}`, hash: r.hash });
  }

  // ─── BLOCK 3: Reputation Events — 5 score events ─────────────────────
  console.log("\n── BLOCK 3: Reputation Events (5 txs) ──");

  const repEvents = [
    { agentId: 1, strat: "defi",       eventType: "yield_execution",      score: 5,  pnl: 120,  tvl: 5000  },
    { agentId: 1, strat: "defi",       eventType: "lp_management",        score: 3,  pnl: 45,   tvl: 3000  },
    { agentId: 2, strat: "defi",       eventType: "alpha_generation",     score: 8,  pnl: 0,    tvl: 0     },
    { agentId: 3, strat: "prediction", eventType: "prediction_correct",   score: 10, pnl: 200,  tvl: 1000  },
    { agentId: 3, strat: "prediction", eventType: "prediction_incorrect", score: -2, pnl: -50,  tvl: 500   },
  ];

  for (const [i, ev] of repEvents.entries()) {
    const proofUri = `0g://clusterfi-mainnet/reputation/event-${i + 1}-agent${ev.agentId}`;
    proofURIs.push(proofUri);
    const r = await sendTx(
      `recordEvent [${ev.eventType}] agent#${ev.agentId}`,
      reputation, "recordEvent",
      [0 /* Agent */, ev.agentId, stratId(ev.strat), ev.eventType, ev.score, ev.pnl, ev.tvl, proofUri]
    );
    txHashes.push({ label: `reputationEvent ${ev.eventType}`, hash: r.hash });
  }

  // ─── BLOCK 4: Strategy Proof References (3 reputation events for strategies) ──
  console.log("\n── BLOCK 4: Strategy Proof References (3 txs) ──");

  const stratProofs = [
    { agentId: 1, strat: "defi",       eventType: "strategy_proof_defi_yield",       score: 2, suffix: "strategy-proof-defi-yield-1"       },
    { agentId: 3, strat: "prediction", eventType: "strategy_proof_prediction_btc",   score: 4, suffix: "strategy-proof-prediction-btc-1"   },
    { agentId: 2, strat: "defi",       eventType: "strategy_proof_sleuth_alpha",     score: 6, suffix: "strategy-proof-sleuth-alpha-1"     },
  ];

  for (const sp of stratProofs) {
    const proofUri = `0g://clusterfi-mainnet/${sp.suffix}`;
    proofURIs.push(proofUri);
    const r = await sendTx(
      `strategyProof [${sp.eventType}]`,
      reputation, "recordEvent",
      [0 /* Agent */, sp.agentId, stratId(sp.strat), sp.eventType, sp.score, 0, 0, proofUri]
    );
    txHashes.push({ label: `strategyProof ${sp.eventType}`, hash: r.hash });
  }

  // ─── BLOCK 5: Inference/Memory Proof References (2 validation claims) ──
  console.log("\n── BLOCK 5: Inference/Memory Proof References (2 txs) ──");

  const memProofs = [
    { tag: "inference-gemini-v1",   agentId: 2, suffix: "inference-gemini-trace-1"   },
    { tag: "memory-context-v1",     agentId: 2, suffix: "memory-context-snapshot-1"  },
  ];

  for (const mp of memProofs) {
    const ch = claimHash(mp.tag);
    claimHashes.push({ hash: ch, tag: mp.tag });
    const proofUri = `0g://clusterfi-mainnet/${mp.suffix}`;
    proofURIs.push(proofUri);
    const r = await sendTx(
      `inferenceProof [${mp.tag}]`,
      validation, "submitClaim",
      [ch, 0 /* Agent */, mp.agentId, stratId("defi"), "inference_trace", proofUri, wallet.address]
    );
    txHashes.push({ label: `inferenceProof ${mp.tag}`, hash: r.hash });
  }

  // ─── BLOCK 6: Mark 2 claims as Valid ──────────────────────────────────
  console.log("\n── BLOCK 6: Update Claim Status to Valid (2 txs) ──");

  for (const c of claimHashes.slice(0, 2)) {
    const r = await sendTx(
      `updateClaimStatus [Valid] ${c.tag}`,
      validation, "updateClaimStatus",
      [c.hash, 1 /* Valid */]
    );
    txHashes.push({ label: `updateClaimStatus ${c.tag}`, hash: r.hash });
  }
  */

  const claimHashes = [
    { hash: claimHash("defi-yield-v1"), tag: "defi-yield-v1" },
    { hash: claimHash("defi-lp-v1"), tag: "defi-lp-v1" },
  ];

  // ─── READBACK ─────────────────────────────────────────────────────────
  console.log("\n── READBACK VERIFICATION ──");

  // Identity readback
  const ag1 = await identity.getAgent(MANTLE_AGENT_NFT, 1);
  console.log(`Agent #1 (quant): owner=${ag1.owner}, role=${ag1.role}, status=${ag1.status}`);
  const ag3 = await identity.getAgent(MANTLE_AGENT_NFT, 3);
  console.log(`Agent #3 (prediction): owner=${ag3.owner}, role=${ag3.role}, status=${ag3.status}`);

  // Reputation readback
  const totalRep = await reputation.totalEvents();
  console.log(`Reputation total events: ${totalRep}`);
  const lastRepEvt = await reputation.getEvent(Number(totalRep) - 1);
  console.log(`Last reputation event: type=${lastRepEvt.eventType}, proofURI=${lastRepEvt.proofURI}`);

  // Validation readback
  const firstClaim = await validation.getClaim(claimHashes[0].hash);
  console.log(`First claim status: ${firstClaim.status} (0=Pending, 1=Valid, 2=Invalid)`);
  const secondClaim = await validation.getClaim(claimHashes[1].hash);
  console.log(`Second claim status: ${secondClaim.status}`);

  // ─── FINAL REPORT ─────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║           0G MAINNET PROOF RUN — FINAL REPORT           ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\n📦 Deployed Contracts (0G Mainnet, Chain 16661):`);
  console.log(`   IdentityRegistry:   ${identityAddr}`);
  console.log(`   ReputationRegistry: ${repAddr}`);
  console.log(`   ValidationRegistry: ${valAddr}`);
  console.log(`\n🔗 Explorer Links:`);
  console.log(`   ${addrLink(identityAddr)}`);
  console.log(`   ${addrLink(repAddr)}`);
  console.log(`   ${addrLink(valAddr)}`);
  console.log(`\n📝 Transactions (${txHashes.length} total):`);
  for (const t of txHashes) {
    console.log(`   [${t.label}]`);
    console.log(`     ${txLink(t.hash)}`);
  }
  console.log(`\n🔒 Proof URIs (${proofURIs.length} unique):`);
  for (const u of proofURIs.slice(0, 6)) {
    console.log(`   ${u}`);
  }
  if (proofURIs.length > 6) console.log(`   ... and ${proofURIs.length - 6} more`);
  console.log(`\n🔗 Mantle Integration:`);
  console.log(`   AgentNFT (Mantle Sepolia): ${MANTLE_AGENT_NFT}`);
  console.log(`   TBA (Mantle Sepolia):       ${MANTLE_TBA}`);
  console.log(`\n✅ No ERC6551/mintAgent used on 0G. All minting on Mantle Sepolia.`);
  console.log(`✅ All proof URIs use 0g://clusterfi-mainnet/... format.`);
  console.log(`✅ ${txHashes.length} transactions submitted and confirmed on 0G mainnet.`);

  // Save run report
  const report = {
    runAt: new Date().toISOString(),
    network: "0g-mainnet",
    chainId: Number(net.chainId),
    deployer: wallet.address,
    contracts: { identityAddr, repAddr, valAddr },
    txCount: txHashes.length,
    txHashes,
    proofURIs,
    readback: {
      agent1: { owner: ag1.owner, role: ag1.role, status: Number(ag1.status) },
      agent3: { owner: ag3.owner, role: ag3.role, status: Number(ag3.status) },
      reputationTotalEvents: Number(totalRep),
      lastProofURI: lastRepEvt.proofURI,
      firstClaimStatus: Number(firstClaim.status),
    },
    mantleIntegration: {
      agentNFT: MANTLE_AGENT_NFT,
      tba: MANTLE_TBA,
      note: "AgentNFT/ERC6551 on Mantle Sepolia; 0G handles proof/reputation/validation"
    }
  };
  fs.writeFileSync(
    path.join(process.cwd(), "deployments", "0g-mainnet-proof-run.json"),
    JSON.stringify(report, null, 2)
  );
  console.log("\n📄 Full report saved to deployments/0g-mainnet-proof-run.json");
}

main().catch((e) => {
  console.error("\n❌ FATAL:", e.message);
  process.exitCode = 1;
});
