// https://www.chaijs.com/guide/styles/#expect
// https://www.chaijs.com/api/bdd/
// https://ethereum-waffle.readthedocs.io/en/latest/matchers.html

import { expect } from "chai";

export function basicTests(): void {
  describe("basicTests", function () {
    it("should send stake token from admin account to user1 account", async function () {
      const amount = "1000" + "0".repeat(18);
      await this.stakeToken.connect(this.signers.admin).transfer(this.signers.user1.address, amount);
      const balance = await this.stakeToken.balanceOf(this.signers.user1.address);
      console.log("balance = ", balance.toString());
      expect(balance).to.equal(amount);
    });

    it("user1 should still have some stake tokens", async function () {
      const amount = "1000" + "0".repeat(18);
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
      await this.stake.setLockTimePeriod(oneWeek);
      const result = await this.stake.lockTimePeriod();
      console.log("lockTimePeriod (seconds) = ", result.toString());
      expect(result).to.equal(oneWeek);
    });
  });
}
