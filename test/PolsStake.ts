import hre from "hardhat";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { PolkastarterToken } from "../typechain/PolkastarterToken";
import { RewardToken } from "../typechain/RewardToken";
import { PolsStake } from "../typechain/PolsStake";

import { Signers } from "../types";
import { basicTests } from "./PolsStake.basicTests";

// https://ethereum-waffle.readthedocs.io
const { deployContract } = hre.waffle;

// https://docs.ethers.io/v5/api/utils/bignumber/
const { BigNumber } = hre.ethers;

const DECIMALS = 18;
const DECMULBN = BigNumber.from(10).pow(DECIMALS);

describe("PolsStake", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers: SignerWithAddress[] = await hre.ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.user1 = signers[1];
    this.signers.user2 = signers[2];
    // });

    // describe("deploy contracts", function () {
    // beforeEach(async function () {
    // deploy stake token and mint initial token to deployer (this.signers.admin)
    const stakeTokenArtifact: Artifact = await hre.artifacts.readArtifact("PolkastarterToken");
    this.stakeToken = <PolkastarterToken>(
      await deployContract(this.signers.admin, stakeTokenArtifact, [this.signers.admin.address])
    );

    // deploy reward token
    const rewardTokenArtifact: Artifact = await hre.artifacts.readArtifact("RewardToken");
    this.rewardToken = <RewardToken>await deployContract(this.signers.admin, rewardTokenArtifact, []);

    // deploy staking contract
    const stakeArtifact: Artifact = await hre.artifacts.readArtifact("PolsStake");
    this.stake = <PolsStake>(
      await deployContract(this.signers.admin, stakeArtifact, [this.stakeToken.address, this.rewardToken.address])
    );
  });

  basicTests();

  // scenario_1();

  // scenario_2():
  // });
});
