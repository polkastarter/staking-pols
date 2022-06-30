import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "hardhat-abi-exporter";

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
  bscTest: 97,
  bscMain: 56,
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

const MAINNET_PRIVATE_KEY = !process.env.MAINNET_PRIVATE_KEY ? "0x" + "0".repeat(64) : process.env.MAINNET_PRIVATE_KEY;

// get info for RPC URL

let rpcUrl_1: string;
let rpcUrl_2: string;
let apiKey: string = "";
if (process.env.ALCHEMY_API_KEY) {
  apiKey = process.env.ALCHEMY_API_KEY;
  rpcUrl_1 = "https://eth-";
  rpcUrl_2 = ".alchemyapi.io/v2/" + apiKey;
} else if (process.env.INFURA_API_KEY) {
  apiKey = !process.env.INFURA_API_KEY ? "" : process.env.INFURA_API_KEY;
  rpcUrl_1 = "https://";
  rpcUrl_2 = ".infura.io/v3/" + apiKey;
} else {
  console.log("Warning : No ALCHEMY_API_KEY or INFURA_API_KEY in .env set");
  rpcUrl_1 = "https://";
  rpcUrl_2 = ".infura.io/v3/";
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
    timeout: 300000,
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
    // apiKey: process.env.ETHERSCAN_API_KEY, // TODO - this needs a better solution
    apiKey: process.env.BSCSCAN_API_KEY, // TODO - this needs a better solution
  },

  abiExporter: {
    path: "./abi",
    clear: true,
    flat: false,
    only: ["PolsStake.sol"], // only: [':ERC20$'],
    spacing: 2,
    pretty: false,
  },

  networks: {
    hardhat: {
      initialBaseFeePerGas: 0, // workaround : InvalidInputError: Transaction gasPrice (1) is too low for the next block
      accounts: {
        mnemonic,
      },
      chainId: chainIds.hardhat,
    },

    ethMain: {
      url: "https://mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,
      // url: rpcUrl_1 + "mainnet" + rpcUrl_2 + apiKey,
      chainId: 1,
      timeout: 3600000, // 3600 sec = 1 h
      accounts: [MAINNET_PRIVATE_KEY],
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
      timeout: 60000,
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
      timeout: 300000,
    },

    bscTest: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      timeout: 300000,
      gasPrice: 200000000000, // is 20x what is needed
      accounts: {
        count: 10,
        initialIndex: 0,
        mnemonic,
        path: "m/44'/60'/0'/0",
      },
    },

    bscMain: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      timeout: 600000,
      gasPrice: 20000000000,
      accounts: [MAINNET_PRIVATE_KEY],
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
      timeout: 60000,
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
      timeout: 300000,
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
        version: "0.8.15",
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
