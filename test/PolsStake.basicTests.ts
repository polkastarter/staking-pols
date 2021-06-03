// https://www.chaijs.com/guide/styles/#expect
// https://www.chaijs.com/api/bdd/
// https://ethereum-waffle.readthedocs.io/en/latest/matchers.html

import hre from "hardhat";
import { expect } from "chai";
// import { PolsStake } from "../typechain";
// import { BigNumber } from "ethers";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// following line may need @ ts-ignore (but not used atm)
// import { expectRevert, time } from "@openzeppelin/test-helpers";

// https://docs.ethers.io/v5/api/utils/bignumber/
const { BigNumber } = hre.ethers;

const DECIMALS = 18;
const DECMULBN = BigNumber.from(10).pow(DECIMALS);
const DAYS = 24 * 60 * 60; // 1 Day in Seconds

export function basicTests(): void {
  describe("basicTests", function () {
    it("stake token should have 18 decimals", async function () {
      expect(await this.stakeToken.decimals()).to.equal(DECIMALS);
    });

    it("reward token should have 18 decimals", async function () {
      expect(await this.rewardToken.decimals()).to.equal(DECIMALS);
    });

    it("should send stake token from admin account to user1 account", async function () {
      const amount = "10000" + "0".repeat(18);
      await this.stakeToken.connect(this.signers.admin).transfer(this.signers.user1.address, amount);
      const balance = await this.stakeToken.balanceOf(this.signers.user1.address);
      console.log("balance = ", balance.toString());
      expect(balance).to.equal(amount);
    });

    it("user1 should still have some stake tokens", async function () {
      const amount = "10000" + "0".repeat(18);
      // no transfer of stake token to user1 here
      const balance = await this.stakeToken.balanceOf(this.signers.user1.address);
      console.log("balance = ", balance.toString());
      expect(balance).to.equal(amount);
    });

    it("should have deployed a reward token and (maybe) minted some to admin account", async function () {
      const balance = await this.rewardToken.balanceOf(this.signers.admin.address);
      console.log("reward token balance of admin = ", balance.toString());
      expect(balance).to.gte(0);
    });

    it("user1 should have no rewards token", async function () {
      const balance = await this.rewardToken.balanceOf(this.signers.user1.address);
      console.log("reward token balance of user1 = ", balance.toString());
      expect(balance).to.equal(0);
    });

    it("should set lockTimePeriod", async function () {
      const oneWeek = 7 * 24 * 60 * 60; // 1 week in seconds
      await this.stake.connect(this.signers.admin).setLockTimePeriod(oneWeek);
      const result = await this.stake.lockTimePeriod();
      console.log("lockTimePeriod (seconds) = ", result.toString());
      expect(result).to.equal(oneWeek);
    });
  });

  describe("test stake & unstake, time lock and rewards", function () {
    const stakeAmount = DECMULBN.mul(100); // 100 token
    let d: number;
    let temp = BigNumber.from(0);
    let timeNow: number; // number type makes time calculations easier
    let timeRelative: number; // will store time relative to start time
    let blocktime: number; //  = BigNumber.from(0);
    let stakeBalance = BigNumber.from(0);
    let difference = BigNumber.from(0);

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
      console.log("Jumping ", timeAmount / DAYS, " days into the future ...");
      await hre.ethers.provider.send("evm_increaseTime", [timeAmount]);
      await hre.ethers.provider.send("evm_mine", []);
      const blockNumber = await hre.ethers.provider.getBlockNumber();
      const timeNow = (await hre.ethers.provider._getBlock(blockNumber)).timestamp;
      console.log("moveTime : timeNow =", timeNow);
      console.log("----------------------------------------------------------------------------");
      return timeNow;
    };

    it("user can stake and unstake, but only after the lockTimePeriod is over", async function () {
      const startTime = await blockTimestamp();
      console.log("startTime =", startTime);

      /**
       * at this time the balance of the staked token should be 0
       */

      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      expect(stakeBalance).to.equal(0, "user should have a stake balance of 0");

      const user1BalanceStart = await this.stakeToken.balanceOf(this.signers.user1.address);
      console.log("user1Balance =", user1BalanceStart);

      /**
       * APPROVE stake token
       */
      await this.stakeToken.connect(this.signers.user1).approve(this.stake.address, user1BalanceStart);

      /**
       * STAKE the stake token
       */
      console.log("staking now - stakeAmount =", stakeAmount);
      await this.stake.connect(this.signers.user1).stake(stakeAmount);

      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      console.log("stakeBalance =", stakeBalance);
      expect(stakeBalance).to.equal(stakeAmount, "stake contract does not reflect staked amount");

      expect(await this.stakeToken.balanceOf(this.signers.user1.address)).to.equal(
        user1BalanceStart.sub(stakeAmount),
        "user1 balance was not reduced by staked amount",
      );

      const stakeTime = await this.stake.stakeTime(this.signers.user1.address);

      blocktime = await blockTimestamp();
      console.log("block.timestamp (sec/days) =", blocktime.toString(), blocktime / DAYS);

      expect(stakeTime).lte(blocktime, "stakeTime not <= block.timestamp");

      /**
       * jump 5 days into the future
       * */
      timeNow = await moveTime(5 * DAYS);
      timeRelative = timeNow - startTime;
      console.log("simulated time : seconds / Days", timeRelative, timeRelative / DAYS);
      console.log("----------------------------------------------------------------------------");

      /**
       * Test TIMELOCK
       * LockTimePeriod of 7 days has not expired yet - withdraw should fail
       * https://ethereum-waffle.readthedocs.io/en/latest/matchers.html?highlight=revert#revert
       */
      await expect(this.stake.connect(this.signers.user1).withdraw()).to.be.reverted;

      /**
       * check rewards : ~ 5 days * amount
       * */
      expect(await this.stake.connect(this.signers.user1).userAccumulatedRewards_msgSender()).to.equal(
        0,
        "user should not have any accumulated rewards",
      );

      let userClaimableRewards_expected = stakeAmount.mul(5).mul(DAYS);
      console.log("userClaimableRewards_expected =", userClaimableRewards_expected.toString());
      let userClaimableRewards_contract = await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender();
      console.log("userClaimableRewards_contract =", userClaimableRewards_contract.toString());
      difference = userClaimableRewards_contract.sub(userClaimableRewards_expected).div(stakeBalance).abs();
      console.log("difference =", difference.toString());
      expect(difference).to.lte(0, "userClaimableRewards calculation is too far off");

      /**
       * STAKE same amount again - lock period starts again
       * */
      console.log("staking now - stakeAmount =", stakeAmount);
      await this.stake.connect(this.signers.user1).stake(stakeAmount);

      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      console.log("stakeBalance =", stakeBalance.toString());
      expect(stakeBalance).to.equal(stakeAmount.mul(2), "stake contract does not reflect staked amount");

      expect(await this.stakeToken.balanceOf(this.signers.user1.address)).to.equal(
        user1BalanceStart.sub(stakeAmount).sub(stakeAmount),
        "user1 balance was not reduced by staked amount",
      );

      /**
       * Check userAccumulatedRewards
       * After the 2nd staking, claimable reward should have become accumulated reward
       * There may be a difference of one block time of rewards
       */
      let userAccumulatedRewards_contract = await this.stake
        .connect(this.signers.user1)
        .userAccumulatedRewards_msgSender();
      difference = userAccumulatedRewards_contract.sub(userClaimableRewards_contract).div(stakeBalance).abs();
      console.log("difference =", difference.toString());
      expect(difference).to.lte(1, "userAccumulatedRewards is too far off");

      /**
       * Check userClaimableRewards
       * After the 2nd staking, claimable reward should have been reset to 0
       */
      expect(await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender()).to.equal(
        0,
        "claimable reward should have been reset to 0",
      );

      /**
       * jump 10 days into the future
       */
      timeNow = await moveTime(10 * DAYS);
      timeRelative = timeNow - startTime;
      console.log("simulated time : seconds / Days", timeRelative, timeRelative / DAYS);
      console.log("----------------------------------------------------------------------------");

      /**
       * check claimable rewards : ~ 2 * stakeAmount * 10 days
       */
      userClaimableRewards_expected = stakeAmount.mul(2).mul(10).mul(DAYS);
      console.log("userClaimableRewards_expected =", userClaimableRewards_expected.toString());

      userClaimableRewards_contract = await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender();
      console.log("userClaimableRewards_contract =", userClaimableRewards_contract.toString());

      difference = userClaimableRewards_contract.sub(userClaimableRewards_expected).div(stakeBalance).abs();
      console.log("difference =", difference.toString());
      expect(difference).to.lte(1, "userClaimableRewards calculation is too far off");

      /**
       * UNSTAKE all token - user balance should be back to previous amount
       */

      const lastStakeBalance = stakeBalance;
      await this.stake.connect(this.signers.user1).withdraw();
      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      expect(stakeBalance).to.equal(0, "stake amount should be 0");
      expect(await this.stakeToken.balanceOf(this.signers.user1.address)).to.equal(
        user1BalanceStart,
        "user1 balance should be back to original amount",
      );

      /**
       * jump 10 day into the future - user should not receive any additional rewards
       */
      timeNow = await moveTime(10 * DAYS);
      timeRelative = timeNow - startTime;
      console.log("simulated time : seconds / Days", timeRelative, timeRelative / DAYS);
      console.log("----------------------------------------------------------------------------");

      /**
       * Check userClaimableRewards
       * After the unstaking, claimable reward should have been reset to 0 ...
       * and no rewards should have been earned in the days thereafter
       */
      expect(await this.stake.connect(this.signers.user1).userClaimableRewards_msgSender()).to.equal(
        0,
        "claimable reward should have been reset to 0",
      );

      /**
       * Check userAccumulatedRewards
       */
      const rewardsStake1 = stakeAmount.mul(15).mul(DAYS);
      const rewardsStake2 = stakeAmount.mul(10).mul(DAYS);
      const userAccumulatedRewards_expected = rewardsStake1.add(rewardsStake2);

      userAccumulatedRewards_contract = await this.stake.connect(this.signers.user1).userAccumulatedRewards_msgSender();

      difference = userAccumulatedRewards_contract.sub(userAccumulatedRewards_expected).div(lastStakeBalance).abs();
      console.log("difference =", difference.toString());
      expect(difference).to.lte(1, "userAccumulatedRewards is too far off");

      /**
       * Check userTotalRewards, should equal accumulatedRewards at this stage
       */
      const userTotalRewards_contract = await this.stake.connect(this.signers.user1).userTotalRewards_msgSender();

      difference = userAccumulatedRewards_contract.sub(userTotalRewards_contract).div(lastStakeBalance).abs();
      console.log("difference =", difference.toString());
      expect(difference).to.lte(1, "userTotalRewards is too far off");
    });

    /**
     * test reward token minting based on userTotalRewards
     */
    it("enable MINTER_ROLE on RewardToken for staking contract", async function () {
      const MINTER_ROLE = await this.rewardToken.MINTER_ROLE();
      await this.rewardToken.connect(this.signers.admin).grantRole(MINTER_ROLE, this.stake.address);
      expect(await this.rewardToken.hasRole(MINTER_ROLE, this.stake.address)).to.equal(true);
    });
  });
}
