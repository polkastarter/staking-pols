import { expect } from "chai";

export function shouldBehaveLikePolsStake(): void {
  it("should set lockTimePeriod", async function () {
    const oneWeek = "604800"; // 7 * 24 * 60 * 60;
    await this.stake.setLockTimePeriod(oneWeek);
    const result = await this.stake.connect(this.signers.admin).lockTimePeriod();
    console.log("result = ", result);
    expect(result).to.equal(oneWeek);
  });
}
