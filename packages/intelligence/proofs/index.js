import { createHash, randomUUID } from "crypto";
import { createZeroGStorageProvider } from "../../../gateway/zeroG/storageProvider.js";
import { createZeroGDAProvider } from "../../../gateway/zeroG/daProvider.js";

export async function uploadDefiStrategyProof(payload, options = {}) {
  return uploadProof("defi-strategy-proof", payload, options);
}

export async function uploadPredictionStrategyProof(payload, options = {}) {
  return uploadProof("prediction-strategy-proof", payload, options);
}

export async function uploadInferenceTrace(payload, options = {}) {
  const zeroG = options.zeroGStorage || createZeroGStorageProvider(options.mode || process.env.ZERO_G_PROVIDER || "mock");
  const traceId = payload.traceId || randomUUID();
  return zeroG.uploadInferenceTrace(traceId, withDigest("inference-trace", payload));
}

export async function uploadPolicyDecisionProof(payload, options = {}) {
  return uploadProof("policy-decision-proof", payload, options);
}

export async function optionallyPublishDALog(payload, options = {}) {
  if (options.publishDA === false) return null;
  const da = options.zeroGDA || createZeroGDAProvider(options.daMode || process.env.ZERO_G_DA_PROVIDER || "mock");
  return da.publishStrategyExecutionLog(withDigest("strategy-da-log", payload));
}

async function uploadProof(type, payload, options = {}) {
  const zeroG = options.zeroGStorage || createZeroGStorageProvider(options.mode || process.env.ZERO_G_PROVIDER || "mock");
  const proofId = payload.strategyId || payload.marketId || payload.policyId || randomUUID();
  const body = withDigest(type, payload);
  const record = type.includes("policy")
    ? await zeroG.uploadValidationProof(proofId, body)
    : await zeroG.uploadStrategyProof(proofId, body);
  const daReceipt = await optionallyPublishDALog({ type, proofId, proofURI: record.uri, digest: body.digest }, options);
  return { ...record, proofURI: record.uri, digest: body.digest, daReceipt };
}

function withDigest(type, payload) {
  const normalized = {
    type,
    payload,
    generatedAt: new Date().toISOString(),
  };
  const digest = createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
  return { ...normalized, digest };
}
