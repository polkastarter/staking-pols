import hre from "hardhat";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { PolsStake } from "../typechain/PolsStake";
import { Signers } from "../types";
import { shouldBehaveLikePolsStake } from "./PolsStake.behavior";

const { deployContract } = hre.waffle;

describe("Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;

    const signers: SignerWithAddress[] = await hre.ethers.getSigners();
    this.signers.admin = signers[0];
  });

  describe("PolsStake", function () {
    beforeEach(async function () {
      const stakeTokenAddress: string = "0xd9145CCE52D386f254917e481eB44e9943F39138";
      const rewardTokenAddress: string = "0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8";
      const stakeArtifact: Artifact = await hre.artifacts.readArtifact("PolsStake");
      this.stake = <PolsStake>(
        await deployContract(this.signers.admin, stakeArtifact, [stakeTokenAddress, rewardTokenAddress])
      );
    });

    shouldBehaveLikePolsStake();
  });
});
