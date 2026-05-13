import fs from "fs";
import path from "path";
import hre from "hardhat";
import { createLocalZeroGProvider, createLocalZeroGDAProvider } from "../../gateway/zeroG/localProvider.js";
import { buildDefiMarketContext } from "../../packages/intelligence/data-adapters/defillama/index.js";
import { buildPredictionMarketContext } from "../../packages/intelligence/data-adapters/prediction/index.js";
import { buildNewsContext } from "../../packages/intelligence/data-adapters/news/index.js";
import { taskPrompt, validateStrategyOutput } from "../../packages/intelligence/agent-tasks/index.js";
import { validatePolicy } from "../../packages/intelligence/policy-engine/index.js";
import { uploadDefiStrategyProof, uploadPredictionStrategyProof, uploadPolicyDecisionProof } from "../../packages/intelligence/proofs/index.js";
import { AgentReputationService } from "../../packages/intelligence/reputation/index.js";
import { GeminiProvider } from "../../gateway/intelligence/providers/geminiProvider.js";
import { OpenAIProvider, CustomOpenAICompatibleProvider } from "../../gateway/intelligence/providers/openaiProvider.js";
import { AnthropicProvider } from "../../gateway/intelligence/providers/anthropicProvider.js";
import { MockProvider } from "../../gateway/intelligence/providers/mockProvider.js";

const { ethers } = hre;
export const LOCAL_DEPLOYMENT_PATH = path.join(process.cwd(), "deployments", "local-mantle.json");

