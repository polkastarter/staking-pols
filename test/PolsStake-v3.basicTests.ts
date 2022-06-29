import hre from "hardhat";

// https://www.chaijs.com/guide/styles/#expect
// https://www.chaijs.com/api/bdd/
// https://ethereum-waffle.readthedocs.io/en/latest/matchers.html
import { expect } from "chai";
import * as path from "path";

import { BigNumber, BigNumberish } from "ethers";
import { Logger } from "@ethersproject/logger";
import { toUtf8Bytes } from "ethers/lib/utils";

import { timePeriod, getTimestamp, moveTime, waitTime, setTime, consoleLog_timestamp } from "./libs/BlockTimeHelper";

const DAYS = 24 * 60 * 60;
const DECIMALS = 18;
const DECMULBN = BigNumber.from(10).pow(DECIMALS);
const STAKE_AMOUNT = DECMULBN.mul(1000); // 1000 token
const TIMEOUT_BLOCKCHAIN_ms = 10 * 60 * 1000; // 10 minutes

const REWARDS_DIV = 1_000_000;

export function basicTestsV3(
  _timePeriod: number,
  _lockedRewardsEnabled: boolean,
  _unlockedRewardsFactor: number,
): void {
  const timePeriod = _timePeriod;
  console.log("timePeriod =", timePeriod, "seconds");

  const stakeRewardFactor = 1 * timePeriod * 1000; // 1 reward token for staking 1000 stake token for 1 period

  let lockTimePeriodOptions: number[];

  let userClaimableRewards_contract = BigNumber.from(0); // typeof BigNumber; // causes problems with solidity-coverage
  // let userRewardTokenBalance_start = BigNumber.from(0);
  let stakeTokenDecimals: number;
  let rewardTokenDecimals: number;

  let stakeTime1: number;
  let stakeTime2: number;
  let expectedRewards = BigNumber.from(0);
  let lastRewardsContract: BigNumber;
  let unlockedRewardsFactor: number;

  const filenameHeader = path.basename(__filename).concat(" ").padEnd(80, "=").concat("\n");

  describe("PolsStake : " + filenameHeader, function () {
    if (hre.network.name != "hardhat") this.timeout(TIMEOUT_BLOCKCHAIN_ms); // setup timeout to 5 min

    it("stake token should have 18 decimals", async function () {
      stakeTokenDecimals = await this.stakeToken.decimals();
      expect(stakeTokenDecimals).to.equal(DECIMALS);
    });

    // it("reward token should have 18 decimals", async function () {
    //   rewardTokenDecimals = await this.rewardToken.decimals();
    //   expect(rewardTokenDecimals).to.equal(DECIMALS);
    // });

    it("get lockTime from stake contracts", async function () {
      lockTimePeriodOptions = await this.stake.getLockTimePeriodOptions();
      expect(lockTimePeriodOptions).to.eql([
        0,
        7 * DAYS,
        14 * DAYS,
        30 * DAYS,
        60 * DAYS,
        90 * DAYS,
        180 * DAYS,
        365 * DAYS,
      ]);
    });

    it("setLockedRewardsEnabled() can not be executed by non-admin", async function () {
      await expect(
        this.stake.connect(this.signers.user1).setLockedRewardsEnabled(_lockedRewardsEnabled),
      ).to.but.reverted;
    });

    it("setLockedRewardsEnabled()", async function () {
      const tx = await this.stake.connect(this.signers.admin).setLockedRewardsEnabled(_lockedRewardsEnabled);
      await tx.wait();

      expect(await this.stake.lockedRewardsEnabled()).to.equal(_lockedRewardsEnabled);
    });

    it("setUnlockedRewardsFactor()", async function () {
      const tx = await this.stake.connect(this.signers.admin).setUnlockedRewardsFactor(_unlockedRewardsFactor);
      await tx.wait();

      expect(await this.stake.unlockedRewardsFactor()).to.equal(_unlockedRewardsFactor);
      unlockedRewardsFactor = _unlockedRewardsFactor / REWARDS_DIV;
      console.log("unlockedRewardsFactor set to : ", unlockedRewardsFactor);
    });

    it("decrease lock time period - setLockTimePeriodOptions()", async function () {
      const lockTimePeriods: number[] = await this.stake.getLockTimePeriodOptions();
      let lockTimePeriodRewardFactors: number[] = [];
      for (let i = 0; i < lockTimePeriods.length; i++) {
        lockTimePeriodRewardFactors.push((1 + i / 10) * REWARDS_DIV); // 10% extra each level up TEST TODO ?
      }

      // lockTimePeriods[1] += 1; // increase lock time at index 1 by 1 second
      let newLockTimePeriods = [...lockTimePeriods]; // make a copy as we can not change lockTimePeriods
      newLockTimePeriods.splice(1, 1, lockTimePeriods[1] + 1); // newLockTimePeriods[1]+1); // newLockTimePeriods[1] += 1

      const tx = await this.stake
        .connect(this.signers.admin)
        .setLockTimePeriodOptions(newLockTimePeriods, lockTimePeriodRewardFactors);
      await tx.wait();

      expect(await this.stake.getLockTimePeriodOptions()).to.eql(newLockTimePeriods);
      expect(await this.stake.getLockTimePeriodRewardFactors()).to.eql(lockTimePeriodRewardFactors);
    });

    it("decrease lock time period - set lockTimePeriodRewardFactors to default", async function () {
      const lockTimePeriods: number[] = await this.stake.getLockTimePeriodOptions();

      // lockTimePeriods[1] -= 1; // reduce lock time at index 1 by 1 second
      let newLockTimePeriods = [...lockTimePeriods]; // make a copy as we can not change lockTimePeriods
      newLockTimePeriods.splice(1, 1, lockTimePeriods[1] - 1);

      const tx = await this.stake.connect(this.signers.admin).setLockTimePeriodOptions(newLockTimePeriods, []);
      await tx.wait();

      expect(await this.stake.getLockTimePeriodOptions()).to.eql(newLockTimePeriods);

      const lockTimePeriodRewardFactors: number[] = await this.stake.getLockTimePeriodRewardFactors();
      expect(lockTimePeriodRewardFactors.length == lockTimePeriods.length);
      for (let i = 0; i < lockTimePeriodRewardFactors.length; i++) {
        expect(lockTimePeriodRewardFactors[i] == REWARDS_DIV, "lockTimePeriodRewardFactors not set to default");
      }
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
      expect(balance).to.gte(amount);
    });

    /*
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

    it("setRewardToken()", async function () {
      const tx = await this.stake.connect(this.signers.admin).setRewardToken(this.rewardToken.address);
      await tx.wait();

      const rewardToken_address = await this.stake.rewardToken();
      console.log("this.stake.rewardToken() = ", rewardToken_address);
      expect(rewardToken_address).to.equal(this.rewardToken.address);
    });
*/

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

    /**
     * Time Period : 0
     * user1 : stake with lockTimePeriodOption = 1 (7 days)
     */

    it("user can stake token (option 1 = 7 days)", async function () {
      console.log("staking now ... STAKE_AMOUNT =", hre.ethers.utils.formatUnits(STAKE_AMOUNT, stakeTokenDecimals));

      let tx;
      expect((tx = await this.stake.connect(this.signers.user1).stakelockTimeChoice(STAKE_AMOUNT, 1))).to.emit(
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
      expect(stakeBalance).to.equal(STAKE_AMOUNT, "stake contract does not reflect staked amount");

      expect(await this.stakeToken.balanceOf(this.signers.user1.address)).to.equal(
        user1BalanceStart.sub(STAKE_AMOUNT),
        "user1 balance was not reduced by staked amount",
      );
    });

    it("verify getUnlockTime_msgSender()", async function () {
      const unlockTime = await this.stake.connect(this.signers.user1).getUnlockTime_msgSender();
      const stakeTime = await this.stake.connect(this.signers.user1).stakeTime_msgSender();
      console.log("unlockTime =", unlockTime);
      console.log("stakeTime  =", stakeTime);
      console.log("LOCK_TIME_PERIOD =", lockTimePeriodOptions[1]);
      expect(Math.abs(unlockTime - stakeTime - lockTimePeriodOptions[1])).lte(
        60,
        "stakeTime not within 60 seconds of current blocktime",
      );
    });

    it("user can not unstake during the lockTimePeriod", async function () {
      // wait 5 timePeriods
      if (hre.network.name != "hardhat") this.timeout(5 * timePeriod * 1000 + TIMEOUT_BLOCKCHAIN_ms); // wait time + 15 min timeout for RPC call
      timeNow = await waitTime(5 * timePeriod);
      timeRelative = timeNow - startTime;
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

      const blockTime = await getTimestamp();
      console.log("blockTime =", blockTime);

      const stakeRewardEndTime = await this.stake.stakeRewardEndTime();
      console.log("stakeRewardEndTime =", stakeRewardEndTime.toString());

      const unlockTime = await this.stake.connect(this.signers.user1).getUnlockTime_msgSender();
      console.log("unlockTime         =", unlockTime.toString());

      console.log(">>>> _lockedRewardsEnabled =", _lockedRewardsEnabled);

      let userClaimableRewards_expected: BigNumber;
      if (_lockedRewardsEnabled) {
        userClaimableRewards_expected = STAKE_AMOUNT.mul(unlockTime - stakeTime1);
      } else {
        userClaimableRewards_expected = STAKE_AMOUNT.mul(blockTime - stakeTime1);
      }

      console.log("userClaimableRewards_expected =", userClaimableRewards_expected.toString());

      userClaimableRewards_contract = await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender();
      console.log("userClaimableRewards_contract =", userClaimableRewards_contract.toString());

      difference = userClaimableRewards_contract.sub(userClaimableRewards_expected).div(stakeBalance).abs();
      console.log("difference =", difference.toString());
      expect(difference).to.lte(5, "userClaimableRewards calculation is too far off");
    });

    /**
     * Time Period : 7
     */

    it("check rewards after first lock time period", async function () {
      const stakedTime = 7 * timePeriod;

      timeNow = await setTime(stakeTime1 + stakedTime);
      const userTotalRewards_contract = await this.stake.connect(this.signers.user1).userTotalRewards_msgSender();
      console.log("userTotalRewards_contract =", userTotalRewards_contract);
      const userTotalRewards_expected = STAKE_AMOUNT.mul(stakedTime);
      console.log("userTotalRewards_expected =", userTotalRewards_expected);
      expect(userTotalRewards_contract).to.be.closeTo(userTotalRewards_expected, userTotalRewards_expected.div(100)); // allow 1% error
    });

    /**
     * Time Period : 8
     */
    it("check rewards after 1 period after end of lock time option 1 (7 days)", async function () {
      await setTime(stakeTime1 + 8 * timePeriod);
      const userTotalRewards_contract = await this.stake.connect(this.signers.user1).userTotalRewards_msgSender();
      console.log("userTotalRewards_contract =", userTotalRewards_contract);
      const userTotalRewards_expected = STAKE_AMOUNT.mul((7 + 1 * unlockedRewardsFactor) * timePeriod);
      console.log("userTotalRewards_expected =", userTotalRewards_expected);
      expect(userTotalRewards_contract).to.be.closeTo(userTotalRewards_expected, userTotalRewards_expected.div(100)); // allow 1% error
    });

    it("withdraw half of staked tokens", async function () {
      const tx = await this.stake.connect(this.signers.user1).withdraw(STAKE_AMOUNT.div(2));
      await tx.wait();
      expect(await this.stake.stakeAmount(this.signers.user1.address)).to.equal(
        STAKE_AMOUNT.div(2),
        "remaining staked amount wrong",
      );
    });

    /**
     * Time Period : 10
     * check rewards : 8 * full amount + 2 * half amount = 9 * full amount
     */
    it("check rewards after 1 period after end of lock time option 1 (7 days)", async function () {
      await setTime(stakeTime1 + 10 * timePeriod);
      lastRewardsContract = await this.stake.connect(this.signers.user1).userTotalRewards_msgSender();
      console.log("userTotalRewards_contract =", lastRewardsContract);
      const userTotalRewards_expected = STAKE_AMOUNT.mul((7 + 2 * unlockedRewardsFactor) * timePeriod);
      console.log("userTotalRewards_expected =", userTotalRewards_expected);
      expect(lastRewardsContract).to.be.closeTo(userTotalRewards_expected, userTotalRewards_expected.div(100)); // allow 1% error
    });

    it("withdraw other half of staked tokens", async function () {
      const tx = await this.stake.connect(this.signers.user1).withdrawAll();
      await tx.wait();
      expect(await this.stake.stakeAmount(this.signers.user1.address)).to.equal(0, "remaining staked amount not 0");
    });

    /**
     * Time Period : 11
     */
    it("no change in rewards 1 period after unstaking", async function () {
      console.log("Time Period : 11");
      await setTime(stakeTime1 + 11 * timePeriod);
      const userTotalRewards_contract = await this.stake.connect(this.signers.user1).userTotalRewards_msgSender();
      console.log("userTotalRewards_contract =", userTotalRewards_contract);
      expect(userTotalRewards_contract).to.be.closeTo(lastRewardsContract, "1000000000000000000000");
      console.log(
        "^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n\n\n",
      );
    });

    it("check staked balance and remaining lock time", async function () {
      const remainingLockTime = await this.stake.connect(this.signers.user1).remainingLockPeriod_msgSender();
      console.log("remainingLockTime =", remainingLockTime, remainingLockTime / DAYS);
      const stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      console.log("stakeBalance      =", hre.ethers.utils.formatUnits(stakeBalance, stakeTokenDecimals));
      expect(remainingLockTime).to.eq(0, "remainingLockTime is not 0 - funds still locked");
      expect(stakeBalance).to.eq(0, "stakeBalance is not 0");
    });

    it("user stake again - same amount again - option 2 = 14 days lock time", async function () {
      const userBalance = await this.stakeToken.balanceOf(this.signers.user1.address);
      console.log("staking now ... STAKE_AMOUNT =", hre.ethers.utils.formatUnits(STAKE_AMOUNT, stakeTokenDecimals));

      const tx = await this.stake.connect(this.signers.user1).stakelockTimeChoice(STAKE_AMOUNT, 2);
      await tx.wait();

      stakeTime2 = await getTimestamp();

      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      console.log("stakeBalance =", hre.ethers.utils.formatUnits(stakeBalance, stakeTokenDecimals));
      expect(stakeBalance).to.equal(STAKE_AMOUNT, "stake contract does not reflect staked amount");

      expect(await this.stakeToken.balanceOf(this.signers.user1.address)).to.equal(
        userBalance.sub(STAKE_AMOUNT),
        "user1 balance was not reduced by staked amount",
      );
    });

    /**
     * Check userAccumulatedRewards
     * After the 2nd staking, claimable reward should have become accumulated reward
     * There may be a difference of one block time of rewards
     */
    it("after the 2nd staking, claimable rewards should have become accumulated reward", async function () {
      const blockTime = await getTimestamp();
      const userAccumulatedRewards_expected = STAKE_AMOUNT.mul((7 + 2 * unlockedRewardsFactor) * timePeriod);
      console.log("userAccumulatedRewards_expected =", userAccumulatedRewards_expected);

      const userAccumulatedRewards_contract = await this.stake
        .connect(this.signers.user1)
        .userAccumulatedRewards_msgSender();
      console.log("userAccumulatedRewards_contract =", userAccumulatedRewards_contract);

      expect(userAccumulatedRewards_contract).to.be.closeTo(
        userAccumulatedRewards_expected,
        userAccumulatedRewards_expected.div(10000),
      ); // allow 0.01% error
    });

    /**
     * Check userClaimableRewards
     * After the 2nd staking, claimable reward should have been reset to 0
     * At most 20 sec should have been passed since then, accumulating a small userClaimableRewards balance
     */
    it("after staking again, userClaimableRewards should be (amount * 14 days)", async function () {
      userClaimableRewards_contract = await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender();

      expect(userClaimableRewards_contract).to.eq(
        stakeBalance.mul(14 * DAYS),
        "claimable reward should reflect 14 days lock period",
      );
    });

    it("2nd stake - day 10 : check userClaimableRewards for 14 days lock period", async function () {
      // wait 10 time periods
      if (hre.network.name != "hardhat") this.timeout(10 * timePeriod * 1000 + TIMEOUT_BLOCKCHAIN_ms);
      timeNow = await waitTime(10 * timePeriod);
      timeRelative = timeNow - startTime;

      expect(userClaimableRewards_contract).to.eq(
        stakeBalance.mul(14 * DAYS),
        "claimable reward should reflect 14 days lock period",
      );
    });

    it("stakelockTimeChoice(amount = 0, lockTimeOption = 0) should revert", async function () {
      await expect(this.stake.connect(this.signers.user1).stakelockTimeChoice(0, 0)).to.be.reverted;
    });

    it("day 10 : extend lock period by 7 days from now", async function () {
      const userBalance = await this.stakeToken.balanceOf(this.signers.user1.address);

      let userClaimableRewards_contract = await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender();
      console.log("userClaimableRewards_contract =", userClaimableRewards_contract);

      const userAccumulatedRewards_contract_before = await this.stake
        .connect(this.signers.user1)
        .userAccumulatedRewards_msgSender();
      console.log("userAccumulatedRewards_contract_before =", userAccumulatedRewards_contract_before);

      const tx = await this.stake.connect(this.signers.user1).stakelockTimeChoice(0, 1); // no additional funds, lockTimeOption 1 = 7 days
      await tx.wait();

      userClaimableRewards_contract = await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender();
      console.log("userClaimableRewards_contract =", userClaimableRewards_contract);

      const userClaimableRewards_expected = STAKE_AMOUNT.mul(7 * DAYS);
      console.log("userClaimableRewards_expected =", userClaimableRewards_expected);

      expect(userClaimableRewards_contract).to.be.closeTo(
        userClaimableRewards_expected,
        userClaimableRewards_expected.div(10000),
      ); // allow 0.01% error

      const userAccumulatedRewards_contract_after = await this.stake
        .connect(this.signers.user1)
        .userAccumulatedRewards_msgSender();
      console.log("userAccumulatedRewards_contract =", userAccumulatedRewards_contract_after);

      expect(userAccumulatedRewards_contract_after).to.be.closeTo(
        userAccumulatedRewards_contract_before.add(STAKE_AMOUNT.mul(10 * DAYS)),
        userAccumulatedRewards_contract_after.div(10000),
      ); // allow 0.01% error

      const remainingLockPeriod = await this.stake.connect(this.signers.user1).remainingLockPeriod_msgSender();
      expect(remainingLockPeriod).to.be.closeTo(7 * DAYS, 120);
    });

    /**
     * funds still 7 days locked
     * wait 2 days ...
     * 5 days before unlockTime we topUp stake amount
     */
    it("day 12 : topUp stake amount", async function () {
      timeNow = await waitTime(2 * timePeriod);
      timeRelative = timeNow - startTime;

      const userBalance = await this.stakeToken.balanceOf(this.signers.user1.address);

      let userClaimableRewards_contract = await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender();
      console.log("userClaimableRewards_contract =", userClaimableRewards_contract);

      const userAccumulatedRewards_contract_before = await this.stake
        .connect(this.signers.user1)
        .userAccumulatedRewards_msgSender();
      console.log("userAccumulatedRewards_contract_before =", userAccumulatedRewards_contract_before);

      const tx = await this.stake.connect(this.signers.user1).stakelockTimeChoice(STAKE_AMOUNT, 0); // stake same amount again, lockTimeOption 0 = do not extend lock period
      await tx.wait();

      userClaimableRewards_contract = await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender();
      console.log("userClaimableRewards_contract =", userClaimableRewards_contract);

      const userClaimableRewards_expected = STAKE_AMOUNT.mul(2 * 5 * DAYS); // double amount locked for the remaining 5 days
      console.log("userClaimableRewards_expected =", userClaimableRewards_expected);

      expect(userClaimableRewards_contract).to.be.closeTo(
        userClaimableRewards_expected,
        userClaimableRewards_expected.div(10000),
      ); // allow 0.01% error

      const userAccumulatedRewards_contract_after = await this.stake
        .connect(this.signers.user1)
        .userAccumulatedRewards_msgSender();
      console.log("userAccumulatedRewards_contract_after topUp =", userAccumulatedRewards_contract_after);

      expect(userAccumulatedRewards_contract_after).to.be.closeTo(
        userAccumulatedRewards_contract_before.add(STAKE_AMOUNT.mul(2 * DAYS)),
        userAccumulatedRewards_contract_after.div(10000),
      ); // allow 0.01% error

      const remainingLockPeriod = await this.stake.connect(this.signers.user1).remainingLockPeriod_msgSender();
      expect(remainingLockPeriod).to.be.closeTo(5 * DAYS, 120);
    });

    it("user can unstake after the lockTimePeriod is over", async function () {
      const lastStakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      expect(lastStakeBalance).to.equal(STAKE_AMOUNT.mul(2), "staked amount is wrong");

      timeNow = await waitTime(15 * timePeriod); // wait 10 days
      timeRelative = timeNow - startTime;

      const remainingLockPeriod = await this.stake.connect(this.signers.user1).remainingLockPeriod_msgSender();
      console.log("remainingLockPeriod (sec/days) =", remainingLockPeriod, remainingLockPeriod / DAYS);
      expect(remainingLockPeriod).to.eq(0); // funds should be unlocked now (5 days after unlock time)

      const userAccumulatedRewards_contract_prev = await this.stake
        .connect(this.signers.user1)
        .userAccumulatedRewards_msgSender();

      console.log("**************************** UNSTAKE 1/4 tokens ****************************");

      // withdraw one quarter of staked tokens
      const tx = await this.stake.connect(this.signers.user1).withdraw(lastStakeBalance.div(4));
      await tx.wait();

      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);

      console.log(
        "stakeBalance after partial withdraw =",
        hre.ethers.utils.formatUnits(stakeBalance, stakeTokenDecimals),
      );

      const remainStakeBalance = lastStakeBalance.sub(lastStakeBalance.div(4));

      expect(stakeBalance).to.equal(remainStakeBalance, "remaining staked amount wrong");

      expect(await this.stakeToken.balanceOf(this.signers.user1.address)).to.equal(
        user1BalanceStart.sub(remainStakeBalance),
        "unstaked amount was not correctly added to user's balance",
      );

      console.log("**************************** UNSTAKE remaining 3/4 tokens ****************************");

      // UNSTAKE - withdraw all remaining staked tokens
      const tx2 = await this.stake.connect(this.signers.user1).withdrawAll();
      await tx2.wait();

      blocktime = await getTimestamp();

      console.log("(_unlockedRewardsFactor / REWARDS_DIV) =", _unlockedRewardsFactor / REWARDS_DIV);

      // rewards since last transaction (topUp)
      // expectedRewards_1 = 5 days * 2000 token staked in remaining lock period
      // expectedRewards_2 = 5 days * 2000 token staked in after lock period
      const expectedRewards_1 = lastStakeBalance.mul(5 * DAYS);
      console.log("expectedRewards_1                            = ", expectedRewards_1.toString());
      const expectedRewards_2 = lastStakeBalance.mul(10 * DAYS * (_unlockedRewardsFactor / REWARDS_DIV));
      console.log("expectedRewards_2                            = ", expectedRewards_2.toString());
      console.log("userAccumulatedRewards_contract after top up =", userAccumulatedRewards_contract_prev.toString());

      // BigNumber.from("3542406500000000000000000000"); // TODO
      expectedRewards = expectedRewards
        .add(expectedRewards_1)
        .add(expectedRewards_2)
        .add(userAccumulatedRewards_contract_prev);

      console.log(">>>>>> expectedRewards                       =", expectedRewards.toString());

      // stake amount should be zero
      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      expect(stakeBalance).to.equal(0, "stake amount should be 0");

      // user1 balance should be back to original amount
      expect(await this.stakeToken.balanceOf(this.signers.user1.address)).to.equal(
        user1BalanceStart,
        "user1 balance should be back to original amount",
      );

      const userAccumulatedRewards_contract_after_unstake = await this.stake
        .connect(this.signers.user1)
        .userAccumulatedRewards_msgSender();

      console.log(
        "userAccumulatedRewards_contract_after_unstake=",
        userAccumulatedRewards_contract_after_unstake.toString(),
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
      // const rewardsStake1 = STAKE_AMOUNT.mul(15).mul(timePeriod); // TODO - use measured, expired time
      // const rewardsStake2 = STAKE_AMOUNT.mul(10).mul(timePeriod);
      // const userAccumulatedRewards_expected = rewardsStake1.add(rewardsStake2);

      const userAccumulatedRewards_expected = expectedRewards; // STAKE_AMOUNT.mul(stakeTime2 - stakeTime1).add( STAKE_AMOUNT.mul(2).mul(blocktime - stakeTime2) );

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
    // it("after withdrawAll, user should not be able to increase rewards by calling withdraw(0)", async function () {
    //   const totalRewards_before = await this.stake.connect(this.signers.user1).userTotalRewards_msgSender();
    //   console.log("totalRewards_before =", hre.ethers.utils.formatUnits(totalRewards_before, rewardTokenDecimals));

    //   await expect(this.stake.connect(this.signers.user1).withdraw(0)).to.be.reverted;
    //   // await tx2.wait();

    //   const totalRewards_after = await this.stake.connect(this.signers.user1).userTotalRewards_msgSender();
    //   console.log("totalRewards_after  =", hre.ethers.utils.formatUnits(totalRewards_after, rewardTokenDecimals));

    //   expect(totalRewards_after).to.equal(totalRewards_before);
    // });

    /**
     * user should get 1 rewardToken for staking 1000 stakeToken for 5 timePeriods
     * In this test scenario we expect the user to receive 5 rewardToken (* 18 decimals)
     * (1000 token * 5 timePeriods) + (2000 token * 10 timePeriods) => 25 reward token
     */
    /*    
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
*/

    /**
     * admin can set disable reward token by calling setRewardToken(0)
     * admin will receive all reward tokens left in the staking contract
     */
    // it("admin can disable reward token and will receive all reward tokens left", async function () {
    //   const stakeRewardTokenBalance_before = await this.stake.getRewardTokenBalance();
    //   const adminRewardTokenBalance_before = await this.rewardToken.balanceOf(this.signers.admin.address);

    //   const tx = await this.stake.connect(this.signers.admin).setRewardToken(hre.ethers.constants.AddressZero);
    //   await tx.wait();

    //   const stakeRewardTokenBalance_after = await this.stake.getRewardTokenBalance();
    //   const adminRewardTokenBalance_after = await this.rewardToken.balanceOf(this.signers.admin.address);

    //   expect(stakeRewardTokenBalance_after).to.equal(0);
    //   expect(adminRewardTokenBalance_after).to.equal(
    //     adminRewardTokenBalance_before.add(stakeRewardTokenBalance_before),
    //   );
    // });
  });
}
