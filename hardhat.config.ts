import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";

import "solidity-coverage";
import "@nomiclabs/hardhat-etherscan";

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
  moonDev: 1281,
  moonAlpha: 1287, // Moonbase Alpha TestNet
};

// default mnemonic for Substrate Polkadot / Moonbeam development blockchains
const MNEMONIC_SUBSTRATE_DEV = "bottom drive obey lake curtain smoke basket hold race lonely fit walk";

// Ensure that we have all the environment variables we need.
let mnemonic: string;
if (!process.env.MNEMONIC) {
  console.log("Warning : No MNEMONIC in .env set");
  mnemonic = "test test test test test test test test test test test junk";
  console.log("Using hardhat defaut MNEMONIC =", mnemonic);
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
  console.log("Warning : No ALCHEMY_API_KEY or INFURA_API_KEY in .env set");
}

// https://hardhat.org/config/#networks-configuration

function getChainConfig(network: keyof typeof chainIds): NetworkUserConfig {
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

  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },

  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY, // BSCtest = 42WHX72TRYR4H8TFFJTQ6XBZFK43H92W5N
  },

  networks: {
    hardhat: {
      initialBaseFeePerGas: 0, // workaround : InvalidInputError: Transaction gasPrice (1) is too low for the next block
      accounts: {
        mnemonic,
      },
      chainId: chainIds.hardhat,
    },

    goerli: getChainConfig("goerli"),
    kovan: getChainConfig("kovan"),
    rinkeby: getChainConfig("rinkeby"),
    ropsten: getChainConfig("ropsten"),

    moonDev: {
      accounts: {
        count: 10,
        initialIndex: 0,
        mnemonic: MNEMONIC_SUBSTRATE_DEV,
        path: "m/44'/60'/0'/0",
      },
      chainId: 1281,
      url: "http://127.0.0.1:9933",
      timeout: 120000,
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

    bscTest: {
      accounts: {
        count: 10,
        initialIndex: 0,
        mnemonic,
        path: "m/44'/60'/0'/0",
      },
      chainId: 97,
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      timeout: 120000,
    },

    solanaDev: {
      accounts: {
        count: 10,
        initialIndex: 0,
        mnemonic,
        path: "m/44'/60'/0'/0",
      },
      chainId: 110,
      url: "https://proxy.devnet.neonlabs.org/solana",
      timeout: 120000,
    },

    solanaTest: {
      accounts: {
        count: 10,
        initialIndex: 0,
        mnemonic,
        path: "m/44'/60'/0'/0",
      },
      chainId: 111,
      url: "https://proxy.testnet.neonlabs.org/solana",
      timeout: 120000,
    },
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
