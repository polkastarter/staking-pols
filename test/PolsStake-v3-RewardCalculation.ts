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
//     bool    lockedRewardsCurrent // true => only calculate locked rewards up to t0
// ) public view returns (uint256)

const DECIMALS = 18;
const DECMULBN = BigNumber.from(10).pow(DECIMALS);
const amount = 10; // DECMULBN.mul(31000);
const REWARDS_DIV = 1000000;

type Parameter = [BigNumberish, number, number, number, number, boolean, boolean, number];

/**
 * Testcases for unlockedRewardsFactor = 0.5
 */
// prettier-ignore
const testCases: [Parameter, BigNumberish][] = [
//  amount, stk , unl, blk, end, lckrew, expectedResult
// lockedRewardsEnabled = false ----------------------------------------------------------------------------
  [[     0,  10 ,  20 , 12, 100, false, false, REWARDS_DIV], 0],              // nothing staked
  [[amount,  10 ,  20 , 12, 100, false, false, REWARDS_DIV], amount * (2/2)], // staked  2 days within lock period
  [[amount,  10 ,  20 , 16, 100, false, false, REWARDS_DIV], amount * (6/2)], // staked  6 days within lock period
  [[amount,  10 ,  20 , 30, 100, false, false, REWARDS_DIV], amount * (10) ], // staked 10 days past unlock time
  [[amount,  10 ,  20 ,200, 100, false, false, REWARDS_DIV], amount * (45) ], // staked past end of rewards scheme

  // good cases (from 24 permutations - redundant actually)
  [[amount, 10 , 24 , 60 , 100 , false, false, REWARDS_DIV],  amount * ((60-10)/2) ],  //   [ 'stake', 'unlock', 'current', 'end' ]
  [[amount, 10 , 24 , 100 , 60 , false, false, REWARDS_DIV],  amount * ((60-10)/2) ],  //   [ 'stake', 'unlock', 'end', 'current' ]
  [[amount, 10 , 60 , 24 , 100 , false, false, REWARDS_DIV],  amount * ((24-10)/2) ],  //   [ 'stake', 'current', 'unlock', 'end' ]
  [[amount, 10 , 60 , 100 , 24 , false, false, REWARDS_DIV],  amount * ((24-10)/2) ],  //   [ 'stake', 'current', 'end', 'unlock' ]
  [[amount, 10 , 100 , 24 , 60 , false, false, REWARDS_DIV],  amount * ((24-10)/2) ],  //   [ 'stake', 'end', 'unlock', 'current' ]
  [[amount, 10 , 100 , 60 , 24 , false, false, REWARDS_DIV],  amount * ((24-10)/2) ],  //   [ 'stake', 'end', 'current', 'unlock' ]

  // reward period ended before staking
  [[amount, 24 , 60 , 100 , 10 , false, false, REWARDS_DIV],  0 ],  //   [ 'end', 'stake', 'unlock', 'current']
  [[amount, 24 , 100 , 60 , 10 , false, false, REWARDS_DIV],  0 ],  //   [ 'end', 'stake', 'current', 'unlock']

  // lockedRewardsEnabled = true -----------------------------------------------------------------------------
  [[     0,  10 ,  20 , 12, 100, true, false, REWARDS_DIV], 0],                   // nothing staked

  [[amount,  10 ,  20 , 12, 100, true, false, REWARDS_DIV], amount * (10) ],      // staked  2 days within lock period
  [[amount,  10 ,  20 , 12, 100, true, true , REWARDS_DIV], amount * ( 2) ],      // staked  2 days within lock period

  [[amount,  10 ,  20 , 15, 100, true, false, REWARDS_DIV], amount * (10) ],      // staked  5 days within lock period
  [[amount,  10 ,  20 , 15, 100, true, true , REWARDS_DIV], amount * ( 5) ],      // staked  5 days within lock period

  [[amount,  10 ,  20 , 30, 100, true, false, REWARDS_DIV], amount * ((10+ 5)) ], // staked 10 days past unlock time
  [[amount,  10 ,  20 , 30, 100, true, true , REWARDS_DIV], amount * ((10+ 5)) ], // staked 10 days past unlock time

  [[amount,  10 ,  20 ,200, 100, true, false, REWARDS_DIV], amount * ((10+40)) ], // staked past end of rewards scheme
  [[amount,  10 ,  20 ,200, 100, true, true , REWARDS_DIV], amount * ((10+40)) ], // staked past end of rewards scheme

  [[amount,  10 , 200 ,300, 150, true, false, REWARDS_DIV], amount * ((150-10)) ],          // endTime < unlockTime < blockTime
  [[amount,  10 , 200 ,300, 250, true, false, REWARDS_DIV], amount * ((200-10 +  50/2)) ],  // unlockTime < endTime < blockTime
  [[amount,  10 , 200 ,300, 350, true, false, REWARDS_DIV], amount * ((200-10 + 100/2)) ],  // unlockTime < blockTime < endTime

  [[amount,  10 , 200 ,300, 150, true, true , REWARDS_DIV], amount * ((150-10)) ],          // endTime < unlockTime < blockTime
  [[amount,  10 , 200 ,300, 250, true, true , REWARDS_DIV], amount * ((200-10 +  50/2)) ],  // unlockTime < endTime < blockTime
  [[amount,  10 , 200 ,300, 350, true, true , REWARDS_DIV], amount * ((200-10 + 100/2)) ],  // unlockTime < blockTime < endTime


  // *** lockedRewardsCurrent = false ***
  // all 24 permutations ... (not considering lockedRewardsCurrent)
  // good cases (from 24 permutations - redundant actually)
  //amount, stk , unl, blk, end, lckrew, lRC ,  expectedResult
  [[amount, 10 , 24 , 60 , 100 , true, false, REWARDS_DIV],  amount * ( 24-10 + (60-24)/2) ],  //   [ 'stake', 'unlock', 'current', 'end' ]
  [[amount, 10 , 24 , 100 , 60 , true, false, REWARDS_DIV],  amount * ( 24-10 + (60-24)/2) ],  //   [ 'stake', 'unlock', 'end', 'current' ]
  [[amount, 10 , 60 , 24 , 100 , true, false, REWARDS_DIV],  amount * ( 60-10 ) ],  //   [ 'stake', 'current', 'unlock', 'end' ]
  [[amount, 10 , 60 , 100 , 24 , true, false, REWARDS_DIV],  amount * ( 24-10 ) ],  //   [ 'stake', 'end', 'unlock' , 'current']
  [[amount, 10 , 100 , 24 , 60 , true, false, REWARDS_DIV],  amount * ( 60-10 ) ],  //   [ 'stake', 'current', 'end', 'unlock' ]
  [[amount, 10 , 100 , 60 , 24 , true, false, REWARDS_DIV],  amount * ( 24-10 ) ],  //   [ 'stake', 'end', 'current', 'unlock' ]

  // reward period ended before staking
  [[amount, 24 , 60 , 100 , 10 , true, false, REWARDS_DIV],  0 ],  //   [ 'end', 'stake', 'unlock', 'current']
  [[amount, 24 , 100 , 60 , 10 , true, false, REWARDS_DIV],  0 ],  //   [ 'end', 'stake', 'current', 'unlock']

  // currentTime < stakeTime
  [[amount, 60 , 100 , 24 , 10 , true, false, REWARDS_DIV],  -1 ],
  [[amount, 24 , 60 , 10 , 100 , true, false, REWARDS_DIV],  -1 ],  
  [[amount, 24 , 100 , 10 , 60 , true, false, REWARDS_DIV],  -1 ],  
  [[amount, 60 , 24 , 10 , 100 , true, false, REWARDS_DIV],  -1 ],  
  [[amount, 60 , 100 , 10 , 24 , true, false, REWARDS_DIV],  -1 ],  
  [[amount, 100 , 24 , 10 , 60 , true, false, REWARDS_DIV],  -1 ],  
  [[amount, 100 , 60 , 10 , 24 , true, false, REWARDS_DIV],  -1 ],  
  
  // unlockTime < stakeTime
  [[amount, 24 , 10 , 60 , 100 , true, false, REWARDS_DIV],  -1 ],  
  [[amount, 24 , 10 , 100 , 60 , true, false, REWARDS_DIV],  -1 ],  
  [[amount, 60 , 10 , 24 , 100 , true, false, REWARDS_DIV],  -1 ],  
  [[amount, 60 , 10 , 100 , 24 , true, false, REWARDS_DIV],  -1 ],  
  [[amount, 100 , 10 , 24 , 60 , true, false, REWARDS_DIV],  -1 ],  
  [[amount, 100 , 10 , 60 , 24 , true, false, REWARDS_DIV],  -1 ],  
  [[amount, 60 , 10 , 24 , 100 , true, false, REWARDS_DIV],  -1 ],  
  [[amount, 60 , 10 , 100 , 24 , true, false, REWARDS_DIV],  -1 ],  
  [[amount, 60 , 24 , 100 , 10 , true, false, REWARDS_DIV],  -1 ],  
  [[amount, 100 , 24 , 60 , 10 , true, false, REWARDS_DIV],  -1 ],  
  [[amount, 100 , 60 , 24 , 10 , true, false, REWARDS_DIV],  -1 ],

  
  // *** lockedRewardsCurrent = true ***
  // good cases (from 24 permutations - redundant actually) - lockedRewardsCurrent = true
  //amount, stk , unl, blk, end, lckrew, lRC ,  expectedResult
  [[amount, 10 , 24 , 60 , 100 , true, true , REWARDS_DIV],  amount * ( 24-10 + (60-24)/2) ],  //   [ 'stake', 'unlock', 'current', 'end' ]
  [[amount, 10 , 24 , 100 , 60 , true, true , REWARDS_DIV],  amount * ( 24-10 + (60-24)/2) ],  //   [ 'stake', 'unlock', 'end', 'current' ]
  [[amount, 10 , 60 , 24 , 100 , true, true , REWARDS_DIV],  amount * ( 24-10 ) ],  //   [ 'stake', 'current', 'unlock', 'end' ]
  [[amount, 10 , 60 , 100 , 24 , true, true , REWARDS_DIV],  amount * ( 24-10 ) ],  //   [ 'stake', 'end', 'unlock' , 'current']
  [[amount, 10 , 100 , 24 , 60 , true, true , REWARDS_DIV],  amount * ( 24-10 ) ],  //   [ 'stake', 'current', 'end', 'unlock' ]
  [[amount, 10 , 100 , 60 , 24 , true, true , REWARDS_DIV],  amount * ( 24-10 ) ],  //   [ 'stake', 'end', 'current', 'unlock' ]

  // reward period ended before staking
  [[amount, 24 , 60 , 100 , 10 , true, true , REWARDS_DIV],  0 ],  //   [ 'end', 'stake', 'unlock', 'current']
  [[amount, 24 , 100 , 60 , 10 , true, true , REWARDS_DIV],  0 ],  //   [ 'end', 'stake', 'current', 'unlock']

  // currentTime < stakeTime
  [[amount, 60 , 100 , 24 , 10 , true, true , REWARDS_DIV],  -1 ],
  [[amount, 24 , 60 , 10 , 100 , true, true , REWARDS_DIV],  -1 ],  
  [[amount, 24 , 100 , 10 , 60 , true, true , REWARDS_DIV],  -1 ],  
  [[amount, 60 , 24 , 10 , 100 , true, true , REWARDS_DIV],  -1 ],  
  [[amount, 60 , 100 , 10 , 24 , true, true , REWARDS_DIV],  -1 ],  
  [[amount, 100 , 24 , 10 , 60 , true, true , REWARDS_DIV],  -1 ],  
  [[amount, 100 , 60 , 10 , 24 , true, true , REWARDS_DIV],  -1 ],  
  
  // unlockTime < stakeTime
  [[amount, 24 , 10 , 60 , 100 , true, true , REWARDS_DIV],  -1 ],  
  [[amount, 24 , 10 , 100 , 60 , true, true , REWARDS_DIV],  -1 ],  
  [[amount, 60 , 10 , 24 , 100 , true, true , REWARDS_DIV],  -1 ],  
  [[amount, 60 , 10 , 100 , 24 , true, true , REWARDS_DIV],  -1 ],  
  [[amount, 100 , 10 , 24 , 60 , true, true , REWARDS_DIV],  -1 ],  
  [[amount, 100 , 10 , 60 , 24 , true, true , REWARDS_DIV],  -1 ],  
  [[amount, 60 , 10 , 24 , 100 , true, true , REWARDS_DIV],  -1 ],  
  [[amount, 60 , 10 , 100 , 24 , true, true , REWARDS_DIV],  -1 ],  
  [[amount, 60 , 24 , 100 , 10 , true, true , REWARDS_DIV],  -1 ],  
  [[amount, 100 , 24 , 60 , 10 , true, true , REWARDS_DIV],  -1 ],  
  [[amount, 100 , 60 , 24 , 10 , true, true , REWARDS_DIV],  -1 ],
];

