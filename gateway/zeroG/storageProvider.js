import { MockZeroGProvider, RealZeroGProvider } from "../zeroGProvider.js";

export class ZeroGStorageProvider extends MockZeroGProvider {
  async uploadValidationProof(claimId, payload) {
    return this.mockZeroGUpload("validation-proof", { claimId, payload });
  }

  async uploadInferenceTrace(traceId, payload) {
    return this.mockZeroGUpload("inference-trace", { traceId, payload });
  }

  async readZeroGObject(uri) {
    const record = this.records.get(uri);
    if (!record) {
      throw new Error(`0G mock object not found: ${uri}`);
    }
    return record;
  }
}

export class RealZeroGStorageProvider extends RealZeroGProvider {
  async uploadValidationProof(claimId, payload) {
    return this.uploadJson("validation-proof", { claimId, payload });
  }

  async uploadInferenceTrace(traceId, payload) {
    return this.uploadJson("inference-trace", { traceId, payload });
  }

  async readZeroGObject(uri) {
    const rootHash = uri.split("/").pop();
    if (!rootHash) {
      throw new Error(`Invalid 0G URI: ${uri}`);
    }
    throw new Error(`Real 0G read is not wired yet for ${rootHash}; use the 0G indexer download path for production reads`);
  }
}

export function createZeroGStorageProvider(mode = process.env.ZERO_G_PROVIDER || "mock") {
  return mode === "real" ? new RealZeroGStorageProvider() : new ZeroGStorageProvider();
}
