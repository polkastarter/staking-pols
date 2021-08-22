import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
// import "solidity-coverage";

import "./tasks/accounts";
import "./tasks/clean";

import { resolve } from "path";

import { config as dotenvConfig } from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import { NetworkUserConfig } from "hardhat/types";

dotenvConfig({ path: resolve(__dirname, "./.env") });

const chainIds = {
  ganache: 1337,
  goerli: 5,
  hardhat: 31337,
  kovan: 42,
  mainnet: 1,
  rinkeby: 4,
  ropsten: 3,
  moonbaseDev: 1281,
};

// default mnemonic for Substrate Polkadot / Moonbeam development blockchains
const MNEMONIC_SUBSTRATE_DEV = "bottom drive obey lake curtain smoke basket hold race lonely fit walk";

// Ensure that we have all the environment variables we need.
let mnemonic: string;
if (!process.env.MNEMONIC) {
  throw new Error("Please set your MNEMONIC in a .env file");
} else {
  mnemonic = process.env.MNEMONIC;
}

// get info for RPC URL

let rpcUrl_1: string;
let rpcUrl_2: string;
if (process.env.ALCHEMY_API_KEY) {
  rpcUrl_1 = "https://eth-";
  rpcUrl_2 = ".alchemyapi.io/v2/" + process.env.ALCHEMY_API_KEY;
} else if (process.env.INFURA_API_KEY) {
  rpcUrl_1 = "https://";
  rpcUrl_2 = ".infura.io/v3/" + process.env.INFURA_API_KEY;
} else {
  throw new Error("Please set your ALCHEMY_API_KEY or INFURA_API_KEY in a .env file");
}

// https://hardhat.org/config/#networks-configuration

function createTestnetConfig(network: keyof typeof chainIds): NetworkUserConfig {
  const url: string = rpcUrl_1 + network + rpcUrl_2;
  return {
    accounts: {
      count: 10,
      initialIndex: 0,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    chainId: chainIds[network],
    url,
    gas: "auto",
    timeout: 900000,
  };
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",

  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
    src: "./contracts",
  },

  networks: {
    hardhat: {
      accounts: {
        mnemonic,
      },
      chainId: chainIds.hardhat,
    },

    moonDev: {
      accounts: {
        count: 10,
        initialIndex: 0,
        mnemonic: MNEMONIC_SUBSTRATE_DEV,
        path: "m/44'/60'/0'/0",
      },
      chainId: 1281,
      url: "http://127.0.0.1:9933",
      timeout: 20000,
    },

    moonAlpha: {
      accounts: {
        count: 10,
        initialIndex: 0,
        mnemonic,
        path: "m/44'/60'/0'/0",
      },
      chainId: 1287,
      url: "https://rpc.testnet.moonbeam.network",
      timeout: 900000,
    },

    goerli: createTestnetConfig("goerli"),
    kovan: createTestnetConfig("kovan"),
    rinkeby: createTestnetConfig("rinkeby"),
    ropsten: createTestnetConfig("ropsten"),
  },

  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },

  // https://hardhat.org/hardhat-network/#solidity-optimizer-support

  solidity: {
    compilers: [
      {
        version: "0.5.8",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.7",
        settings: {
          metadata: {
            // Not including the metadata hash
            // https://github.com/paulrberg/solidity-template/issues/31
            bytecodeHash: "none",
          },
          // You should disable the optimizer when debugging
          // https://hardhat.org/hardhat-network/#solidity-optimizer-support
          optimizer: {
            enabled: true,
            runs: 800,
          },
        },
      },
    ],
  },

  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
};

export default config;
