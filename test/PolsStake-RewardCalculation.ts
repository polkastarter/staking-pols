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
const amountBig = DECMULBN.mul(300);
const amount = 400;

type Parameter = [BigNumberish, number, number, number, number, boolean];

const testCases: [Parameter, BigNumberish][] = [
  //   amount,   stake,  unlock,    time,  endTime,  flag, expectedResult
  [[amountBig, 10 * days, 20 * days, 15 * days, 100 * days, false], amountBig.mul(5 * days)],
  [[amount, 10 * days, 20 * days, 12 * days, 100 * days, false], amount * 2 * days],
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
});
