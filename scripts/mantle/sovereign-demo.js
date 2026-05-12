import "dotenv/config";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { CrossChainIntentEngineService } from "../../gateway/crosschain/intentEngine.js";
import { AcrossBridgeAdapter, AcrossQuoteService, MockBridgeAdapter } from "../../gateway/crosschain/bridgeAdapters.js";
import { MockZeroGProvider } from "../../gateway/zeroGProvider.js";

const STATE_PATH = path.join(process.cwd(), "deployments", "sovereign-demo-state.json");
const command = process.argv[2] || "demo";
const args = parseArgs(process.argv.slice(3));
const state = loadState();

try {
  const result = await run(command);
  saveState();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

async function run(name) {
  switch (name) {
    case "demo": {
      const account = await createAccount();
      await deposit(account.id, Number(args.amount || 1000));
      approveAgent(account.id, args.agent || "agent-sleuth-1");
      const intent = await createIntent("solana-meme", account.id);
      const execution = await executeIntent(intent.id);
      return { account, intent, execution, balance: state.accounts[account.id].balance };
    }
    case "sovereign:create":
      return createAccount();
    case "sovereign:deposit":
      return deposit(args.account || latestAccountId(), Number(args.amount || 1000));
    case "sovereign:approve-agent":
      return approveAgent(args.account || latestAccountId(), args.agent || "agent-1");
    case "crosschain:solana-meme":
      return executeStrategy("solana-meme", args.account || latestAccountId());
    case "crosschain:eth-yield":
      return executeStrategy("eth-yield", args.account || latestAccountId());
    case "crosschain:hyperliquid":
      return executeStrategy("hyperliquid", args.account || latestAccountId());
    case "intent:create":
      return createIntent(args.strategy || "mantle-yield", args.account || latestAccountId());
    case "intent:execute":
      return executeIntent(args.intent || latestIntentId());
    case "bridge:test": {
      const bridge = args.bridge === "across" ? new AcrossBridgeAdapter({ simulationMode: true }) : new MockBridgeAdapter();
      const quoteService = new AcrossQuoteService({ bridge });
      const intent = sampleIntent();
      return { bridge: bridge.name, quote: await quoteService.getQuote(intent) };
    }
    case "reputation:update":
      return addReputation(args.strategy || latestIntentId(), args.delta || 5);
    case "validation:prove":
      return proveValidation(args.strategy || latestIntentId());
    default:
      throw new Error(`Unknown sovereign demo command: ${name}`);
  }
}

async function createAccount() {
  const id = `sovereign-${randomUUID()}`;
  const account = {
    id,
    owner: args.user || "demo-user",
    homeChain: Number(args.chain || 5000),
    label: args.label || "Primary Sovereign Account",
    balance: 0,
    approvedAgents: [],
    approvedClusters: [],
    approvedAdapters: ["solanaMeme", "ethereumYield", "hyperliquid", "mantleYield"],
    chainPermissions: [5000, 5003, 1, 56, 8453, 42161, 7565164],
    maxAllocation: Number(args.maxAllocation || 5000),
    maxSlippageBps: Number(args.maxSlippageBps || 100),
    riskProfile: args.risk || "moderate",
    paused: false,
    createdAt: new Date().toISOString(),
  };
  state.accounts[id] = account;
  return account;
}

function deposit(accountId, amount) {
  const account = requireAccount(accountId);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount must be positive");
  account.balance += amount;
  addHistory({ type: "deposit", accountId, amount });
  return account;
}

function approveAgent(accountId, agent) {
  const account = requireAccount(accountId);
  if (!account.approvedAgents.includes(agent)) account.approvedAgents.push(agent);
  addHistory({ type: "approve_agent", accountId, agent });
  return account;
}

async function executeStrategy(strategyType, accountId) {
  const intent = await createIntent(strategyType, accountId);
  return executeIntent(intent.id);
}

async function createIntent(strategyType, accountId) {
  const account = requireAccount(accountId);
  const targetChain = targetChainFor(strategyType);
  if (!account.chainPermissions.includes(targetChain)) {
    throw new Error(`Sovereign Account does not allow chain ${targetChain}`);
  }
  const amount = Number(args.amount || Math.min(500, account.balance));
  if (amount <= 0 || amount > account.balance) throw new Error("insufficient Sovereign Account demo balance");
  const engine = new CrossChainIntentEngineService();
  const intent = await engine.createIntent({
    sourceChain: account.homeChain,
    targetChain,
    asset: args.asset || "mUSD",
    amount,
    strategyType,
    userSovereignAccount: account.id,
    riskConstraints: { maxSlippageBps: account.maxSlippageBps, maxRiskScore: Number(args.maxRiskScore || 90) },
  });
  state.intents[intent.id] = intent;
  addHistory({ type: "intent_created", accountId, intentId: intent.id, strategyType });
  return intent;
}

async function executeIntent(intentId) {
  const intent = state.intents[intentId];
  if (!intent) throw new Error(`Intent not found: ${intentId}`);
  const account = requireAccount(intent.userSovereignAccount);
  const engine = new CrossChainIntentEngineService();
  engine.intents.set(intent.id, intent);
  const result = await engine.executeIntent(intent.id);
  account.balance -= intent.amount;
  state.intents[intent.id] = result.intent;
  state.socialEvents.push(result.socialEvent);
  state.reputationEvents.push(result.reputationEvent);
  addHistory({ type: "intent_executed", accountId: account.id, intentId: intent.id, proofURI: result.proof.uri });
  return result;
}

async function addReputation(strategyId, delta) {
  const event = {
    id: randomUUID(),
    strategyId,
    eventType: "reputation_update",
    scoreDelta: Number(delta),
    createdAt: new Date().toISOString(),
  };
  state.reputationEvents.push(event);
  return event;
}

async function proveValidation(strategyId) {
  const zeroG = new MockZeroGProvider({ namespace: "sovereign-validation" });
  const proof = await zeroG.uploadValidationProof(strategyId, {
    strategyId,
    events: state.reputationEvents.filter((event) => event.strategyId === strategyId),
  });
  addHistory({ type: "validation_proof", strategyId, proofURI: proof.uri });
  return proof;
}

function sampleIntent() {
  return {
    id: "sample-intent",
    sourceChain: 5000,
    targetChain: 1,
    asset: "0x0000000000000000000000000000000000000001",
    amount: 1000,
    userSovereignAccount: "sovereign-demo",
  };
}

function targetChainFor(strategyType) {
  if (strategyType === "solana-meme") return 7565164;
  if (strategyType === "eth-yield") return 1;
  if (strategyType === "hyperliquid") return 42161;
  if (strategyType === "bnb-launch") return 56;
  return 5000;
}

function requireAccount(accountId) {
  const account = state.accounts[accountId];
  if (!account) throw new Error(`Sovereign Account not found: ${accountId}`);
  return account;
}

function latestAccountId() {
  const ids = Object.keys(state.accounts);
  if (!ids.length) throw new Error("No Sovereign Account exists. Run demo:sovereign:create first.");
  return ids[ids.length - 1];
}

function latestIntentId() {
  const ids = Object.keys(state.intents);
  if (!ids.length) throw new Error("No intent exists. Run demo:intent:create first.");
  return ids[ids.length - 1];
}

function addHistory(event) {
  state.history.push({ id: randomUUID(), createdAt: new Date().toISOString(), ...event });
}

function loadState() {
  if (!fs.existsSync(STATE_PATH)) {
    return { accounts: {}, intents: {}, socialEvents: [], reputationEvents: [], history: [] };
  }
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
}

function saveState() {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function parseArgs(values) {
  const parsed = {};
  for (let i = 0; i < values.length; i += 1) {
    if (!values[i].startsWith("--")) continue;
    const key = values[i].slice(2);
    const next = values[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
