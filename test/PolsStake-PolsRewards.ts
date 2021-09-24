import hre from "hardhat";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { PolkastarterToken } from "../typechain/PolkastarterToken";
import { RewardToken } from "../typechain/RewardToken";
import { ERC20 } from "../typechain/ERC20";
import { PolsStake } from "../typechain/PolsStake";

import { Signers } from "../types";
import { basicTests } from "./PolsStake.basicTests";
import { expect } from "chai";

// https://ethereum-waffle.readthedocs.io
const { deployContract } = hre.waffle;

// https://docs.ethers.io/v5/api/utils/bignumber/
// const { BigNumber } = hre.ethers;

// const DECIMALS = 18;
// const DECMULBN = BigNumber.from(10).pow(DECIMALS);

const PERIOD_HARDHAT = 24 * 60 * 60; // 1 day (simulated time periods) on hardhat
const PERIOD_BLOCKCHAIN = 60; // 1 minute on "real" blockchains
const timePeriod = hre.network.name == "hardhat" ? PERIOD_HARDHAT : PERIOD_BLOCKCHAIN;
const lockPeriod = 7 * timePeriod;

describe("PolsStake", function () {
  before(async function () {
    if (hre.network.name != "hardhat") this.timeout(60 * 60 * 1000); // 1 h timeout for real blockchain

    this.signers = {} as Signers;
    const signers: SignerWithAddress[] = await hre.ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.user1 = signers[1];
    this.signers.user2 = signers[2];

    const stakeTokenArtifact: Artifact = await hre.artifacts.readArtifact("PolkastarterToken");
    this.stakeToken = <PolkastarterToken>(
      await deployContract(this.signers.admin, stakeTokenArtifact, [this.signers.admin.address])
    );
    await this.stakeToken.deployed();
    console.log("stakeToken     deployed to :", this.stakeToken.address);

    this.rewardToken = this.stakeToken;

    // deploy other token (use Reward Token contract)
    const rewardTokenArtifact: Artifact = await hre.artifacts.readArtifact("RewardToken");
    this.otherToken = <RewardToken>await deployContract(this.signers.admin, rewardTokenArtifact, []);
    await this.otherToken.deployed();
    console.log("otherToken    deployed to :", this.otherToken.address);

    // deploy staking contract
    const stakeArtifact: Artifact = await hre.artifacts.readArtifact("PolsStake");
    this.stake = <PolsStake>(
      await deployContract(this.signers.admin, stakeArtifact, [this.stakeToken.address, lockPeriod])
    );
    await this.stake.deployed();
    console.log("stake contract deployed to :", this.stake.address);
  });

  basicTests(timePeriod);

  describe("test removeOtherERC20Tokens()", function () {
    it("otherToken is accidently being send directly to staking contract => recover", async function () {
      const amount = "10" + "0".repeat(18);
      const balance = await this.otherToken.balanceOf(this.signers.admin.address);

      const tx1 = await this.otherToken.connect(this.signers.admin).transfer(this.stake.address, amount);
      await tx1.wait();

      expect(await this.otherToken.balanceOf(this.signers.admin.address)).to.equal(balance.sub(amount));

      const tx2 = await this.stake.connect(this.signers.admin).removeOtherERC20Tokens(this.otherToken.address);
      await tx2.wait();

      expect(await this.otherToken.balanceOf(this.signers.admin.address)).to.equal(balance);
    });
  });
});
