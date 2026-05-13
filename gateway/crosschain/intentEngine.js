import { randomUUID } from "crypto";
import { createZeroGStorageProvider } from "../zeroG/storageProvider.js";
import { createZeroGDAProvider } from "../zeroG/daProvider.js";
import { AcrossBridgeAdapter, MockBridgeAdapter } from "./bridgeAdapters.js";
import { adapterKindForStrategy, createChainAdapter } from "./chainAdapters.js";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.GATEWAY_ENV === "production";
}

function crosschainExecutionDisabled() {
  return isProductionRuntime() || process.env.DISABLE_CROSSCHAIN_EXECUTION === "true";
}

export class CrossChainIntentEngineService {
  constructor({
    zeroGStorage = createZeroGStorageProvider(process.env.ZERO_G_PROVIDER || "mock"),
    zeroGDA = createZeroGDAProvider(process.env.ZERO_G_DA_PROVIDER || "mock"),
    bridge = process.env.ACROSS_SIMULATION_MODE === "false" ? new AcrossBridgeAdapter() : new MockBridgeAdapter(),
  } = {}) {
    if (isProductionRuntime() && bridge instanceof MockBridgeAdapter && process.env.ALLOW_PRODUCTION_MOCKS !== "true") {
      throw new Error("MockBridgeAdapter is disabled in production");
    }
    this.zeroGStorage = zeroGStorage;
    this.zeroGDA = zeroGDA;
    this.bridge = bridge;
    this.intents = new Map();
  }

  async createIntent(input) {
    const intent = {
      id: input.id || randomUUID(),
      sourceChain: input.sourceChain || 5000,
      targetChain: input.targetChain,
      asset: input.asset,
      amount: Number(input.amount),
      strategyType: input.strategyType,
      adapter: input.adapter || adapterKindForStrategy(input.strategyType),
      userSovereignAccount: input.userSovereignAccount,
      riskConstraints: input.riskConstraints || { maxSlippageBps: 100, maxRiskScore: 80 },
      proofURI: input.proofURI || null,
      intentStatus: "pending",
      createdAt: new Date().toISOString(),
    };
    const proof = await this.zeroGStorage.uploadStrategyProof(intent.id, { type: "cross-chain-intent", intent });
    intent.proofURI = proof.uri;
    this.intents.set(intent.id, intent);
    await this.zeroGDA.publishAgentActivityLog({ type: "intent_created", intentId: intent.id, proofURI: proof.uri });
    return intent;
  }

  async executeIntent(intentId) {
    if (crosschainExecutionDisabled()) {
      throw new Error("Cross-chain execution is disabled; intent remains pending until a verified settlement path is enabled");
    }
    const intent = this.intents.get(intentId);
    if (!intent) throw new Error(`Intent not found: ${intentId}`);
    const chainAdapter = createChainAdapter(intent.adapter);
    const simulation = await chainAdapter.simulate(intent);
    if (!simulation.valid) throw new Error("Intent failed adapter validation");
    if (simulation.riskScore > Number(intent.riskConstraints.maxRiskScore || 100)) {
      intent.intentStatus = "risk_limit_triggered";
      await this.zeroGDA.publishStrategyExecutionLog({ type: "risk_limit_triggered", intentId, simulation });
      return { intent, simulation };
    }
    const bridgeReceipt = await this.bridge.execute(intent);
    const execution = await chainAdapter.execute(intent, bridgeReceipt);
    const proofPayload = await chainAdapter.generateProof(intent, execution);
    const proof = await this.zeroGStorage.uploadValidationProof(intent.id, proofPayload);
    const socialEvent = this.createSocialCapitalEvent(intent, execution, proof.uri);
    intent.intentStatus = "executed";
    intent.execution = execution;
    intent.validationProofURI = proof.uri;
    await this.zeroGDA.publishStrategyExecutionLog({ type: "intent_executed", intentId, bridgeReceipt, proofURI: proof.uri });
    return { intent, bridgeReceipt, execution, proof, socialEvent, reputationEvent: this.createReputationEvent(intent, execution, proof.uri) };
  }

  createSocialCapitalEvent(intent, execution, proofURI) {
    return {
      id: randomUUID(),
      actorType: "sovereign_account",
      actorId: intent.userSovereignAccount,
      actionType: execution.eventType,
      title: `${execution.adapter} executed ${intent.strategyType}`,
      body: `Sovereign Account coordinated ${intent.amount} units from chain ${intent.sourceChain} to ${execution.chain}.`,
      strategyId: intent.id,
      instrumentType: intent.strategyType,
      chainId: intent.targetChain,
      contractAddress: null,
      proofURI,
      pnl: execution.pnl,
      tvl: execution.tvl,
      riskScore: execution.riskScore,
      createdAt: new Date().toISOString(),
    };
  }

  createReputationEvent(intent, execution, proofURI) {
    return {
      subjectType: "strategy",
      subjectId: intent.id,
      strategyId: intent.id,
      eventType: execution.eventType,
      scoreDelta: Math.max(1, 10 - Math.floor(execution.riskScore / 10)),
      chainMetric: `${execution.chain.toLowerCase()}_${intent.strategyType}_score`,
      proofURI,
      createdAt: new Date().toISOString(),
    };
  }
}
