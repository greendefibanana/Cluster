/**
 * setup-meme-swarm.js
 *
 * One-time setup: defines 4 meme-loop skills on SkillNFT, mints a meme swarm
 * with worker agents, and equips each agent with its skill.
 *
 * Usage:  node scripts/setup-meme-swarm.js
 * Requires deployed contracts and DEPLOYER_PRIVATE_KEY in .env
 */

import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const RPC = process.env.BSC_TESTNET_RPC_URL;
const KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!RPC || !KEY) { console.error("BSC_TESTNET_RPC_URL and DEPLOYER_PRIVATE_KEY required"); process.exit(1); }

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(KEY, provider);

/* ---------- load deployment ---------- */
const deployPath = path.join(process.cwd(), "deployments", "bsc-testnet.json");
let deployment;
try { deployment = JSON.parse(fs.readFileSync(deployPath, "utf8")); }
catch { console.error("Run deploy script first — deployments/bsc-testnet.json not found"); process.exit(1); }

const C = deployment.contracts;

/* ---------- ABIs ---------- */
const agentAbi = [
  "function mintAgent(address to, string name, string role, string description, bytes32 salt) returns (uint256 agentId, address tba)",
  "function ownerOf(uint256) view returns (address)",
  "function tbas(uint256) view returns (address)",
  "function transferFrom(address from, address to, uint256 tokenId)"
];
const swarmAbi = [
  "function mintSwarm(address to, string name, string strategy, string description, bytes32 salt) returns (uint256 swarmId, address tba)",
  "function tbas(uint256) view returns (address)"
];
const skillAbi = [
  "function defineSkill(string name, string skillType, string capabilityTag, string description, string skillMarkdown) returns (uint256)",
  "function mintSkill(address to, uint256 skillId, uint256 amount)",
  "function setApprovalForAll(address operator, bool approved)",
  "function nextSkillId() view returns (uint256)"
];
const managerAbi = [
  "function equipSkill(uint256 agentId, uint256 skillId, uint256 amount)"
];

