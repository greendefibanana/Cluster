export class MockBridgeAdapter {
  constructor({ supportedChains = [5000, 5003, 1, 56, 8453, 42161, 7565164] } = {}) {
    this.name = "mock-bridge";
    this.supportedChains = new Set(supportedChains);
  }

  async quote(intent) {
    return {
      bridge: this.name,
      supported: this.supportedChains.has(Number(intent.targetChain)),
      estimatedFee: Number(intent.amount) * 0.001,
      etaSeconds: 15,
      simulation: true,
    };
  }

  async execute(intent) {
    const quote = await this.quote(intent);
    if (!quote.supported) {
      throw new Error(`Mock bridge does not support target chain ${intent.targetChain}`);
    }
    return {
      bridge: this.name,
      intentId: intent.id,
      receiptHash: hashLike(`${intent.id}:${intent.targetChain}:${intent.amount}`),
      status: "executed",
      quote,
    };
  }
}

export class AcrossBridgeAdapter {
  constructor({ apiBaseUrl = process.env.ACROSS_API_BASE_URL || "https://app.across.to/api", simulationMode = process.env.ACROSS_SIMULATION_MODE !== "false" } = {}) {
    this.name = "across";
    this.apiBaseUrl = apiBaseUrl;
    this.simulationMode = simulationMode;
  }

  async quote(intent) {
    if (this.simulationMode) {
      return {
        bridge: this.name,
        supported: true,
        estimatedFee: Number(intent.amount) * 0.0015,
        etaSeconds: 20,
        simulation: true,
        note: "Across quote simulated locally. Use Across API for production quotes.",
      };
    }
    const params = new URLSearchParams({
      originChainId: String(intent.sourceChain),
      destinationChainId: String(intent.targetChain),
      inputToken: intent.asset,
      outputToken: intent.asset,
      amount: String(intent.amount),
      depositor: intent.userSovereignAccount,
      tradeType: "minOutput",
    });
    const response = await fetch(`${this.apiBaseUrl}/swap/approval?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Across quote failed ${response.status}: ${(await response.text()).slice(0, 240)}`);
    }
    return response.json();
  }

  async execute(intent) {
    const quote = await this.quote(intent);
    if (!this.simulationMode) {
      throw new Error("Real Across execution requires wallet signing and should be called from the transaction layer");
    }
    return {
      bridge: this.name,
      intentId: intent.id,
      receiptHash: hashLike(`across:${intent.id}:${Date.now()}`),
      status: "simulated",
      quote,
    };
  }
}

export class AcrossQuoteService {
  constructor({ bridge = new AcrossBridgeAdapter() } = {}) {
    this.bridge = bridge;
  }

  async getQuote(intent) {
    return this.bridge.quote(intent);
  }
}

export class AcrossIntentExecutor {
  constructor({ bridge = new AcrossBridgeAdapter() } = {}) {
    this.bridge = bridge;
  }

  async execute(intent) {
    return this.bridge.execute(intent);
  }
}

function hashLike(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return `0x${Math.abs(hash).toString(16).padStart(64, "0")}`;
}
