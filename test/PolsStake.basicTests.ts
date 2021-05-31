// https://www.chaijs.com/guide/styles/#expect
// https://www.chaijs.com/api/bdd/
// https://ethereum-waffle.readthedocs.io/en/latest/matchers.html

import hre from "hardhat";
import { expect } from "chai";

// import { expectRevert, time } from "@openzeppelin/test-helpers";

// https://docs.ethers.io/v5/api/utils/bignumber/
const { BigNumber } = hre.ethers;

const DECIMALS = 18;
const DECMULBN = BigNumber.from(10).pow(DECIMALS);
const DAYS = 24 * 60 * 60;

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

  describe("test stake & unstake", function () {
    it("user can stake and unstake, but only after the lockTimePeriod is over", async function () {
      const stakeAmount = DECMULBN.mul(100);

      let stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      expect(stakeBalance).to.equal(0, "user should have a stake balance of 0");

      const user1BalanceStart = await this.stakeToken.balanceOf(this.signers.user1.address);
      console.log("user1Balance =", user1BalanceStart);

      /** APPROVE stake token */

      await await this.stakeToken.connect(this.signers.user1).approve(this.stake.address, user1BalanceStart);

      /** STAKE the stake token */

      console.log("staking now - stakeAmount =", stakeAmount);
      await this.stake.connect(this.signers.user1).stake(stakeAmount);

      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      console.log("stakeBalance =", stakeBalance);
      expect(stakeBalance).to.equal(stakeAmount, "stake contract does not reflect staked amount");

      expect(await this.stakeToken.balanceOf(this.signers.user1.address)).to.equal(
        user1BalanceStart.sub(stakeAmount),
        "user1 balance was not reduced by staked amount",
      );

      /** STAKE AGAIN the same amount stake token */

      console.log("staking now - stakeAmount =", stakeAmount);
      await this.stake.connect(this.signers.user1).stake(stakeAmount);

      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      console.log("stakeBalance =", stakeBalance);
      expect(stakeBalance).to.equal(stakeAmount.mul(2), "stake contract does not reflect staked amount");

      expect(await this.stakeToken.balanceOf(this.signers.user1.address)).to.equal(
        user1BalanceStart.sub(stakeAmount).sub(stakeAmount),
        "user1 balance was not reduced by staked amount",
      );

      /** UNSTAKE */

      // move 6 days further - withdraw from staking contract should fail

      await hre.ethers.provider.send("evm_increaseTime", [6 * DAYS]);

      // https://ethereum-waffle.readthedocs.io/en/latest/matchers.html?highlight=revert#revert
      await expect(this.stake.connect(this.signers.user1).withdraw()).to.be.reverted;

      // move another 2 days further - now we are past the lock period - withdraw should succeed

      await hre.ethers.provider.send("evm_increaseTime", [2 * DAYS]);

      await this.stake.connect(this.signers.user1).withdraw();
      stakeBalance = await this.stake.stakeAmount(this.signers.user1.address);
      // stakeBalance = BigNumber.from(1);  // create expect fault
      expect(stakeBalance).to.equal(0, "stake amount should be 0");
      expect(await this.stakeToken.balanceOf(this.signers.user1.address)).to.equal(
        user1BalanceStart,
        "user1 balance should be back to original amount",
      );
    });
  });
}
