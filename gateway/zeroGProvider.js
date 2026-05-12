import { createHash, randomUUID } from "crypto";

export class MockZeroGProvider {
  constructor({ namespace = "clusterfi-demo" } = {}) {
    this.namespace = namespace;
    this.records = new Map();
  }

  async uploadAgentMemory(agentId, payload) {
    return this.mockZeroGUpload("agent-memory", { agentId, payload });
  }

  async uploadStrategyProof(strategyId, payload) {
    return this.mockZeroGUpload("strategy-proof", { strategyId, payload });
  }

  async uploadAlphaReport(reportId, payload) {
    return this.mockZeroGUpload("alpha-report", { reportId, payload });
  }

  async uploadPnLProof(strategyId, payload) {
    return this.mockZeroGUpload("pnl-proof", { strategyId, payload });
  }

  async uploadValidationProof(claimId, payload) {
    return this.mockZeroGUpload("validation-proof", { claimId, payload });
  }

  async uploadInferenceTrace(traceId, payload) {
    return this.mockZeroGUpload("inference-trace", { traceId, payload });
  }

  async uploadSocialFeedProof(postId, payload) {
    return this.mockZeroGUpload("social-feed-proof", { postId, payload });
  }

  async readZeroGObject(uri) {
    const record = this.records.get(uri);
    if (!record) {
      throw new Error(`0G mock object not found: ${uri}`);
    }
    return record;
  }

  getZeroGURI(rootHash, type = "object") {
    return `0g://${this.namespace}/${type}/${rootHash}`;
  }

  async mockZeroGUpload(type, payload) {
    const body = JSON.stringify({
      type,
      payload,
      createdAt: new Date().toISOString(),
      nonce: randomUUID(),
    });
    const rootHash = createHash("sha256").update(body).digest("hex");
    const uri = this.getZeroGURI(rootHash, type);
    const record = {
      provider: "mock-0g",
      type,
      rootHash,
      uri,
      bytes: Buffer.byteLength(body),
      body: JSON.parse(body),
    };
    this.records.set(uri, record);
    return record;
  }
}

export class RealZeroGProvider {
  constructor({
    rpcUrl = process.env.ZERO_G_RPC_URL || "https://evmrpc-testnet.0g.ai",
    indexerRpc = process.env.ZERO_G_INDEXER_RPC || "https://indexer-storage-testnet-turbo.0g.ai",
    privateKey = process.env.ZERO_G_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY,
  } = {}) {
    this.rpcUrl = rpcUrl;
    this.indexerRpc = indexerRpc;
    this.privateKey = privateKey;
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
    const rootHash = uri.split("/").pop();
    throw new Error(`Real 0G read for ${rootHash || uri} must be performed through the configured indexer download path`);
  }

  getZeroGURI(rootHash, type = "object") {
    return `0g://${type}/${rootHash}`;
  }

  async mockZeroGUpload(type, payload) {
    const mock = new MockZeroGProvider({ namespace: "clusterfi-real-fallback" });
    return mock.mockZeroGUpload(type, payload);
  }

  async uploadJson(type, payload) {
    if (!this.privateKey) {
      throw new Error("ZERO_G_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY is required for real 0G uploads");
    }

    let sdk;
    let ethers;
    try {
      sdk = await import("@0gfoundation/0g-storage-ts-sdk");
      ethers = await import("ethers");
    } catch (error) {
      throw new Error(`0G Storage SDK is not installed: ${error.message}`);
    }

    const { Indexer, MemData } = sdk;
    const provider = new ethers.JsonRpcProvider(this.rpcUrl);
    const signer = new ethers.Wallet(this.privateKey, provider);
    const indexer = new Indexer(this.indexerRpc);
    const bytes = new TextEncoder().encode(JSON.stringify({ type, payload, createdAt: new Date().toISOString() }));
    const memData = new MemData(bytes);
    const [tree, treeErr] = await memData.merkleTree();
    if (treeErr !== null) {
      throw new Error(`0G merkle tree error: ${treeErr}`);
    }
    const [tx, uploadErr] = await indexer.upload(memData, this.rpcUrl, signer);
    if (uploadErr !== null) {
      throw new Error(`0G upload error: ${uploadErr}`);
    }
    const rootHash = tx.rootHash || tree?.rootHash?.();
    return {
      provider: "0g-storage",
      type,
      rootHash,
      txHash: tx.txHash,
      uri: this.getZeroGURI(rootHash, type),
      bytes: bytes.length,
    };
  }
}

export function createZeroGProvider(mode = process.env.ZERO_G_PROVIDER || "mock") {
  return mode === "real" ? new RealZeroGProvider() : new MockZeroGProvider();
}
