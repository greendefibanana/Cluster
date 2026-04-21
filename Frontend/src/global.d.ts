declare global {
  interface EthereumProvider {
    isMetaMask?: boolean;
    request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
    on?: (event: string, listener: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  }

  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {};
