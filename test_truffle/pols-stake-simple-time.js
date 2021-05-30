// Load dependencies
const truffleAssert = require("truffle-assertions");
// const { expect } = require('chai');

// Import utilities from Test Helpers
const { expectRevert, expectEvent, BN, time } = require("@openzeppelin/test-helpers");

// Load compiled artifacts
const PolsToken = artifacts.require("PolkastarterToken");
const RewardToken = artifacts.require("POLSL");
const PolsStake = artifacts.require("PolsStake");

const dec18 = "0".repeat(18);
const amount1000 = "1000" + dec18;

// Start testing PolsStake contract
contract("PolsStake", function (accounts) {
  // Deploy all required contracts
  before(async function () {
    // Deploy POLS as stake token
    this.stakeToken = await PolsToken.new({ from: accounts[0] });

    // Deploy Reward token
    this.rewardToken = await RewardToken.new({ from: accounts[0] });

    // Deploy staking contract
    this.polsStake = await PolsStake.new(this.stakeToken.address, this.rewardToken.address, { from: accounts[0] });
  });

  describe("after contracts deployed", function () {
    it("transfer some POLS to account[1]", async function () {
      const polsAmount = "100000000000000000000"; // 1000.00
      await this.stakeToken.transfer(accounts[1], polsAmount, { from: accounts[0] });

      const polsBalance = await this.stakeToken.balanceOf(accounts[1]);

      assert.equal(polsBalance, amount1000, "failed to transfer stakeToken to account[1]");
    });

    it("transfer some POLS to account[2]", async function () {
      await this.stakeToken.transfer(accounts[2], polsAmount, { from: accounts[0] });

      this.rewardsAmount = "100000000000000000000"; // 1000.00
      await this.rewardToken.transfer(this.polsStake.address, this.rewardsAmount, { from: accounts[0] });

      // Permissions
      await this.stakeToken.approve(this.polsStake.address, polsAmount, { from: accounts[1] });
      await this.stakeToken.approve(this.polsStake.address, polsAmount, { from: accounts[2] });
    });
  });

  describe("Stake", function () {
    it("on stake", async function () {
      const polsAmount = "1000000000000000000"; // 10.00
      await this.polsStake.stake(polsAmount, { from: accounts[1] });

      const stake = await this.polsStake.stakeAmount.call(accounts[1]).valueOf();
      assert.equal(stake, polsAmount, "stake value is not correct");
    });

    /*
    it('claim', async function() {
      const polsAmount = '1000000000000000000'; // 10.00
      await this.polsStake.stake(
        polsAmount,
        { from: accounts[1] }
      );

      // await this.polsStake.distribute();

      // await this.polsStake.claim(
      //   { from: accounts[1] }
      // );

      const rewardBalanceAfterWithdraw = await this.rewardToken.balanceOf(accounts[1]);
      assert.equal(
        rewardBalanceAfterWithdraw.toString(),
        this.rewardsAmount,
        'Rewards not received'
      );

      const stake = await this.polsStake.stakeAmount.call(accounts[1]).valueOf();
      assert.equal(
        stake.toString(),
        polsAmount.toString(),
        'stake value is not correct'
      );
    });
    */
  });

  describe("Unstake", function () {
    it("on withdraw", async function () {
      const polsBalanceBeforeWithdraw = await this.stakeToken.balanceOf(accounts[1]);

      const polsAmount = "1000000000000000000"; // 10.00
      await this.polsStake.stake(polsAmount, { from: accounts[1] });

      await time.increase(time.duration.days(8));

      await this.polsStake.withdraw({ from: accounts[1] });

      const polsBalanceAfterWithdraw = await this.stakeToken.balanceOf(accounts[1]);
      assert.equal(polsBalanceAfterWithdraw.toString(), polsBalanceBeforeWithdraw, "Stake not recovered");

      /*
      const rewardBalanceAfterWithdraw = await this.rewardToken.balanceOf(accounts[1]);
      assert.equal(
        rewardBalanceAfterWithdraw.toString(),
        '100000000000000000000',
        'Rewards not received'
      );
      */

      const stake = await this.polsStake.stakeAmount.call(accounts[1]).valueOf();
      assert.equal(stake.toString(), 0, "stake value is not correct");
    });

    it("gets rewards", async function () {
      const polsAmount = "1000000000000000000"; // 10.00
      await this.polsStake.stake(polsAmount, { from: accounts[1] });

      // await this.polsStake.distribute();

      await this.polsStake.withdraw({ from: accounts[1] });

      const rewardBalanceAfterWithdraw = await this.rewardToken.balanceOf(accounts[1]);
      assert.equal(rewardBalanceAfterWithdraw.toString(), this.rewardsAmount, "Rewards not received");

      const stake = await this.polsStake.stakeAmount.call(accounts[1]).valueOf();
      assert.equal(stake, 0, "stake value is not correct");
    });

    it("gets rewards and re-stake", async function () {
      const polsAmount = "1000000000000000000"; // 10.00
      await this.polsStake.stake(polsAmount, { from: accounts[1] });
      await this.polsStake.stake(polsAmount, { from: accounts[2] });

      // await this.polsStake.distribute();

      await this.polsStake.withdraw({ from: accounts[1] });

      await this.polsStake.stake(polsAmount, { from: accounts[1] });

      const rewards = await this.polsStake.calculateReward.call(accounts[1], { from: accounts[1] });
      assert.equal(rewards.toString(), "0", "Rewards for Account 1 not correct");
    });

    it("gets rewards when two equal deposits", async function () {
      const polsAmount = "1000000000000000000"; // 10.00
      await this.polsStake.stake(polsAmount, { from: accounts[1] });
      await this.polsStake.stake(polsAmount, { from: accounts[2] });

      // await this.polsStake.distribute();

      await this.polsStake.withdraw({ from: accounts[1] });
      await this.polsStake.withdraw({ from: accounts[2] });

      const rewardBalanceOneAfterWithdraw = await this.rewardToken.balanceOf(accounts[1]);
      const rewardBalanceTwoAfterWithdraw = await this.rewardToken.balanceOf(accounts[2]);

      assert.equal(
        rewardBalanceOneAfterWithdraw.toString(),
        sumStrings(0, this.rewardsAmount / 2),
        "Rewards for Account 1 not correct",
      );

      assert.equal(
        rewardBalanceTwoAfterWithdraw.toString(),
        sumStrings(0, this.rewardsAmount / 2),
        "Rewards for Account 2 not correct",
      );
    });

    it("gets rewards when not equal deposits", async function () {
      const polsAmountOne = "1000000000000000000"; // 10.00
      await this.polsStake.stake(polsAmountOne, { from: accounts[1] });
      const polsAmountTwo = "500000000000000000"; // 5.00
      await this.polsStake.stake(polsAmountTwo, { from: accounts[2] });

      // await this.polsStake.distribute();

      await this.polsStake.withdraw({ from: accounts[1] });
      await this.polsStake.withdraw({ from: accounts[2] });

      const rewardBalanceOneAfterWithdraw = await this.rewardToken.balanceOf(accounts[1]);
      const rewardBalanceTwoAfterWithdraw = await this.rewardToken.balanceOf(accounts[2]);

      assert.equal(
        rewardBalanceOneAfterWithdraw.toString(),
        "66666666666666666666",
        "Rewards for Account 1 not correct",
      );

      assert.equal(
        rewardBalanceTwoAfterWithdraw.toString(),
        "33333333333333333333",
        "Rewards for Account 2 not correct",
      );
    });

    it("add more rewards and claim", async function () {
      const polsAmountOne = "1000000000000000000"; // 10.00
      await this.polsStake.stake(polsAmountOne, { from: accounts[1] });
      const polsAmountTwo = "500000000000000000"; // 5.00
      await this.polsStake.stake(polsAmountTwo, { from: accounts[2] });

      // await this.polsStake.distribute();

      await this.rewardToken.transfer(this.polsStake.address, this.rewardsAmount, { from: accounts[0] });

      // await this.polsStake.distribute();

      await this.polsStake.withdraw({ from: accounts[1] });
      await this.polsStake.withdraw({ from: accounts[2] });

      const rewardBalanceOneAfterWithdraw = await this.rewardToken.balanceOf(accounts[1]);
      const rewardBalanceTwoAfterWithdraw = await this.rewardToken.balanceOf(accounts[2]);

      assert.equal(
        rewardBalanceOneAfterWithdraw.toString(),
        sumStrings("66666666666666666666", "66666666666666666666"),
        "Rewards for Account 1 not correct",
      );

      assert.equal(
        rewardBalanceTwoAfterWithdraw.toString(),
        sumStrings("33333333333333333333", "33333333333333333333"),
        "Rewards for Account 2 not correct",
      );
    });
  });
});

function sumStrings(a, b) {
  return (BigInt(a) + BigInt(b)).toString();
}

function subStrings(a, b) {
  return (BigInt(a) - BigInt(b)).toString();
}