/**
 * Testcases for unlockedRewardsFactor = 0
 */
// prettier-ignore
const testCases_0: [Parameter, BigNumberish][] = [
  //   amount,   stake,  unlock, blkTime,  endTime, lckrew, expectedResult
  // lockedRewardsEnabled = false ----------------------------------------------------------------------------
  [[     0,  10 ,  20 , 12, 100, false, false, REWARDS_DIV], 0], // nothing staked
  [[amount,  10 ,  20 , 12, 100, false, false, REWARDS_DIV], 0], // staked  2 days within lock period
  [[amount,  10 ,  20 , 15, 100, false, false, REWARDS_DIV], 0], // staked  5 days within lock period
  [[amount,  10 ,  20 , 30, 100, false, false, REWARDS_DIV], 0], // staked 10 days past unlock time
  [[amount,  10 ,  20 ,200, 100, false, false, REWARDS_DIV], 0], // staked past end of rewards scheme

  // good cases (from 24 permutations - redundant actually)
  [[amount, 10 , 24 , 60 , 100 , false, false, REWARDS_DIV],  0 ],  //   [ 'stake', 'unlock', 'current', 'end' ]
  [[amount, 10 , 24 , 100 , 60 , false, false, REWARDS_DIV],  0 ],  //   [ 'stake', 'unlock', 'end', 'current' ]
  [[amount, 10 , 60 , 24 , 100 , false, false, REWARDS_DIV],  0 ],  //   [ 'stake', 'current', 'unlock', 'end' ]
  [[amount, 10 , 60 , 100 , 24 , false, false, REWARDS_DIV],  0 ],  //   [ 'stake', 'current', 'end', 'unlock' ]
  [[amount, 10 , 100 , 24 , 60 , false, false, REWARDS_DIV],  0 ],  //   [ 'stake', 'end', 'unlock', 'current' ]
  [[amount, 10 , 100 , 60 , 24 , false, false, REWARDS_DIV],  0 ],  //   [ 'stake', 'end', 'current', 'unlock' ]

  // reward period ended before staking
  [[amount, 24 , 60 , 100 , 10 , false, false, REWARDS_DIV],  0 ],  //   [ 'end', 'stake', 'unlock', 'current']
  [[amount, 24 , 100 , 60 , 10 , false, false, REWARDS_DIV],  0 ],  //   [ 'end', 'stake', 'current', 'unlock']
 
  // lockedRewardsEnabled = true -----------------------------------------------------------------------------
  [[     0,  10 ,  20 , 12, 100, true, false, REWARDS_DIV], 0],                 // nothing staked
  [[amount,  10 ,  20 , 12, 100, true, false, REWARDS_DIV], amount * (10) ],     // staked  2 days within lock period
  [[amount,  10 ,  20 , 15, 100, true, false, REWARDS_DIV], amount * (10)],      // staked  5 days within lock period
  [[amount,  10 ,  20 , 30, 100, true, false, REWARDS_DIV], amount * ((10+0)) ], // staked 10 days past unlock time
  [[amount,  10 ,  20 ,200, 100, true, false, REWARDS_DIV], amount * ((10+0)) ], // staked past end of rewards scheme
  [[amount,  10 , 200, 150, 100, true, false, REWARDS_DIV], amount * (90) ],     // unlock time past end of rewards scheme
  [[amount,  10 , 200, 300, 100, true, false, REWARDS_DIV], amount * (90) ],     // unlock time past end of rewards scheme
  [[amount,  10 , 200, 300, 150, true, false, REWARDS_DIV], amount * ((150-10)) ],     // endTime < unlockTime < blockTime
  [[amount,  10 , 200, 300, 250, true, false, REWARDS_DIV], amount * ((200-10 + 0)) ], // unlockTime < endTime < blockTime
  [[amount,  10 , 200, 300, 350, true, false, REWARDS_DIV], amount * ((200-10 + 0)) ], // unlockTime < blockTime < endTime

  // good cases (from 24 permutations - redundant actually)
  [[amount, 10 , 24 , 60 , 100 , true, false, REWARDS_DIV],  amount * ( 24-10 ) ],  //   [ 'stake', 'unlock', 'current', 'end' ]
  [[amount, 10 , 24 , 100 , 60 , true, false, REWARDS_DIV],  amount * ( 24-10 ) ],  //   [ 'stake', 'unlock', 'end', 'current' ]
  [[amount, 10 , 60 , 24 , 100 , true, false, REWARDS_DIV],  amount * ( 60-10 ) ],  //   [ 'stake', 'current', 'unlock', 'end' ]
  [[amount, 10 , 60 , 100 , 24 , true, false, REWARDS_DIV],  amount * ( 24-10 ) ],  //   [ 'stake', 'current', 'end', 'unlock' ]
  [[amount, 10 , 100 , 24 , 60 , true, false, REWARDS_DIV],  amount * ( 60-10 ) ],  //   [ 'stake', 'end', 'unlock', 'current' ]
  [[amount, 10 , 100 , 60 , 24 , true, false, REWARDS_DIV],  amount * ( 24-10 ) ],  //   [ 'stake', 'end', 'current', 'unlock' ]

  // reward period ended before staking
  [[amount, 24 , 60 , 100 , 10 , true, false, REWARDS_DIV],  0 ],  //   [ 'end', 'stake', 'unlock', 'current']
  [[amount, 24 , 100 , 60 , 10 , true, false, REWARDS_DIV],  0 ],  //   [ 'end', 'stake', 'current', 'unlock']

  // not testing revert cases again ...
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

  /**
   * test cases : unlockedRewardsFactor = 0.5
   */

  it("set unlockedRewardsFactor = 0.5 (= REWARDS_DIV / 2)", async function () {
    const rewards_div = await this.stake.REWARDS_DIV();
    expect(rewards_div).to.gte(2); // should not be 0 or 1
    expect(rewards_div % 2).to.eq(0); // should be an even number to avoid rounding errors

    // set unlockedRewardsFactor = 0.5
    const tx = await this.stake.connect(this.signers.admin).setUnlockedRewardsFactor(rewards_div / 2);
    await tx.wait();

    expect(await this.stake.unlockedRewardsFactor()).to.equal(rewards_div / 2);
  });

  it("calculates rewards correctly for unlockedRewardsFactor = 0.5", async function () {
    for (var testCase of testCases) {
      console.log(...testCase);
      if (testCase[1] >= 0) {
        const reward = await this.stake._userClaimableRewardsCalculation(...testCase[0]);
        expect(reward).to.eq(testCase[1]);
      } else {
        await expect(this.stake._userClaimableRewardsCalculation(...testCase[0])).to.be.reverted;
      }
    }
  });

  /**
   * test cases : unlockedRewardsFactor = 0
   */

  it("set unlockedRewardsFactor = 0", async function () {
    const tx = await this.stake.connect(this.signers.admin).setUnlockedRewardsFactor(0);
    await tx.wait();

    expect(await this.stake.unlockedRewardsFactor()).to.equal(0);
  });

  it("calculates rewards correctly for unlockedRewardsFactor = 0", async function () {
    for (var testCase of testCases_0) {
      console.log(...testCase);
      const reward = await this.stake._userClaimableRewardsCalculation(...testCase[0]);
      expect(reward).to.eq(testCase[1]);
    }
  });
});