export async function deployLocalMantle({ write = true } = {}) {
  const [deployer, user, agent, validator, outsider] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  const MockERC6551Registry = await ethers.getContractFactory("MockERC6551Registry");
  const erc6551Registry = await MockERC6551Registry.deploy();
  await erc6551Registry.waitForDeployment();

  const PerformanceRank = await ethers.getContractFactory("PerformanceRank");
  const performanceRank = await PerformanceRank.deploy(deployer.address);
  await performanceRank.waitForDeployment();

  const Token = await ethers.getContractFactory("MockPaymentToken");
  const paymentToken = await Token.deploy(user.address, ethers.parseUnits("100000", 18));
  await paymentToken.waitForDeployment();

  const ERC6551AgentAccount = await ethers.getContractFactory("ERC6551AgentAccount");
  const accountImplementation = await ERC6551AgentAccount.deploy();
  await accountImplementation.waitForDeployment();

  const Identity = await ethers.getContractFactory("AgentIdentityRegistry");
  const identityRegistry = await Identity.deploy(deployer.address);
  await identityRegistry.waitForDeployment();

  const Reputation = await ethers.getContractFactory("AgentReputationRegistry");
  const reputationRegistry = await Reputation.deploy(deployer.address);
  await reputationRegistry.waitForDeployment();

  const Validation = await ethers.getContractFactory("AgentValidationRegistry");
  const validationRegistry = await Validation.deploy(deployer.address);
  await validationRegistry.waitForDeployment();

  const AgentNFT = await ethers.getContractFactory("AgentNFT");
  const agentNFT = await AgentNFT.deploy(
    deployer.address,
    await erc6551Registry.getAddress(),
    await accountImplementation.getAddress(),
    await performanceRank.getAddress(),
  );
  await agentNFT.waitForDeployment();
  await (await identityRegistry.setTrustedRegistrar(await agentNFT.getAddress(), true)).wait();
  await (await agentNFT.setIdentityRegistry(await identityRegistry.getAddress())).wait();

  const ClusterNFT = await ethers.getContractFactory("ClusterNFT");
  const clusterNFT = await ClusterNFT.deploy(deployer.address, await erc6551Registry.getAddress(), await accountImplementation.getAddress());
  await clusterNFT.waitForDeployment();

  const SkillNFT = await ethers.getContractFactory("SkillNFT");
  const skillNFT = await SkillNFT.deploy(deployer.address);
  await skillNFT.waitForDeployment();

  const SkillManager = await ethers.getContractFactory("AgentSkillManager");
  const skillManager = await SkillManager.deploy(await agentNFT.getAddress(), await skillNFT.getAddress(), await performanceRank.getAddress());
  await skillManager.waitForDeployment();
  await (await skillNFT.setManager(await skillManager.getAddress(), true)).wait();

  const yieldSkillId = await definePublicSkill(skillNFT, {
    name: "Run DeFi Yield Analysis",
    skillType: "defi",
    capabilityTag: "RUN_YIELD_STRATEGY",
    description: "Analyze DeFi yield and propose policy-checked strategy intents",
    md: "Use normalized free data and never execute without Sovereign Account permission.",
  });
  const predictionSkillId = await definePublicSkill(skillNFT, {
    name: "Prediction Market Thesis",
    skillType: "prediction",
    capabilityTag: "OPEN_PREDICTION_MARKET",
    description: "Analyze prediction markets and produce validated theses",
    md: "Use Polymarket public data and event context only.",
  });

  const Registry = await ethers.getContractFactory("SovereignAccountRegistry");
  const sovereignRegistry = await Registry.deploy(deployer.address);
  await sovereignRegistry.waitForDeployment();

  const Factory = await ethers.getContractFactory("SovereignAccountFactory");
  const sovereignFactory = await Factory.deploy(deployer.address, await sovereignRegistry.getAddress());
  await sovereignFactory.waitForDeployment();
  await (await sovereignRegistry.setTrustedFactory(await sovereignFactory.getAddress(), true)).wait();

  const DeFiYieldAdapter = await ethers.getContractFactory("DeFiYieldAdapter");
  const defiYieldAdapter = await DeFiYieldAdapter.deploy();
  await defiYieldAdapter.waitForDeployment();

  const PredictionMarketAdapter = await ethers.getContractFactory("PredictionMarketAdapter");
  const predictionMarketAdapter = await PredictionMarketAdapter.deploy();
  await predictionMarketAdapter.waitForDeployment();

  await (await reputationRegistry.setTrustedWriter(deployer.address, true)).wait();
  await (await validationRegistry.setTrustedSubmitter(deployer.address, true)).wait();

  const deployment = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    accounts: {
      deployer: deployer.address,
      user: user.address,
      agent: agent.address,
      validator: validator.address,
      outsider: outsider.address,
    },
    contracts: {
      erc6551Registry: await erc6551Registry.getAddress(),
      performanceRank: await performanceRank.getAddress(),
      paymentToken: await paymentToken.getAddress(),
      accountImplementation: await accountImplementation.getAddress(),
      identityRegistry: await identityRegistry.getAddress(),
      reputationRegistry: await reputationRegistry.getAddress(),
      validationRegistry: await validationRegistry.getAddress(),
      agentNFT: await agentNFT.getAddress(),
      clusterNFT: await clusterNFT.getAddress(),
      skillNFT: await skillNFT.getAddress(),
      skillManager: await skillManager.getAddress(),
      sovereignRegistry: await sovereignRegistry.getAddress(),
      sovereignFactory: await sovereignFactory.getAddress(),
      defiYieldAdapter: await defiYieldAdapter.getAddress(),
      predictionMarketAdapter: await predictionMarketAdapter.getAddress(),
    },
    skills: {
      yieldSkillId: yieldSkillId.toString(),
      predictionSkillId: predictionSkillId.toString(),
    },
  };

  if (write) {
    fs.mkdirSync(path.dirname(LOCAL_DEPLOYMENT_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_DEPLOYMENT_PATH, JSON.stringify(deployment, null, 2));
  }

  return { deployment, contracts: { agentNFT, clusterNFT, skillNFT, skillManager, sovereignFactory, sovereignRegistry, paymentToken, defiYieldAdapter, predictionMarketAdapter, identityRegistry, reputationRegistry, validationRegistry }, signers: { deployer, user, agent, validator, outsider } };
}

