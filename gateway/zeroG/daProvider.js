import { createHash, randomUUID } from "crypto";
import { LocalZeroGDAProvider } from "./localProvider.js";

export class MockZeroGDAProvider {
  constructor({ namespace = "clusterfi-da-demo" } = {}) {
    this.namespace = namespace;
    this.records = new Map();
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
    const body = JSON.stringify({ type, payload, nonce: randomUUID(), createdAt: new Date().toISOString() });
    const digest = createHash("sha256").update(body).digest("hex");
    const receipt = {
      provider: "mock-0g-da",
      type,
      blobHash: digest,
      uri: `0g-da://${this.namespace}/${type}/${digest}`,
      bytes: Buffer.byteLength(body),
      createdAt: new Date().toISOString(),
    };
    this.records.set(receipt.uri, { ...receipt, body: JSON.parse(body) });
    return receipt;
  }
}

export class RealZeroGDAProvider {
  constructor({ endpoint = process.env.ZERO_G_DA_CLIENT_URL, enabled = process.env.ZERO_G_DA_PROVIDER === "real" } = {}) {
    this.endpoint = endpoint;
    this.enabled = enabled;
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
    if (!this.enabled || !this.endpoint) {
      throw new Error("Real 0G DA requires ZERO_G_DA_PROVIDER=real and ZERO_G_DA_CLIENT_URL");
    }
    const response = await fetch(`${this.endpoint.replace(/\/$/, "")}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });
    if (!response.ok) {
      throw new Error(`0G DA publish failed ${response.status}: ${(await response.text()).slice(0, 240)}`);
    }
    return response.json();
  }
}

export function createZeroGDAProvider(mode = process.env.ZERO_G_DA_PROVIDER || "mock") {
  if (isProductionRuntime() && mode !== "real" && process.env.ALLOW_PRODUCTION_MOCKS !== "true") {
    throw new Error("Production 0G DA requires ZERO_G_DA_PROVIDER=real");
  }
  if (mode === "local") return new LocalZeroGDAProvider();
  return mode === "real" ? new RealZeroGDAProvider() : new MockZeroGDAProvider();
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.GATEWAY_ENV === "production";
}
