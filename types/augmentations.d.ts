// eslint-disable @typescript-eslint/no-explicit-any
import { Fixture } from "ethereum-waffle";

import { Signers } from "./";

import { PolkastarterToken } from "../typechain/PolkastarterToken";
import { RewardToken } from "../typechain/RewardToken";
import { ERC20 } from "../typechain/ERC20";
import { IERC20Metadata } from "../typechain/IERC20Metadata";

import { PolsStake } from "../typechain/PolsStake";

declare module "mocha" {
  export interface Context {
    stakeToken: PolkastarterToken;
    rewardToken: RewardToken;
    stake: PolsStake;

    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: Signers;
  }
}