export async function seedLocalMantle(existing = null) {
  const fixture = existing || await deployLocalMantle();
  const { contracts, signers, deployment } = fixture;
  const { user } = signers;

  const mintTx = await contracts.agentNFT.connect(user).mintAgent(
    user.address,
    "Local Yield Agent",
    "defi",
    "Local validator agent for ClusterFi v1 yield strategy tests",
    ethers.id("local-yield-agent"),
  );
  const mintReceipt = await mintTx.wait();
  const agentEvent = parseEvent(mintReceipt, contracts.agentNFT, "AgentMinted");
  const agentId = agentEvent.args.agentId;
  const agentTba = agentEvent.args.tba;

  await (await contracts.skillNFT.connect(user).publicMintSkill(BigInt(deployment.skills.yieldSkillId), 1)).wait();
  await (await contracts.skillNFT.connect(user).setApprovalForAll(await contracts.skillManager.getAddress(), true)).wait();
  await (await contracts.skillManager.connect(user).equipSkill(agentId, BigInt(deployment.skills.yieldSkillId), 1)).wait();

  const clusterTx = await contracts.clusterNFT.connect(user).mintCluster(
    user.address,
    "Local DeFi Cluster",
    "free-first-defi",
    "Local cluster for e2e proof testing",
    "0g-local://pending",
    ethers.id("local-defi-cluster"),
  );
  const clusterReceipt = await clusterTx.wait();
  const clusterEvent = parseEvent(clusterReceipt, contracts.clusterNFT, "ClusterMinted");

  const accountAddress = await contracts.sovereignFactory.predictSovereignAccount(user.address, "Local Primary", "moderate");
  await (await contracts.sovereignFactory.connect(user).createSovereignAccount(user.address, "Local Primary", {
    maxAllocation: ethers.parseUnits("1000", 18),
    maxSlippageBps: 100,
    riskProfile: "moderate",
    approvedAdapters: [await contracts.defiYieldAdapter.getAddress(), await contracts.predictionMarketAdapter.getAddress()],
    chainIds: [Number(deployment.chainId), 5000, 5003, 1, 42161, 7565164],
  })).wait();
  const sovereignAccount = await ethers.getContractAt("SovereignAccount", accountAddress);

  const depositAmount = ethers.parseUnits("500", 18);
  await (await contracts.paymentToken.connect(user).approve(accountAddress, depositAmount)).wait();
  await (await sovereignAccount.connect(user).deposit(await contracts.paymentToken.getAddress(), depositAmount)).wait();

  return {
    ...fixture,
    seeded: {
      agentId,
      agentTba,
      clusterId: clusterEvent.args.clusterId,
      clusterTba: clusterEvent.args.tba,
      sovereignAccount,
      sovereignAccountAddress: accountAddress,
      depositAmount,
    },
  };
}

