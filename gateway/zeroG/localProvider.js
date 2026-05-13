import fs from "fs";
import path from "path";
import { createHash } from "crypto";

const DEFAULT_ROOT = path.join(process.cwd(), "deployments", "local-0g");

export class LocalZeroGProvider {
  constructor({ rootDir = process.env.LOCAL_0G_DIR || DEFAULT_ROOT, namespace = "clusterfi-local-0g" } = {}) {
    this.rootDir = rootDir;
    this.namespace = namespace;
    this.objectsDir = path.join(rootDir, "objects");
    this.uploadLogPath = path.join(rootDir, "uploads.jsonl");
    fs.mkdirSync(this.objectsDir, { recursive: true });
  }

  async uploadAgentMemory(agentId, payload) {
    return this.uploadJson("agent-memory", { agentId, payload });
  }

  async uploadStrategyProof(strategyId, payload) {
    return this.uploadJson("strategy-proof", { strategyId, payload });
  }

  async uploadAlphaReport(reportId, payload) {
    return this.uploadJson("alpha-report", { reportId, payload });
  }

  async uploadPnLProof(strategyId, payload) {
    return this.uploadJson("pnl-proof", { strategyId, payload });
  }

  async uploadValidationProof(claimId, payload) {
    return this.uploadJson("validation-proof", { claimId, payload });
  }

  async uploadInferenceTrace(traceId, payload) {
    return this.uploadJson("inference-trace", { traceId, payload });
  }

  async uploadSocialFeedProof(postId, payload) {
    return this.uploadJson("social-feed-proof", { postId, payload });
  }

  async readZeroGObject(uri) {
    const rootHash = rootHashFromUri(uri);
    const objectPath = path.join(this.objectsDir, `${rootHash}.json`);
    if (!fs.existsSync(objectPath)) {
      throw new Error(`Local 0G object not found: ${uri}`);
    }
    return JSON.parse(fs.readFileSync(objectPath, "utf8"));
  }

  getZeroGURI(rootHash, type = "object") {
    return `0g-local://${this.namespace}/${type}/${rootHash}`;
  }

  async uploadJson(type, payload) {
    const body = {
      provider: "local-0g",
      type,
      payload,
    };
    const canonical = JSON.stringify(body);
    const rootHash = createHash("sha256").update(canonical).digest("hex");
    const uri = this.getZeroGURI(rootHash, type);
    const record = {
      ...body,
      rootHash,
      uri,
      bytes: Buffer.byteLength(canonical),
      storedAt: new Date().toISOString(),
    };
    fs.mkdirSync(this.objectsDir, { recursive: true });
    fs.writeFileSync(path.join(this.objectsDir, `${rootHash}.json`), JSON.stringify(record, null, 2));
    fs.appendFileSync(this.uploadLogPath, `${JSON.stringify({ uri, rootHash, type, bytes: record.bytes, storedAt: record.storedAt })}\n`);
    return record;
  }
}

export class LocalZeroGDAProvider {
  constructor({ rootDir = process.env.LOCAL_0G_DIR || DEFAULT_ROOT, namespace = "clusterfi-local-da" } = {}) {
    this.rootDir = rootDir;
    this.namespace = namespace;
    this.logPath = path.join(rootDir, "da-logs.jsonl");
    fs.mkdirSync(rootDir, { recursive: true });
  }

  async publishAgentActivityLog(payload) {
    return this.publish("agent-activity-log", payload);
  }

  async publishStrategyExecutionLog(payload) {
    return this.publish("strategy-execution-log", payload);
  }

  async publishFeedProofBatch(payload) {
    return this.publish("feed-proof-batch", payload);
  }

  async publishReputationBatch(payload) {
    return this.publish("reputation-batch", payload);
  }

  async publish(type, payload) {
    const body = { provider: "local-0g-da", type, payload };
    const blobHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    const receipt = {
      ...body,
      blobHash,
      uri: `0g-da-local://${this.namespace}/${type}/${blobHash}`,
      bytes: Buffer.byteLength(JSON.stringify(body)),
      createdAt: new Date().toISOString(),
    };
    fs.appendFileSync(this.logPath, `${JSON.stringify(receipt)}\n`);
    return receipt;
  }
}

export class LocalZeroGComputeProvider {
  constructor({ provider }) {
    this.name = "local-0g-compute";
    this.provider = provider;
  }

  async healthCheck() {
    if (!this.provider) return { provider: this.name, ok: false, reason: "no BYOK provider configured" };
    return this.provider.healthCheck();
  }

  estimateCost(request) {
    return this.provider.estimateCost(request);
  }

  normalizeUsage(data, fallback) {
    return this.provider.normalizeUsage(data, fallback);
  }

  async runInference(request) {
    if (!this.provider) throw new Error("Local 0G compute requires a real BYOK provider");
    return this.provider.runInference(request);
  }
}

export function createLocalZeroGProvider(options = {}) {
  return new LocalZeroGProvider(options);
}

export function createLocalZeroGDAProvider(options = {}) {
  return new LocalZeroGDAProvider(options);
}

function rootHashFromUri(uri) {
  const rootHash = String(uri || "").split("/").pop();
  if (!rootHash || !/^[a-f0-9]{64}$/i.test(rootHash)) {
    throw new Error(`Invalid local 0G URI: ${uri}`);
  }
  return rootHash;
}
