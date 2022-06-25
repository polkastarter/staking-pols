import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { artifacts, ethers, waffle } from "hardhat";
import type { Artifact } from "hardhat/types";
import { Signers } from "../types";
import { expect } from "chai";
import { BigNumber, BigNumberish } from "ethers";
import * as path from "path";

import { PolsStake } from "../typechain/PolsStake";

const fakeTokenAddress = "1".repeat(40);
const days = 24 * 60 * 60;

// Parameter test cases
// function _userClaimableRewardsCalculation(
//     uint256 user_stakeAmount,
//     uint256 user_stakeTime,
//     uint256 user_unlockTime,
//     uint256 block_timestamp,
//     uint256 endTime,
//     bool    lockedRewards
// ) public view returns (uint256)

const DECIMALS = 18;
const DECMULBN = BigNumber.from(10).pow(DECIMALS);
const amountBig = DECMULBN.mul(250);
const amount = 3;

type Parameter = [BigNumberish, number, number, number, number, boolean];

/**
 * Testcases for unlockedRewardsFactor = 0.5
 */
// prettier-ignore
const testCases: [Parameter, BigNumberish][] = [
//  amount,      stake,  unlock,    time,  endTime, lckrew, expectedResult
  [[amountBig, 10*days, 20*days, 15*days, 100*days, false], amountBig.mul(2.5*days)], // test BigNumber handling
  [[        0, 10*days, 20*days, 12*days, 100*days, false], 0],              // nothing staked
  [[amount,    10*days, 20*days, 12*days, 100*days, false], amount* 1*days], // staked  2 days within lock period
  [[amount,    10*days, 20*days, 30*days, 100*days, false], amount*10*days], // staked 10 days past unlock time
  [[amount,    10*days, 20*days,200*days, 100*days, false], amount*45*days], // staked past end of rewards scheme

  [[amountBig, 10*days, 20*days, 15*days, 100*days, true], amountBig.mul(10*days)], // test BigNumber handling
  [[        0, 10*days, 20*days, 12*days, 100*days, true], 0],              // nothing staked
  [[amount,    10*days, 20*days, 12*days, 100*days, true], amount*10*days], // staked  2 days within lock period
  [[amount,    10*days, 20*days, 30*days, 100*days, true], amount*(10+5)*days], // staked 10 days past unlock time
  [[amount,    10*days, 20*days,200*days, 100*days, true], amount*(10+40)*days], // staked past end of rewards scheme
  [[amount,    10*days,200*days,200*days, 100*days, true], amount*90*days], // unlock time past end of rewards scheme
];

/**
 * Testcases for unlockedRewardsFactor = 0
 */
// prettier-ignore
const testCases_0: [Parameter, BigNumberish][] = [
  //  amount,      stake,  unlock,    time,  endTime, lckrew, expectedResult
    [[amountBig, 10*days, 20*days, 15*days, 100*days, false], 0], // test BigNumber handling
    [[        0, 10*days, 20*days, 12*days, 100*days, false], 0], // nothing staked
    [[amount,    10*days, 20*days, 12*days, 100*days, false], 0], // staked  2 days within lock period
    [[amount,    10*days, 20*days, 30*days, 100*days, false], 0], // staked 10 days past unlock time
    [[amount,    10*days, 20*days,200*days, 100*days, false], 0], // staked past end of rewards scheme
  
    [[amountBig, 10*days, 20*days, 15*days, 100*days, true], amountBig.mul(10*days)], // test BigNumber handling
    [[        0, 10*days, 20*days, 12*days, 100*days, true], 0],              // nothing staked
    [[amount,    10*days, 20*days, 12*days, 100*days, true], amount*10*days], // staked  2 days within lock period
    [[amount,    10*days, 20*days, 30*days, 100*days, true], amount*(10+0)*days], // staked 10 days past unlock time
    [[amount,    10*days, 20*days,200*days, 100*days, true], amount*(10+0)*days], // staked past end of rewards scheme
    [[amount,    10*days,200*days,200*days, 100*days, true], amount*90*days], // unlock time past end of rewards scheme
  ];

// prettier-ignore
const testCasesRevert: Parameter[] = [
// amount,   stake,  unlock,    time,  endTime,  flag
  // [amount, 20*days, 10*days, 30*days, 100*days, false], // staked time after unlock time (possible with partial withdraw)
  [amount, 10*days, 20*days,  5*days, 100*days, false], // time before stake time
];

const filenameHeader = path.basename(__filename).concat(" ").padEnd(80, "=").concat("\n");
describe("PolsStake : " + filenameHeader, function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers: SignerWithAddress[] = await ethers.getSigners();
    this.signers.admin = signers[0];

    const stakeArtifact: Artifact = await artifacts.readArtifact("PolsStake");
    this.stake = <PolsStake>await waffle.deployContract(this.signers.admin, stakeArtifact, [fakeTokenAddress]);
    await this.stake.deployed();
    // console.log("stake contract deployed to :", this.stake.address);
  });

  it("set unlockedRewardsFactor = 0.5 (= REWARDS_DIV / 2)", async function () {
    const REWARDS_DIV = await this.stake.REWARDS_DIV();
    expect(REWARDS_DIV).to.eq(1000000);

    // set unlockedRewardsFactor = 0.5
    const tx = await this.stake.connect(this.signers.admin).setUnlockedRewardsFactor(REWARDS_DIV / 2);
    await tx.wait();

    expect(await this.stake.unlockedRewardsFactor()).to.equal(REWARDS_DIV / 2);
  });

  it("calculates rewards correctly for unlockedRewardsFactor = 0.5", async function () {
    for (var testCase of testCases) {
      // console.log(...testCase);
      const reward = await this.stake._userClaimableRewardsCalculation(...testCase[0]);
      expect(reward).to.eq(testCase[1]);
    }
  });

  it("set unlockedRewardsFactor = 0", async function () {
    const tx = await this.stake.connect(this.signers.admin).setUnlockedRewardsFactor(0);
    await tx.wait();

    expect(await this.stake.unlockedRewardsFactor()).to.equal(0);
  });

  it("calculates rewards correctly for unlockedRewardsFactor = 0", async function () {
    for (var testCase of testCases_0) {
      // console.log(...testCase);
      const reward = await this.stake._userClaimableRewardsCalculation(...testCase[0]);
      expect(reward).to.eq(testCase[1]);
    }
  });

  it("reverts when things go wrong", async function () {
    for (var testCaseRevert of testCasesRevert) {
      // console.log(...testCaseRevert);
      await expect(this.stake._userClaimableRewardsCalculation(...testCaseRevert)).to.be.reverted;
    }
  });
});