export async function runLocalDefiE2E({ mode = process.env.TEST_MODE || "FREE_DATA_REAL_AI", requireRealAI = false } = {}) {
  const fixture = await seedLocalMantle();
  const { contracts, signers, seeded, deployment } = fixture;
  const zeroGStorage = createLocalZeroGProvider();
  const zeroGDA = createLocalZeroGDAProvider();
  const context = await loadDefiContext(mode);
  const strategy = await inferStrategy({
    taskType: "defi-yield-analysis",
    context,
    requireRealAI,
  });
  const policyDecision = validatePolicy({
    context,
    strategy,
    permissions: { executionApproved: true, paused: false },
    policy: { minTvlUsd: 100_000, minLiquidityUsd: 50_000, maxAllocationUsd: 250 },
  });
  if (!policyDecision.approved) {
    throw new Error(`Policy rejected local e2e: ${policyDecision.rejectionReasons.join("; ")}`);
  }
  const proof = await uploadDefiStrategyProof({ strategyId: "local-defi-yield", context, strategy, policyDecision }, { zeroGStorage, zeroGDA, publishDA: true });
  const proofReadback = await zeroGStorage.readZeroGObject(proof.proofURI);

  const strategyId = ethers.id("local-defi-yield");
  const claimHash = ethers.keccak256(ethers.toUtf8Bytes(proof.proofURI));
  await (await contracts.validationRegistry.submitClaim(claimHash, 0, seeded.agentId, strategyId, "defi-yield-policy-approved", proof.proofURI, signers.validator.address)).wait();
  await (await contracts.validationRegistry.connect(signers.validator).updateClaimStatus(claimHash, 1)).wait();
  await (await contracts.reputationRegistry.recordEvent(0, seeded.agentId, strategyId, "policy_safe_defi_strategy", 7, 0, 5000000, proof.proofURI)).wait();

  await (await seeded.sovereignAccount.connect(signers.user).approveAgent(signers.agent.address)).wait();
  const executionAmount = ethers.parseUnits("100", 18);
  const data = adapterCall(
    contracts.defiYieldAdapter,
    Number(deployment.chainId),
    await contracts.paymentToken.getAddress(),
    executionAmount,
    seeded.sovereignAccountAddress,
    50,
    ethers.id("defi_yield_execute"),
  );
  await (await seeded.sovereignAccount.connect(signers.agent).execute(await contracts.defiYieldAdapter.getAddress(), data)).wait();
  await (await seeded.sovereignAccount.connect(signers.user).revokeAgent(signers.agent.address)).wait();

  let revokedBlocked = false;
  try {
    await seeded.sovereignAccount.connect(signers.agent).execute(await contracts.defiYieldAdapter.getAddress(), data);
  } catch {
    revokedBlocked = true;
  }
  if (!revokedBlocked) throw new Error("revoked agent was still able to execute");

  await (await seeded.sovereignAccount.connect(signers.user).pause()).wait();
  await (await seeded.sovereignAccount.connect(signers.user).resume()).wait();
  const remaining = await seeded.sovereignAccount.balances(await contracts.paymentToken.getAddress());
  await (await seeded.sovereignAccount.connect(signers.user).withdraw(await contracts.paymentToken.getAddress(), remaining)).wait();

  return {
    mode,
    provider: strategy.provider || "unknown",
    deployment,
    agentId: seeded.agentId.toString(),
    sovereignAccount: seeded.sovereignAccountAddress,
    contextSummary: { chain: context.chain, asset: context.asset, yields: context.yields.length, sources: context.sources },
    strategy,
    policyDecision,
    proofURI: proof.proofURI,
    proofReadback: { type: proofReadback.type, rootHash: proofReadback.rootHash },
    validationClaim: claimHash,
    reputationEvents: (await contracts.reputationRegistry.totalEvents()).toString(),
    revokedBlocked,
    finalSovereignBalance: (await seeded.sovereignAccount.balances(await contracts.paymentToken.getAddress())).toString(),
  };
}

export async function runLocalPredictionE2E({ mode = process.env.TEST_MODE || "FREE_DATA_REAL_AI", requireRealAI = false } = {}) {
  const fixture = await seedLocalMantle();
  const { contracts, signers, seeded } = fixture;
  const zeroGStorage = createLocalZeroGProvider();
  const zeroGDA = createLocalZeroGDAProvider();
  const eventContext = await loadNewsContext(mode);
  const context = await loadPredictionContext(mode, eventContext.items);
  const strategy = await inferStrategy({
    taskType: "prediction-market-thesis",
    context,
    requireRealAI,
  });
  const policyDecision = validatePolicy({
    context,
    strategy,
    permissions: { executionApproved: true, paused: false },
    policy: { marketLiquidityThreshold: 100, maxAllocationUsd: 100, maxRiskScore: 90 },
  });
  if (!policyDecision.approved) {
    throw new Error(`Prediction policy rejected local e2e: ${policyDecision.rejectionReasons.join("; ")}`);
  }
  const proof = await uploadPredictionStrategyProof({ strategyId: "local-prediction-thesis", context, strategy, policyDecision }, { zeroGStorage, zeroGDA, publishDA: true });
  const strategyId = ethers.id("local-prediction-thesis");
  const claimHash = ethers.keccak256(ethers.toUtf8Bytes(proof.proofURI));
  await (await contracts.validationRegistry.submitClaim(claimHash, 0, seeded.agentId, strategyId, "prediction-thesis-policy-approved", proof.proofURI, signers.validator.address)).wait();
  await (await contracts.validationRegistry.connect(signers.validator).updateClaimStatus(claimHash, 1)).wait();
  await (await contracts.reputationRegistry.recordEvent(0, seeded.agentId, strategyId, "prediction_thesis_recorded", 4, 0, 0, proof.proofURI)).wait();
  return {
    mode,
    provider: strategy.provider || "unknown",
    markets: context.markets.map((market) => ({ id: market.id, question: market.question, liquidity: market.liquidityNum || market.liquidity })),
    newsItems: eventContext.items.length,
    strategy,
    policyDecision,
    proofURI: proof.proofURI,
    validationClaim: claimHash,
    reputationEvents: (await contracts.reputationRegistry.totalEvents()).toString(),
  };
}

