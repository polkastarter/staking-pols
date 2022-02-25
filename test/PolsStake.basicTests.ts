import hre from "hardhat";

// https://www.chaijs.com/guide/styles/#expect
// https://www.chaijs.com/api/bdd/
// https://ethereum-waffle.readthedocs.io/en/latest/matchers.html
import { expect } from "chai";
import * as path from "path";

import { BigNumber, BigNumberish } from "ethers";
import { Logger } from "@ethersproject/logger";
import { toUtf8Bytes } from "ethers/lib/utils";

// https://docs.ethers.io/v5/api/utils/bignumber/
// const { BigNumber } = hre.ethers;

const DECIMALS = 18;
const DECMULBN = BigNumber.from(10).pow(DECIMALS);
const stakeAmount = DECMULBN.mul(1000); // 1000 token
const TIMEOUT_BLOCKCHAIN_ms = 10 * 60 * 1000; // 10 minutes

export function basicTests(_timePeriod: number, lockedRewards: boolean): void {
  const timePeriod = _timePeriod;
  console.log("timePeriod =", timePeriod, "seconds");

  const stakeRewardFactor = 1 * timePeriod * 1000; // 1 reward token for staking 1000 stake token for 1 period
  const LOCK_TIME_PERIOD = 7 * timePeriod; // TODO get from PolsStake.ts

  let userClaimableRewards_contract = BigNumber.from(0); // typeof BigNumber; // causes problems with solidity-coverage
  let userRewardTokenBalance_start = BigNumber.from(0);
  let stakeTokenDecimals: number;
  let rewardTokenDecimals: number;

  let stakeTime1: number;
  let stakeTime2: number;
  let expectedRewards = BigNumber.from(0);

  const filenameHeader = path.basename(__filename).concat(" ").padEnd(80, "=").concat("\n");

  describe("PolsStake : " + filenameHeader, function () {
    if (hre.network.name != "hardhat") this.timeout(TIMEOUT_BLOCKCHAIN_ms); // setup timeout to 5 min

    it("stake token should have 18 decimals", async function () {
      stakeTokenDecimals = await this.stakeToken.decimals();
      expect(stakeTokenDecimals).to.equal(DECIMALS);
    });

    it("reward token should have 18 decimals", async function () {
      rewardTokenDecimals = await this.rewardToken.decimals();
      expect(rewardTokenDecimals).to.equal(DECIMALS);
    });

    it("get lockTime from stake contracts", async function () {
      const lockTimePeriod = await this.stake.getLockTimePeriod();
      expect(lockTimePeriod).to.eql([604800, 1209600, 2592000, 5184000, 7776000, 15552000, 31536000]);
    });

    it("setLockedRewardsEnabled() can not be executed by non-admin", async function () {
      await expect(this.stake.connect(this.signers.user1).setLockedRewardsEnabled(lockedRewards)).to.but.reverted;
    });

    it("setLockedRewardsEnabled()", async function () {
      const tx = await this.stake.connect(this.signers.admin).setLockedRewardsEnabled(lockedRewards);
      await tx.wait();

      expect(await this.stake.lockedRewardsEnabled()).to.equal(lockedRewards);
    });

    it("send stake token from admin account to user1 account", async function () {
      const amount = "10000" + "0".repeat(18);

      const tx = await this.stakeToken.connect(this.signers.admin).transfer(this.signers.user1.address, amount);
      await tx.wait();

      const balance = await this.stakeToken.balanceOf(this.signers.user1.address);
      console.log("user1 : stakeToken balance = ", hre.ethers.utils.formatUnits(balance, stakeTokenDecimals));
      expect(balance).to.equal(amount);
    });

    it("user1 should have some stake tokens", async function () {
      const amount = "10000" + "0".repeat(18);
      // no transfer of stake token to user1 here
      const balance = await this.stakeToken.balanceOf(this.signers.user1.address);
      console.log("user1 : stakeToken balance = ", hre.ethers.utils.formatUnits(balance, stakeTokenDecimals));
      expect(balance).to.equal(amount);
    });

    it("deploy a reward token and mint some token to admin account", async function () {
      const balance = await this.rewardToken.balanceOf(this.signers.admin.address);
      console.log("reward token balance of admin =", hre.ethers.utils.formatUnits(balance, rewardTokenDecimals));
      expect(balance).to.gte(hre.ethers.utils.parseUnits("1000.0", rewardTokenDecimals));
    });

    it("user1 should have no rewards token", async function () {
      userRewardTokenBalance_start = await this.rewardToken.balanceOf(this.signers.user1.address);
      console.log("reward token balance of user1 = ", userRewardTokenBalance_start.toString());
      if (this.stakeToken.address != this.rewardToken.address) {
        expect(userRewardTokenBalance_start).to.equal(0);
      }
    });

    it("send 1000 reward tokens from admin account to staking contract", async function () {
      const amount = hre.ethers.utils.parseUnits("1000.0", rewardTokenDecimals);

      const tx = await this.rewardToken.connect(this.signers.admin).transfer(this.stake.address, amount);
      await tx.wait();

      const balance = await this.rewardToken.balanceOf(this.stake.address);
      console.log(
        "staking contract reward token balance = ",
        hre.ethers.utils.formatUnits(balance, rewardTokenDecimals),
      );
      expect(balance).to.equal(amount);
    });

    it("decrease lock time period - setLockTimePeriod()", async function () {
      const lockTimePeriods: number[] = await this.stake.getLockTimePeriod();

      // lockTimePeriods[0] = lockTimePeriods[0] - 1; // reduce lock time at index 0 by 1 second
      const newLockTimePeriods = [lockTimePeriods[0] - 1].concat(lockTimePeriods.slice(1));
      console.log("newLockTimePeriods =", newLockTimePeriods);

      const tx = await this.stake.connect(this.signers.admin).setLockTimePeriod(newLockTimePeriods);
      await tx.wait();

      // const newLockTimePeriods = await this.stake.getLockTimePeriod();
      console.log("lockTimePeriods (seconds) = ", newLockTimePeriods.toString());
      expect(await this.stake.getLockTimePeriod()).to.eql(newLockTimePeriods);
    });

    it("setRewardToken()", async function () {
      const tx = await this.stake.connect(this.signers.admin).setRewardToken(this.rewardToken.address);
      await tx.wait();

      const rewardToken_address = await this.stake.rewardToken();
      console.log("this.stake.rewardToken() = ", rewardToken_address);
      expect(rewardToken_address).to.equal(this.rewardToken.address);
    });

    it("setStakeRewardFactor()", async function () {
      const tx = await this.stake.connect(this.signers.admin).setStakeRewardFactor(stakeRewardFactor);
      await tx.wait();

      const result = await this.stake.stakeRewardFactor();
      console.log("stakeRewardFactor = ", result.toString());
      expect(result).to.equal(stakeRewardFactor);
    });
  });

  /**
   * @notice testing full staking cycle
   */

  describe("test stake & unstake, time lock and rewards", function () {
    if (hre.network.name != "hardhat") this.timeout(TIMEOUT_BLOCKCHAIN_ms); // setup timeout to 5 min

    let timeNow: number; // number type makes time calculations easier
    let startTime: number; // time when the test starts
    let timeRelative: number; // will store time relative to start time
    let blocktime: number;
    let stakeBalance = BigNumber.from(0);
    let difference = BigNumber.from(0);
    let user1BalanceStart = BigNumber.from(0);

    /**
     * @dev helper function to get block.timestamp from hardhat provider
     * @returns block.timestamp in unix epoch time (seconds)
     */
    const blockTimestamp = async (): Promise<number> => {
      const blockNumber = await hre.ethers.provider.getBlockNumber();
      return (await hre.ethers.provider._getBlock(blockNumber)).timestamp;
    };

    /**
     * @dev helper function for hardhat local blockchain to move time
     * @param timeAmount in seconds blockchain time should move forward
     */
    const moveTime = async (timeAmount: number): Promise<number> => {
      console.log("Jumping ", timeAmount, "seconds into the future ...");
      await hre.ethers.provider.send("evm_increaseTime", [timeAmount]);
      await hre.ethers.provider.send("evm_mine", []);
      const blockNumber = await hre.ethers.provider.getBlockNumber();
      const timeNow = (await hre.ethers.provider._getBlock(blockNumber)).timestamp;
      console.log("moveTime : timeNow =", timeNow);
      console.log("----------------------------------------------------------------------------");
      return timeNow;
    };

    const getTimestamp = async (): Promise<number> => {
      let currentTime: number;
      if (hre.network.name == "hardhat") {
        currentTime = await blockTimestamp();
      } else {
        currentTime = Math.floor(Date.now() / 1000);
      }
      return currentTime;
    };

    /**
     * @dev move time forward on hardhat
     * @dev just wait if on a "real" blockchain
     * @param timeAmount in seconds blockchain time should move forward
     */
    const waitTime = async (timeAmount: number): Promise<number> => {
      let newTime: number;
      if (hre.network.name == "hardhat") {
        newTime = await moveTime(timeAmount);
      } else {
        await new Promise(f => setTimeout(f, timeAmount * 1000));
        newTime = Math.floor(Date.now() / 1000);
      }
      return newTime;
    };

    /**
     * @notice testing full staking & reward round-trip
     */

    it("user approves stake token", async function () {
      startTime = await getTimestamp();
      console.log("startTime =", startTime);

      user1BalanceStart = await this.stakeToken.balanceOf(this.signers.user1.address);
      console.log("user1Balance =", hre.ethers.utils.formatUnits(user1BalanceStart, stakeTokenDecimals));

      const tx = await this.stakeToken.connect(this.signers.user1).approve(this.stake.address, user1BalanceStart);
      await tx.wait();

      const allowance = await this.stakeToken.allowance(this.signers.user1.address, this.stake.address);
      console.log("user1 approved allowance   =", hre.ethers.utils.formatUnits(allowance, stakeTokenDecimals));

      // at this time the balance of the stake token in the contract should be 0
      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      expect(allowance).to.equal(user1BalanceStart, "approval of stake token did not work");
    });

    it("staked amount should be 0 at this point", async function () {
      // at this time the balance of the stake token in the contract should be 0
      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      expect(stakeBalance).to.equal(0, "user should have a stake balance of 0");
    });

    it("user can stake token", async function () {
      console.log("staking now ... stakeAmount =", hre.ethers.utils.formatUnits(stakeAmount, stakeTokenDecimals));

      let tx;
      expect((tx = await this.stake.connect(this.signers.user1).stakelockTimeChoice(stakeAmount, 0))).to.emit(
        this.stake,
        "Stake",
      );
      // .withArgs(this.signers.user1, amount, stakeTime_???, unlockTime_???);
      await tx.wait();

      blocktime = await getTimestamp();
      console.log("blocktime =", blocktime.toString());
      const stakeTime = await this.stake.connect(this.signers.user1).stakeTime_msgSender();
      console.log("stakeTime =", stakeTime.toString());
      expect(Math.abs(blocktime - stakeTime)).lte(60, "stakeTime not within 60 seconds of current blocktime");

      stakeTime1 = blocktime;

      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      console.log("stakeBalance =", hre.ethers.utils.formatUnits(stakeBalance, stakeTokenDecimals));
      expect(stakeBalance).to.equal(stakeAmount, "stake contract does not reflect staked amount");

      expect(await this.stakeToken.balanceOf(this.signers.user1.address)).to.equal(
        user1BalanceStart.sub(stakeAmount),
        "user1 balance was not reduced by staked amount",
      );
    });

    it("verify getUnlockTime_msgSender()", async function () {
      const unlockTime = await this.stake.connect(this.signers.user1).getUnlockTime_msgSender();
      const stakeTime = await this.stake.connect(this.signers.user1).stakeTime_msgSender();
      console.log("unlockTime =", unlockTime);
      console.log("stakeTime  =", stakeTime);
      console.log("LOCK_TIME_PERIOD =", LOCK_TIME_PERIOD);
      expect(Math.abs(unlockTime - stakeTime - LOCK_TIME_PERIOD)).lte(
        60,
        "stakeTime not within 60 seconds of current blocktime",
      );
    });

    it("user can not unstake during the lockTimePeriod", async function () {
      // wait 5 timePeriods
      if (hre.network.name != "hardhat") this.timeout(5 * timePeriod * 1000 + TIMEOUT_BLOCKCHAIN_ms); // wait time + 15 min timeout for RPC call
      timeNow = await waitTime(5 * timePeriod);
      timeRelative = timeNow - startTime;

      /**
       * Test TIMELOCK
       * LockTimePeriod of 7 timePeriods has not expired yet - withdraw should fail
       * https://ethereum-waffle.readthedocs.io/en/latest/matchers.html?highlight=revert#revert
       */
      await expect(this.stake.connect(this.signers.user1).withdrawAll()).to.be.reverted;
    });

    it("no accumulated rewards while staking for the first time", async function () {
      expect(await this.stake.connect(this.signers.user1).userAccumulatedRewards_msgSender()).to.equal(
        0,
        "user should not have any accumulated rewards",
      );
    });

    it("user should have claimable rewards after staking for some time", async function () {
      const stakeTime = await this.stake.connect(this.signers.user1).stakeTime_msgSender();
      console.log("stakeTime =", stakeTime.toString());

      const blockTime = await blockTimestamp();
      console.log("blockTime =", blockTime);

      const stakeRewardEndTime = await this.stake.stakeRewardEndTime();
      console.log("stakeRewardEndTime =", stakeRewardEndTime.toString());

      const unlockTime = await this.stake.connect(this.signers.user1).getUnlockTime_msgSender();
      console.log("unlockTime         =", unlockTime.toString());

      console.log(">>>> lockedRewards =", lockedRewards);

      let userClaimableRewards_expected: BigNumber;
      if (lockedRewards) {
        userClaimableRewards_expected = stakeAmount.mul(unlockTime - stakeTime1);
      } else {
        userClaimableRewards_expected = stakeAmount.mul(blockTime - stakeTime1);
      }

      console.log("userClaimableRewards_expected =", userClaimableRewards_expected.toString());

      userClaimableRewards_contract = await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender();
      console.log("userClaimableRewards_contract =", userClaimableRewards_contract.toString());

      difference = userClaimableRewards_contract.sub(userClaimableRewards_expected).div(stakeBalance).abs();
      console.log("difference =", difference.toString());
      expect(difference).to.lte(5, "userClaimableRewards calculation is too far off");
    });

    it("user can stake same amount again, should have staked 2x then", async function () {
      // stake same amount again - lock period starts again
      console.log("staking now ... stakeAmount =", hre.ethers.utils.formatUnits(stakeAmount, stakeTokenDecimals));

      const tx = await this.stake.connect(this.signers.user1).stakelockTimeChoice(stakeAmount, 0);
      await tx.wait();

      stakeTime2 = await getTimestamp();

      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      console.log("stakeBalance =", hre.ethers.utils.formatUnits(stakeBalance, stakeTokenDecimals));
      expect(stakeBalance).to.equal(stakeAmount.mul(2), "stake contract does not reflect staked amount");

      expect(await this.stakeToken.balanceOf(this.signers.user1.address)).to.equal(
        user1BalanceStart.sub(stakeAmount).sub(stakeAmount),
        "user1 balance was not reduced by staked amount",
      );
    });

    it("after the 2nd staking, claimable rewards should have become accumulated reward", async function () {
      /**
       * Check userAccumulatedRewards
       * After the 2nd staking, claimable reward should have become accumulated reward
       * There may be a difference of one block time of rewards
       */

      const blockTime = await blockTimestamp();
      const userAccumulatedRewards_expected = stakeAmount.mul(blockTime - stakeTime1);

      const userAccumulatedRewards_contract = await this.stake
        .connect(this.signers.user1)
        .userAccumulatedRewards_msgSender();

      // difference = userAccumulatedRewards_contract.sub(userClaimableRewards_contract).div(stakeBalance).abs();
      difference = userAccumulatedRewards_contract.sub(userAccumulatedRewards_expected).div(stakeAmount).abs(); // relative error to stakeBalance

      console.log(
        "(userAccumulatedRewards_contract - userClaimableRewards_contract) / stakeBalance =",
        difference.toString(),
      );
      expect(difference).to.lte(60, "userAccumulatedRewards is too far off");
    });

    it("after staking again, userClaimableRewards should be close to zero", async function () {
      /**
       * Check userClaimableRewards
       * After the 2nd staking, claimable reward should have been reset to 0
       * At most 20 sec should have been passed since then, accumulating a small userClaimableRewards balance
       */
      userClaimableRewards_contract = await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender();

      expect(userClaimableRewards_contract).to.lte(
        stakeBalance.mul(20),
        "claimable reward should have been reset to 0",
      );
    });

    it("check userClaimableRewards", async function () {
      // wait 10 time periods
      if (hre.network.name != "hardhat") this.timeout(10 * timePeriod * 1000 + TIMEOUT_BLOCKCHAIN_ms);
      timeNow = await waitTime(10 * timePeriod);
      timeRelative = timeNow - startTime;

      /**
       * check claimable rewards. should be ~ 2 * stakeAmount * 10 timePeriods
       */
      const blockTime = await blockTimestamp();
      const userClaimableRewards_expected = stakeAmount.mul(2).mul(blockTime - stakeTime2);
      console.log("userClaimableRewards_expected =", userClaimableRewards_expected.toString());

      userClaimableRewards_contract = await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender();
      console.log("userClaimableRewards_contract =", userClaimableRewards_contract.toString());

      difference = userClaimableRewards_contract.sub(userClaimableRewards_expected).div(stakeBalance).abs();
      console.log("difference =", difference.toString());
      expect(difference).to.lte(20, "userClaimableRewards calculation is too far off");
    });

    it("user can unstake after the lockTimePeriod is over", async function () {
      const lastStakeBalance = stakeBalance;

      // withdraw one quarter of staked tokens
      const tx = await this.stake.connect(this.signers.user1).withdraw(lastStakeBalance.div(4));
      await tx.wait();

      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);

      const remainStakeBalance = lastStakeBalance.sub(lastStakeBalance.div(4));

      expect(stakeBalance).to.equal(remainStakeBalance, "remaining staked amount wrong");

      expect(await this.stakeToken.balanceOf(this.signers.user1.address)).to.equal(
        user1BalanceStart.sub(remainStakeBalance),
        "unstaked amount was not correctly added to user's balance",
      );

      console.log("**************************** UNSTAKE ****************************");

      // UNSTAKE - withdraw all remaining staked tokens
      const tx2 = await this.stake.connect(this.signers.user1).withdrawAll();
      await tx2.wait();

      blocktime = await getTimestamp();

      // 1st staking period = (stakeTime2 - stakeTime1) @ 1 * stakeAmount
      // 2nd staking period = (blocktime  - stakeTime2) @ 2 * stakeAmount
      expectedRewards = stakeAmount.mul(stakeTime2 - stakeTime1).add(stakeAmount.mul(2).mul(blocktime - stakeTime2));
      console.log(">>>>>> expectedRewards =", expectedRewards.toString());

      // stake amount should be zero
      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      expect(stakeBalance).to.equal(0, "stake amount should be 0");

      // user1 balance should be back to original amount
      expect(await this.stakeToken.balanceOf(this.signers.user1.address)).to.equal(
        user1BalanceStart,
        "user1 balance should be back to original amount",
      );

      // log timestamp
      timeNow = await getTimestamp();
      timeRelative = timeNow - startTime;
      console.log("timeNow      =", timeNow);
      console.log("timeRelative =", timeRelative);
      console.log("simulated time : seconds / timePeriods", timeRelative, timeRelative / timePeriod);
      console.log("----------------------------------------------------------------------------");

      const userClaimableRewards = await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender();
      console.log(">>>>>> userClaimableRewards   =", userClaimableRewards.toString());

      const userAccumulatedRewards = await this.stake.connect(this.signers.user1).userAccumulatedRewards_msgSender();
      console.log(">>>>>> userAccumulatedRewards =", userAccumulatedRewards.toString());

      const userTotalRewards = await this.stake.connect(this.signers.user1).userTotalRewards_msgSender();
      console.log(">>>>>> userTotalRewards       =", userTotalRewards.toString());

      const earnedRewardTokens = await this.stake.connect(this.signers.user1).getEarnedRewardTokens_msgSender();
      console.log(">>>>>> earnedRewardTokens     =", earnedRewardTokens.toString());

      // >>>>>>>>>>>>>>>>  WAIT 5 time periods - user should not receive any additional rewards <<<<<<<<<<<<<<<<<<<<<<
      const waitingTime = 5 * timePeriod;
      if (hre.network.name != "hardhat") this.timeout(waitingTime * 1000 + TIMEOUT_BLOCKCHAIN_ms); // wait time + 5 min timeout for RPC call
      console.log("waiting (seconds) ...", waitingTime);
      timeNow = await waitTime(waitingTime);

      // log timestamp
      timeNow = await getTimestamp();
      timeRelative = timeNow - startTime;
      console.log("timeNow      =", timeNow);
      console.log("timeRelative =", timeRelative);
      console.log("simulated time : seconds / timePeriods", timeRelative, timeRelative / timePeriod);
      console.log("----------------------------------------------------------------------------");

      const userClaimableRewards_later = await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender();
      console.log(">>>>>> userClaimableRewards_later   =", userClaimableRewards_later.toString());

      const userAccumulatedRewards_later = await this.stake
        .connect(this.signers.user1)
        .userAccumulatedRewards_msgSender();
      console.log(">>>>>> userAccumulatedRewards_later =", userAccumulatedRewards_later.toString());

      const userTotalRewards_later = await this.stake.connect(this.signers.user1).userTotalRewards_msgSender();
      console.log(">>>>>> userTotalRewards_later       =", userTotalRewards_later.toString());

      const earnedRewardTokens_later = await this.stake.connect(this.signers.user1).getEarnedRewardTokens_msgSender();
      console.log(">>>>>> earnedRewardTokens_later     =", earnedRewardTokens_later.toString());

      expect(userClaimableRewards_later).to.equal(userClaimableRewards, "userClaimableRewards changed after unstaking");
      expect(userAccumulatedRewards_later).to.equal(
        userAccumulatedRewards,
        "userAccumulatedRewards changed after unstaking",
      );
      expect(userTotalRewards_later).to.equal(userTotalRewards, "userTotalRewards changed after unstaking");
      expect(earnedRewardTokens_later).to.equal(earnedRewardTokens, "earnedRewardTokens changed after unstaking");

      /**
       * Check userClaimableRewards
       * After unstaking, claimable rewards should have been reset to 0 ...
       * and no rewards should have been earned in the timePeriods thereafter
       */
      expect(await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender()).to.equal(
        0,
        "claimable rewards should stay at 0 and not increase after full unstake",
      );

      /**
       * Check userAccumulatedRewards
       */
      // const rewardsStake1 = stakeAmount.mul(15).mul(timePeriod); // TODO - use measured, expired time
      // const rewardsStake2 = stakeAmount.mul(10).mul(timePeriod);
      // const userAccumulatedRewards_expected = rewardsStake1.add(rewardsStake2);

      const userAccumulatedRewards_expected = expectedRewards; // stakeAmount.mul(stakeTime2 - stakeTime1).add( stakeAmount.mul(2).mul(blocktime - stakeTime2) );

      const userAccumulatedRewards_contract = await this.stake
        .connect(this.signers.user1)
        .userAccumulatedRewards_msgSender();

      difference = userAccumulatedRewards_contract.sub(userAccumulatedRewards_expected).div(lastStakeBalance).abs();
      console.log("userAccumulatedRewards_expected =", userAccumulatedRewards_expected.toString());
      console.log("userAccumulatedRewards_contract =", userAccumulatedRewards_contract.toString());
      console.log("userAccumulatedRewards : difference contract vers expected =", difference.toString());
      expect(difference).to.lte(60, "userAccumulatedRewards is too far off");

      /**
       * Check userTotalRewards, should equal accumulatedRewards at this stage
       */
      const userTotalRewards_contract = await this.stake.connect(this.signers.user1).userTotalRewards_msgSender();
      difference = userAccumulatedRewards_contract.sub(userTotalRewards_contract).div(lastStakeBalance).abs();
      console.log("userTotalRewards       : difference contract vers expected =", difference.toString());
      expect(difference).to.lte(1, "userTotalRewards is too far off");
    });

    it("after withdrawAll, user should not be able to withdraw any additional tokens", async function () {
      await expect(this.stake.connect(this.signers.user1).withdraw(1)).to.be.reverted;
    });

    /**
     * test for reward token allocation manipulaion - after withdrawAll()
     */
    it("after withdrawAll, user should not be able to increase rewards by calling withdraw(0)", async function () {
      const totalRewards_before = await this.stake.connect(this.signers.user1).userTotalRewards_msgSender();
      console.log("totalRewards_before =", hre.ethers.utils.formatUnits(totalRewards_before, rewardTokenDecimals));

      await expect(this.stake.connect(this.signers.user1).withdraw(0)).to.be.reverted;
      // await tx2.wait();

      const totalRewards_after = await this.stake.connect(this.signers.user1).userTotalRewards_msgSender();
      console.log("totalRewards_after  =", hre.ethers.utils.formatUnits(totalRewards_after, rewardTokenDecimals));

      expect(totalRewards_after).to.equal(totalRewards_before);
    });

    /**
     * user should get 1 rewardToken for staking 1000 stakeToken for 5 timePeriods
     * In this test scenario we expect the user to receive 5 rewardToken (* 18 decimals)
     * (1000 token * 5 timePeriods) + (2000 token * 10 timePeriods) => 25 reward token
     */
    it("let user claim/mint rewardToken corresponding to their reward balance ", async function () {
      // const userRewardTokenReceived_expected = BigNumber.from(10).pow(rewardTokenDecimals).mul(25);
      const userRewardTokenReceived_expected = expectedRewards.div(stakeRewardFactor);

      const userRewardTokenBalance_before = await this.rewardToken.balanceOf(this.signers.user1.address);
      console.log(
        "user reward token balance  - before  = ",
        hre.ethers.utils.formatUnits(userRewardTokenBalance_before, rewardTokenDecimals),
      );

      const tx = await this.stake.connect(this.signers.user1).claim();
      await tx.wait();

      const userRewardTokenBalance_after = await this.rewardToken.balanceOf(this.signers.user1.address);
      console.log(
        "user reward token balance  - after    =",
        hre.ethers.utils.formatUnits(userRewardTokenBalance_after, rewardTokenDecimals),
      );

      console.log(
        "user reward token received - expected =",
        hre.ethers.utils.formatUnits(userRewardTokenReceived_expected, rewardTokenDecimals),
      );

      const userRewardTokenBalance_received = userRewardTokenBalance_after.sub(userRewardTokenBalance_before);
      console.log(
        "user reward token received - actual   =",
        hre.ethers.utils.formatUnits(userRewardTokenBalance_received, rewardTokenDecimals),
      );

      const difference = userRewardTokenBalance_received.sub(userRewardTokenReceived_expected).abs();
      console.log(
        "user reward token received - diff     = ",
        hre.ethers.utils.formatUnits(difference, rewardTokenDecimals),
      );

      expect(difference).lte(hre.ethers.utils.parseUnits("0.1", rewardTokenDecimals));
    });

    /**
     * admin can set disable reward token by calling setRewardToken(0)
     * admin will receive all reward tokens left in the staking contract
     */
    it("admin can disable reward token and will receive all reward tokens left", async function () {
      const stakeRewardTokenBalance_before = await this.stake.getRewardTokenBalance();
      const adminRewardTokenBalance_before = await this.rewardToken.balanceOf(this.signers.admin.address);

      const tx = await this.stake.connect(this.signers.admin).setRewardToken(hre.ethers.constants.AddressZero);
      await tx.wait();

      const stakeRewardTokenBalance_after = await this.stake.getRewardTokenBalance();
      const adminRewardTokenBalance_after = await this.rewardToken.balanceOf(this.signers.admin.address);

      expect(stakeRewardTokenBalance_after).to.equal(0);
      expect(adminRewardTokenBalance_after).to.equal(
        adminRewardTokenBalance_before.add(stakeRewardTokenBalance_before),
      );
    });
  });
}
