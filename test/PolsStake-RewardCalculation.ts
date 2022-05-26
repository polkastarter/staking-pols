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

// prettier-ignore
const testCases: [Parameter, BigNumberish][] = [
  //amount,   stake,  unlock,    time,  endTime,   flag, expectedResult
  [[amountBig, 10*days, 20*days, 15*days, 100*days, false], amountBig.mul(5*days)], // test BigNumber handling
  [[     0, 10*days, 20*days, 12*days, 100*days, false], 0],              // nothing staked
  [[amount, 10*days, 20*days, 12*days, 100*days, false], amount* 2*days], // staked  2 days within lock time
  [[amount, 10*days, 20*days, 30*days, 100*days, false], amount*20*days], // staked 20 days past lock time
  [[amount, 10*days, 20*days,200*days, 100*days, false], amount*90*days], // staked past end of rewards scheme
];

// prettier-ignore
const testCasesRevert: Parameter[] = [
  //amount,   stake,  unlock,    time,  endTime,   flag, expectedResult
  [amount, 20*days, 10*days, 30*days, 100*days, false], // staked time after unlock time
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
    console.log("stake contract deployed to :", this.stake.address);
  });

  it("calculates rewards correctly for all scenarios", async function () {
    for (var testCase of testCases) {
      console.log(...testCase);
      const reward = await this.stake._userClaimableRewardsCalculation(...testCase[0]);
      expect(reward).to.eq(testCase[1]);
    }
  });

  it("reverts when things go wrong", async function () {
    for (var testCaseRevert of testCasesRevert) {
      console.log(...testCaseRevert);
      await expect(this.stake._userClaimableRewardsCalculation(...testCaseRevert)).to.be.reverted;
    }
  });
});