export async function runRealAiTest({ mode = process.env.TEST_MODE || "FREE_DATA_REAL_AI" } = {}) {
  const zeroGStorage = createLocalZeroGProvider();
  const context = await loadDefiContext(mode === "MOCK_ONLY" ? "FREE_DATA_REAL_AI" : mode);
  const strategy = await inferStrategy({ taskType: "defi-yield-analysis", context, requireRealAI: true });
  const validation = validateStrategyOutput(strategy);
  if (!validation.ok) throw new Error(`Real AI output missing fields: ${validation.missing.join(", ")}`);
  const policyDecision = validatePolicy({ context, strategy, permissions: { executionApproved: true, paused: false }, policy: { minTvlUsd: 100_000, minLiquidityUsd: 50_000 } });
  const proof = await uploadDefiStrategyProof({ context, strategy, policyDecision }, { zeroGStorage, publishDA: false });
  const trace = await zeroGStorage.uploadInferenceTrace("real-ai-local-test", { provider: strategy.provider, strategy, proofURI: proof.proofURI });
  return { provider: strategy.provider, model: strategy.model, context: { chain: context.chain, asset: context.asset, sources: context.sources }, strategy, policyDecision, proofURI: proof.proofURI, traceURI: trace.uri };
}

async function inferStrategy({ taskType, context, requireRealAI = false }) {
  const provider = selectRealProvider();
  if (!provider && requireRealAI) {
    throw new Error("A real BYOK key is required. Set GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or CUSTOM_OPENAI_API_KEY + CUSTOM_OPENAI_ENDPOINT.");
  }
  const activeProvider = provider || new MockProvider();
  const model = defaultModelFor(activeProvider.name);
  const result = await activeProvider.runInference({
    model,
    taskType,
    temperature: 0.1,
    maxTokens: Number(process.env.LOCAL_AI_MAX_TOKENS || 4096),
    responseSchema: { required: ["recommendation", "confidence", "riskScore", "reasoning", "strategyPlan", "exitConditions", "sources"] },
    messages: [
      {
        role: "system",
        content: "Return strict JSON only. Use exactly these fields: recommendation, confidence, riskScore, reasoning, strategyPlan, exitConditions, sources. riskScore must be a number from 0 to 100 where 0 is lowest operational risk and 100 is highest operational risk. Do not include markdown.",
      },
      { role: "user", content: taskPrompt({ taskType, context }) },
    ],
  });
  const output = normalizeStrategyOutput(result.output);
  const validation = validateStrategyOutput(output);
  if (!validation.ok) throw new Error(`Strategy output missing fields: ${validation.missing.join(", ")}`);
  return { ...output, provider: activeProvider.name, model };
}

function normalizeStrategyOutput(output) {
  if (!output || typeof output !== "object") return output;
  const next = { ...output };
  const riskScore = Number(next.riskScore);
  if (Number.isFinite(riskScore)) {
    next.riskScore = riskScore > 0 && riskScore <= 1 ? Math.round(riskScore * 100) : riskScore;
  }
  return next;
}

function selectRealProvider() {
  if (process.env.CUSTOM_OPENAI_API_KEY && (process.env.CUSTOM_OPENAI_ENDPOINT || process.env.CUSTOM_OPENAI_API_URL)) {
    return new CustomOpenAICompatibleProvider({ apiKey: process.env.CUSTOM_OPENAI_API_KEY, endpointUrl: process.env.CUSTOM_OPENAI_ENDPOINT || process.env.CUSTOM_OPENAI_API_URL });
  }
  if (process.env.GEMINI_API_KEY) return new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY });
  if (process.env.OPENAI_API_KEY) return new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY });
  if (process.env.ANTHROPIC_API_KEY) return new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY });
  return null;
}