async function main() {
  const agentNFT = new ethers.Contract(C.agentNFT, agentAbi, wallet);
  const swarmNFT = new ethers.Contract(C.swarmNFT, swarmAbi, wallet);
  const skillNFT = new ethers.Contract(C.skillNFT, skillAbi, wallet);
  const manager = new ethers.Contract(C.skillManager, managerAbi, wallet);

  console.log("=== Meme Swarm Setup ===\n");

  /* ---------- 1. Define skills ---------- */
  const skills = [
    {
      name: "Alpha Scout",
      type: "alpha_scout",
      capability: "alpha_scout",
      description: "Scans market signals for meme-coin alpha",
      markdown: "# Alpha Scout\n\nCapability: alpha_scout\n\n- Scans trending keywords, social signals, token metadata\n- Produces ranked thesis: launch / don't launch\n- Writes structured idea objects for downstream agents"
    },
    {
      name: "Meme Creator",
      type: "meme_creator",
      capability: "meme_creator",
      description: "Generates token name, ticker, lore, and launch copy",
      markdown: "# Meme Creator\n\nCapability: meme_creator\n\n- Turns thesis into token name, ticker, lore\n- Generates launch copy and risk notes\n- Produces image prompts for art agent"
    },
    {
      name: "Image Generator",
      type: "image_generator",
      capability: "image_generator",
      description: "Generates mascot, logo, and token images",
      markdown: "# Image Generator\n\nCapability: image_generator\n\n- Generates mascot, logo, banner, and square token image\n- Off-chain worker, not on-chain\n- One image prompt -> one PNG asset set"
    },
    {
      name: "Token Deployer",
      type: "deployer",
      capability: "deployer",
      description: "Deploys tokens and optionally seeds liquidity",
      markdown: "# Token Deployer\n\nCapability: deployer\n\n- Takes approved concept + metadata\n- Deploys BEP-20 token on BSC testnet\n- Optionally seeds PancakeSwap liquidity\n- Updates agent score if successful"
    }
  ];

  const skillIds = [];
  for (const s of skills) {
    const nextId = await skillNFT.nextSkillId();
    const tx = await skillNFT.defineSkill(s.name, s.type, s.capability, s.description, s.markdown);
    await tx.wait();
    console.log(`Defined skill #${nextId}: ${s.name}`);
    await (await skillNFT.mintSkill(wallet.address, nextId, 1)).wait();
    console.log(`  Minted 1x to deployer`);
    skillIds.push(nextId);
  }

  /* ---------- 2. Mint worker agents ---------- */
  const agentNames = ["Scout", "Creative", "Artist", "Launcher"];
  const agentRoles = ["alpha_scout", "meme_creator", "image_generator", "deployer"];
  const agents = [];

  for (let i = 0; i < agentNames.length; i++) {
    const salt = ethers.keccak256(ethers.toUtf8Bytes(`meme-${agentNames[i]}-${Date.now()}`));
    const tx = await agentNFT.mintAgent(wallet.address, agentNames[i], agentRoles[i], `${agentNames[i]} agent for meme loop`, salt);
    const receipt = await tx.wait();
    const agentId = receipt.logs.length > 0 ? receipt.logs[0].args?.[0] || (await agentNFT.tbas(1n) ? 1n : 0n) : 0n;

    // Find the agentId from the event
    let mintedId;
    for (const log of receipt.logs) {
      try {
        const iface = new ethers.Interface(["event AgentMinted(uint256 indexed agentId, address indexed owner, address indexed tba, string role)"]);
        const parsed = iface.parseLog(log);
        if (parsed) { mintedId = parsed.args[0]; break; }
      } catch {}
    }
    const tba = await agentNFT.tbas(mintedId);
    console.log(`Minted Agent #${mintedId} (${agentNames[i]}) -> TBA ${tba}`);
    agents.push({ id: mintedId, tba, name: agentNames[i], role: agentRoles[i] });
  }

  /* ---------- 3. Equip each agent with its skill ---------- */
  await (await skillNFT.setApprovalForAll(C.skillManager, true)).wait();

  for (let i = 0; i < agents.length; i++) {
    await (await manager.equipSkill(agents[i].id, skillIds[i], 1)).wait();
    console.log(`Equipped Agent #${agents[i].id} (${agents[i].name}) with skill #${skillIds[i]}`);
  }

  /* ---------- 4. Mint swarm and transfer workers ---------- */
  const swarmSalt = ethers.keccak256(ethers.toUtf8Bytes(`meme-swarm-${Date.now()}`));
  const swarmTx = await swarmNFT.mintSwarm(wallet.address, "Meme Launch Swarm", "meme-launch", "Four.meme hackathon swarm", swarmSalt);
  const swarmReceipt = await swarmTx.wait();

  let swarmId;
  for (const log of swarmReceipt.logs) {
    try {
      const iface = new ethers.Interface(["event SwarmMinted(uint256 indexed swarmId, address indexed owner, address indexed tba, string strategy)"]);
      const parsed = iface.parseLog(log);
      if (parsed) { swarmId = parsed.args[0]; break; }
    } catch {}
  }
  const swarmTba = await swarmNFT.tbas(swarmId);
  console.log(`\nMinted Swarm #${swarmId} -> TBA ${swarmTba}`);

  for (const agent of agents) {
    await (await agentNFT.transferFrom(wallet.address, swarmTba, agent.id)).wait();
    console.log(`  Transferred Agent #${agent.id} (${agent.name}) into swarm`);
  }

  /* ---------- 4.5. Trust Configuration for Nested Execution ---------- */
  console.log("\n  Authorizing execution paths...");
  const tbaAbi = ["function setExecutor(address executor, bool allowed) external"];
  const sTbaC = new ethers.Contract(swarmTba, tbaAbi, wallet);
  await (await sTbaC.setExecutor(C.executionHub, true)).wait();
  console.log("  ✅ Set executionHub as authorized on swarm TBA");

  const launcherAgent = agents.find(a => a.role === "deployer");
  if (launcherAgent) {
    const factoryAbi = ["function setTrustedCaller(address caller, bool allowed) external"];
    const factoryC = new ethers.Contract(C.tokenFactory, factoryAbi, wallet);
    await (await factoryC.setTrustedCaller(launcherAgent.tba, true)).wait();
    console.log(`  ✅ Set Launcher TBA (${launcherAgent.tba}) as trusted caller on Factory`);
  }


  /* ---------- 5. Save config ---------- */
  const memeConfig = {
    swarmId: swarmId.toString(),
    swarmTba,
    agents: agents.map((a, i) => ({
      id: a.id.toString(),
      tba: a.tba,
      name: a.name,
      role: agentRoles[i],
      skillId: skillIds[i].toString()
    }))
  };
  fs.writeFileSync(
    path.join(process.cwd(), "deployments", "meme-swarm.json"),
    JSON.stringify(memeConfig, null, 2)
  );
  console.log("\nSaved deployments/meme-swarm.json");
  console.log("\n=== Setup complete ===");
}

main().catch((e) => { console.error(e); process.exit(1); });
