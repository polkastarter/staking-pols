import { Contract } from "@ethersproject/contracts";
// We require the Hardhat Runtime Environment explicitly here. This is optional but useful for running the
// script in a standalone fashion through `node <script>`. When running the script with `hardhat run <script>`,
// you'll find the Hardhat Runtime Environment's members available in the global scope.
import { ethers, config } from "hardhat";

import { PolsStake__factory } from "../typechain";

const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

// https://chainid.network/

type ChainIdNetwork = {
  [index: number]: string;
};

const POLS_ADDRESS: ChainIdNetwork = {
  1337: "", // ganache
  31337: "", // hardhat

  1: "0x83e6f1E41cdd28eAcEB20Cb649155049Fac3D5Aa", // Ethereum Mainnet
  56: "", // BSC Mainnet
  137: "0x8dc302e2141da59c934d900886dbf1518fd92cd4", // Polygon/Matic Mainnet

  4: "", // rinkeby
  3: "", // ropsten
  5: "", // goerli
  42: "0x03ef180c07d30e46cac83e5b9e282a9b295ca8a9", // kovan
  97: "0xcfd314B14cAB8c3e36852A249EdcAa1D3Dd05055", // BSC Testnet
  80001: "", // Matic Testnet Mumbai
};

// function getKey(value) {
//   return [...networks].find(([key, val]) => val == value)[0]
// }

async function main(): Promise<void> {
  const currentNetwork = await ethers.provider.getNetwork();

  // console.log(config.networks["hardhat"]);
  console.log({ currentNetwork });

  const stakeTokenAddress = POLS_ADDRESS[currentNetwork.chainId];
  console.log("stakeTokenAddress (POLS) =", stakeTokenAddress);

  const PolsStake: PolsStake__factory = await ethers.getContractFactory("PolsStake");

  const polsStake: Contract = await PolsStake.deploy(stakeTokenAddress, ADDRESS_ZERO);
  await polsStake.deployed();

  console.log("PolsStake deployed to: ", polsStake.address);
}

// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