function defaultModelFor(providerName) {
  if (providerName === "gemini") return process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (providerName === "openai") return process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (providerName === "anthropic") return process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
  return process.env.CUSTOM_OPENAI_MODEL || "custom";
}

async function loadDefiContext(mode) {
  if (mode === "MOCK_ONLY") {
    return {
      type: "defi",
      chain: "Ethereum",
      asset: "USDC",
      protocol: "aave-v3",
      prices: { "coingecko:usd-coin": { price: 1 } },
      yields: [{ project: "aave-v3", symbol: "USDC", tvlUsd: 5_000_000, apy: 4.2, stablecoin: true }],
      tvl: { tvl: 5_000_000 },
      volume: { total24h: 100_000 },
      fees: { total24h: 10_000 },
      revenue: { total24h: 5_000 },
      stablecoinContext: { totalCirculatingUsd: 100_000_000_000 },
      liquidityState: { topPoolTvlUsd: 5_000_000 },
      riskNotes: [],
      timestamp: new Date().toISOString(),
      sources: ["local-fixture"],
    };
  }
  return buildDefiMarketContext({ chain: process.env.LOCAL_DEFI_CHAIN || "Ethereum", asset: process.env.LOCAL_DEFI_ASSET || "USDC", minTvlUsd: 100_000 });
}

async function loadNewsContext(mode) {
  if (mode === "MOCK_ONLY") {
    return { query: "bitcoin", items: [{ title: "Local event fixture", url: "local://news", publishedAt: new Date().toISOString(), source: "local" }], sources: ["local-fixture"], riskNotes: [], timestamp: new Date().toISOString() };
  }
  return buildNewsContext({ query: process.env.LOCAL_PREDICTION_QUERY || "bitcoin", rssFeeds: (process.env.LOCAL_RSS_FEEDS || "").split(",").filter(Boolean), limit: 5 });
}

async function loadPredictionContext(mode, newsItems) {
  if (mode === "MOCK_ONLY") {
    return {
      type: "prediction",
      query: "bitcoin",
      markets: [{ id: "local-market", question: "Will BTC close above local threshold?", active: true, closed: false, outcomes: ["Yes", "No"], outcomePrices: [0.6, 0.4], liquidityNum: 50_000, volume24hr: 10_000, source: "local-fixture" }],
      odds: [{ marketId: "local-market", odds: [{ outcome: "Yes", probability: 0.6 }, { outcome: "No", probability: 0.4 }] }],
      liquidity: [{ marketId: "local-market", liquidityNum: 50_000 }],
      volume: [{ marketId: "local-market", volume24hr: 10_000 }],
      eventNews: newsItems,
      marketStatus: "active",
      closeDate: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
      riskNotes: [],
      timestamp: new Date().toISOString(),
      sources: ["local-fixture"],
    };
  }
  return buildPredictionMarketContext({ query: process.env.LOCAL_PREDICTION_QUERY || "bitcoin", news: newsItems, limit: 5 });
}

function adapterCall(adapter, targetChainId, asset, amount, receiver, slippageBps, action) {
  const payload = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address", "uint256", "address", "uint256", "bytes32"],
    [targetChainId, asset, amount, receiver, slippageBps, action],
  );
  return adapter.interface.encodeFunctionData("execute", [payload]);
}

async function definePublicSkill(skillNFT, skill) {
  const tx = await skillNFT.defineSkill(skill.name, skill.skillType, skill.capabilityTag, skill.description, skill.md);
  const receipt = await tx.wait();
  const event = parseEvent(receipt, skillNFT, "SkillDefined");
  const skillId = event.args.skillId ?? event.args[0];
  await (await skillNFT.setPublicMintable(skillId, true)).wait();
  return skillId;
}

function parseEvent(receipt, contract, eventName) {
  return receipt.logs.map((log) => {
    try {
      return contract.interface.parseLog(log);
    } catch {
      return null;
    }
  }).find((event) => event?.name === eventName);
}
