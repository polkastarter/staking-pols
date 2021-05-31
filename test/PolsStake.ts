import hre from "hardhat";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { PolkastarterToken } from "../typechain/PolkastarterToken";
import { PolsStake } from "../typechain/PolsStake";

import { Signers } from "../types";
import { basicTests } from "./PolsStake.basicTests";

// https://ethereum-waffle.readthedocs.io
const { deployContract } = hre.waffle;

describe("Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers: SignerWithAddress[] = await hre.ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.user1 = signers[1];
    this.signers.user2 = signers[2];
  });

  describe("PolsStake", function () {
    beforeEach(async function () {
      // deploy stake token and mint initial token to deployer (this.signers.admin)
      const stakeTokenArtifact: Artifact = await hre.artifacts.readArtifact("PolkastarterToken");
      this.stakeToken = <PolkastarterToken>(
        await deployContract(this.signers.admin, stakeTokenArtifact, [this.signers.admin.address])
      );

      const rewardTokenAddress: string = "0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8";
      const stakeArtifact: Artifact = await hre.artifacts.readArtifact("PolsStake");
      this.stake = <PolsStake>(
        await deployContract(this.signers.admin, stakeArtifact, [this.stakeToken.address, rewardTokenAddress])
      );
    });

    basicTests();

    // scenario_1();

    // scenario_2():
  });
});
