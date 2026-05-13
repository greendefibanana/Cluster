import "dotenv/config";
import "@nomicfoundation/hardhat-toolbox";

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const BSC_TESTNET_RPC_URL = process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const ZERO_G_TESTNET_RPC_URL = process.env.ZERO_G_TESTNET_RPC_URL || "https://evmrpc-testnet.0g.ai";
const MANTLE_RPC_URL = process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz";
const MANTLE_SEPOLIA_RPC_URL = process.env.MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz";

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000
      },
      viaIR: true
    }
  },
  networks: {
    hardhat: {
      chainId: 5000
    },
    localMantle: {
      url: "http://127.0.0.1:8545",
      chainId: 5000,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
    bscTestnet: {
      url: BSC_TESTNET_RPC_URL,
      chainId: 97,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
    zeroGTestnet: {
      url: ZERO_G_TESTNET_RPC_URL,
      chainId: 16602,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
    mantle: {
      url: MANTLE_RPC_URL,
      chainId: 5000,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
    mantleSepolia: {
      url: MANTLE_SEPOLIA_RPC_URL,
      chainId: 5003,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
    tenderly: {
      url: "https://virtual.binance.eu.rpc.tenderly.co/c5d9ad0b-104e-4e46-a5e5-cc8e68e0b0a2",
      chainId: 99956,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
    bscFork: {
      url: "http://127.0.0.1:8545",
      chainId: 56,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
