import { expect } from "chai";

export function basicTests(): void {
  it("should send token from admin account to user1 account", async function () {
    const amount = "1000" + "0".repeat(18);
    await this.stakeToken.connect(this.signers.admin).transfer(this.signers.user1.address, amount);
    const balance = await this.stakeToken.balanceOf(this.signers.user1.address);
    console.log("balance = ", balance.toString());
    expect(balance).to.equal(amount);
  });

  it("should set lockTimePeriod", async function () {
    const oneWeek = "604800"; // 7 * 24 * 60 * 60;
    await this.stake.setLockTimePeriod(oneWeek);
    const result = await this.stake.connect(this.signers.admin).lockTimePeriod();
    console.log("result = ", result.toString());
    expect(result).to.equal(oneWeek);
  });
}
