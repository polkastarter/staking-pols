// eslint-disable @typescript-eslint/no-explicit-any
import { Fixture } from "ethereum-waffle";

import { Signers } from "./";
import { PolsStake } from "../typechain/PolsStake";

declare module "mocha" {
  export interface Context {
    stake: PolsStake;
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: Signers;
  }
}
