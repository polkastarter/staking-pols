import hre from "hardhat";
// We require the Hardhat Runtime Environment explicitly here. This is optional but useful for running the
// script in a standalone fashion through `node <script>`. When running the script with `hardhat run <script>`,
// you'll find the Hardhat Runtime Environment's members available in the global scope.
import { ethers, config } from "hardhat";

import { Contract } from "@ethersproject/contracts";
import { PolsStake__factory } from "../typechain";

const stdin = process.openStdin();

/**
 * set LOCK_TIME_PERIOD before deployment - period can be decreased later, but not increased
 */

const LOCK_TIME_PERIOD = 7 * 24 * 60 * 60;

type ChainIdNetwork = {
  [index: number]: string;
};

const POLS_ADDRESS: ChainIdNetwork = {
  1337: "", // ganache
  31337: "", // hardhat

  1: "0x83e6f1E41cdd28eAcEB20Cb649155049Fac3D5Aa", // Ethereum Mainnet
  56: "0x7e624fa0e1c4abfd309cc15719b7e2580887f570", // BSC Mainnet
  137: "", // Polygon/Matic Mainnet

  3: "", // ropsten
  4: "0x0a1DA3Fa1794A2a9cA6E444740d602658976D5A5", // rinkeby
  5: "", // goerli
  42: "0x03ef180c07d30e46cac83e5b9e282a9b295ca8a9", // kovan
  97: "0xcfd314B14cAB8c3e36852A249EdcAa1D3Dd05055", // BSC Testnet
  1287: "0xE1509Af72775dF5056894aeB57a84aA686f18294", // Moonbase Alpha TestNet
  80001: "0xd46dfE628CA0d6C2244ce659FE822BA7f15e6f7a", // Matic Testnet Mumbai
};

async function main(): Promise<void> {
  const currentNetwork = await ethers.provider.getNetwork();
  console.log({ currentNetwork });

  const accounts = await hre.ethers.getSigners();
  console.log("deployer account         :", accounts[0].address);

  const stakeTokenAddress = POLS_ADDRESS[currentNetwork.chainId];
  console.log("stakeTokenAddress (POLS) :", stakeTokenAddress);

  console.log("LOCK_TIME_PERIOD         :", LOCK_TIME_PERIOD);

  const constructorArgs = [stakeTokenAddress, LOCK_TIME_PERIOD];

  console.log("constructorArgs =", constructorArgs);

  console.log("Press any key to start deploying !");

  stdin.addListener("Press any key to start deploying ...", function (d) {
    // note:  d is an object, and when converted to a string it will
    // end with a linefeed.  so we (rather crudely) account for that
    // with toString() and then substring()
    // console.log("you entered: [" + d.toString().trim() + "]");
  });

  console.log("deploying ...");

  const PolsStake: PolsStake__factory = await ethers.getContractFactory("PolsStake");

  const polsStake: Contract = await PolsStake.deploy(stakeTokenAddress, LOCK_TIME_PERIOD);
  await polsStake.deployed();

  console.log("PolsStake deployed to    :", polsStake.address);
}

// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
