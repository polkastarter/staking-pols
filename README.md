# Staking Contract with Time-based Rewards

## Overview

This repo implements a basic staking contract with some added functionality for stake-time based rewards.

This staking contract shall eventually be the basis for an improved incentive mechanism for a rewards-based lottery ticket allocation.

---

## Deployment Parameter

At time of deployment, the contract address of the token which can be staked needs to be provided as well as the time (in seconds) the staked token shall be locked.

After deployment, (optionally) a ERC20 rewards token can be set set and tokens provided to the contract, which can be claimed later by the users.

---

## User functions (Basic features)

### stake(amount)

Deposit the specified amount of POLS token into the staking contract. In our context POLS is the "staking token".

The user has to approve POLS token first by calling the `approve()` function on the POLS ERC20 token contract, before he can call the stake function.

Every time a user stakes token, either for the first time or adding tokens later, a new lockTimePeriod starts.

### stakeAmount_msgSender() returns (uint256 amount)

Returns the amount of staked token (POLS) for `msg.sender`

### stakeTime_msgSender() returns (uint time)

Returns the unix epoch time (in seconds) when the user executed a transaction (stake or unstake) the last time.

### getUnlockTime_msgSender returns (uint time)

Returns the time when the user's token will be unlocked and can be withdrawn.

### withdraw(uint256 amount) returns (uint256 amount)

If `lockTimePeriod` had been set, this time period has to be expired since the last `stake` transaction, before the staked tokens can be withdrawn.

There is no need for the user to explicitly 'unlock' the staked token, they will 'automatically' be unlocked after the `lockTimePeriod` expired.

`withdraw(amount)`, return `amount` staked tokens to the user's account.

The lock period will not be extended, unlock time will stay unchanged.

All rewards will stay within the contract.

### withdrawAll() returns (uint256 amount)

As `withdraw(amount)`, but all staked tokens will be returned to the user's account.

---

## User Reward functions

While the user has staked token, 'internal reward credits' are being earned.

`stakeRewardEndTime` defines the time when reward scheme ends and no more 'internal reward credits' are being earned for staking token.

### userClaimableRewards_msgSender() returns (uint256 amount)

Over time the user earns reward credits which are (to begin with) only tracked internally within the contract.
`userClaimableRewards` is the ongoing reward allocation = amount of staked token \* the time since the last stake/unstake transaction was executed.

### userAccumulatedRewards_msgSender() returns (uint256 amount)

Whenever the staking amount changes, the past earned rewards (= `userClaimableRewards`) are being added to `userAccumulatedRewards`. Then the `stakeTime` is reset to the current time, and `userClaimableRewards` are being calculated anew based on the new time period \* new staked token amount.

### userTotalRewards_msgSender() returns (uint256 amount)

`userTotalRewards` is just the sum of `userAccumulatedRewards` and `userClaimableRewards`

### claim()

Mint (real) ERC20 'reward token' according to accrued rewards credits into the user's account.

After `claim` all rewards credits have been converted to reward token, `userAccumulatedRewards` and `userClaimableRewards` will both be 0 thereafter.

---

## Admin functions

The deployer account is being assigned the `DEFAULT_ADMIN_ROLE` which is allowed to execute various administrative functions.

### setLockTimePeriod(uint \_lockTimePeriod)

Sets the time (in seconds) a user has to wait after the last stake transaction until he can withdraw the staked token again.

When a user adds token to his already staked token amount, the 'lockTimePeriod' starts again.

### setRewardToken(address)

Specify the contract address of a mintable ERC20 reward token.

When setting it to address(0), users can not claim/mint reward token (any more) based on their earned rewards credits.

### setStakeRewardFactor(uint256)

The internal rewards credits are just accumulated `stakeAmount` \* `stakeTime`.

Example 1000 POLS token staked for 1 week : 1000 \* 7 \* 24 \* 60 \* 60 = 604800000

(This example assumes that stake token uses the same decimals as reward token, otherwise it has to be accounted for when setting `stakeRewardFactor`.)

If this value is being set as `setStakeRewardFactor` then a user will able to claim/mint 1 reward token after staking 1000 staking token for 1 week.

A user would also be able to claim/mint 1 reward token after staking 7000 staking token for 1 day.

### setStakeRewardEndTime(uint time)

Set the time when the reward scheme ends and no more 'internal reward credits' are being earned for staking token.

---

### External Contract functions

All user functions are also available to external contracts and can be called by providing an account address.

### burnRewards(address from, uint256 amount) public onlyRole(BURNER_ROLE)

`burnRewards()` allows an external contract which has been assigned the `BURNER_ROLE` to subtract a certain amount of reward credits of a specified account.

===============================================================================

# Project Setup

The Solidity template from [@paulrberg](https://github.com/paulrberg) was used to initialize this project.

https://github.com/paulrberg/solidity-template

- [Hardhat](https://github.com/nomiclabs/hardhat): compile and run the smart contracts on a local development network
- [TypeChain](https://github.com/ethereum-ts/TypeChain): generate TypeScript types for smart contracts
- [Ethers](https://github.com/ethers-io/ethers.js/): renowned Ethereum library and wallet implementation
- [Waffle](https://github.com/EthWorks/Waffle): tooling for writing comprehensive smart contract tests
- [Solhint](https://github.com/protofire/solhint): linter
- [Solcover](https://github.com/sc-forks/solidity-coverage): code coverage
- [Prettier Plugin Solidity](https://github.com/prettier-solidity/prettier-plugin-solidity): code formatter

## Usage

### Pre Requisites

Before running any command, make sure to install dependencies:

```sh
$ yarn install
```

### Compile

Compile the smart contracts with Hardhat:

```sh
$ yarn compile
```

### TypeChain

Compile the smart contracts and generate TypeChain artifacts:

```sh
$ yarn typechain
```

### Lint Solidity

Lint the Solidity code:

```sh
$ yarn lint:sol
```

### Lint TypeScript

Lint the TypeScript code:

```sh
$ yarn lint:ts
```

### Test

Run the Mocha tests on hardhat:

```sh
$ yarn test
```

Run the Mocha tests on a test blockchain:

Currently configured (in `hardhat.config.ts`) :

- mainnet (Ethereum)
- ganache
- goerli
- kovan
- rinkeby
- ropsten
- moonDev
- moonAlpha

```sh
$ yarn test --network <network>
```

### Coverage

Generate the code coverage report:

```sh
$ yarn coverage
```

### Report Gas

See the gas usage per unit test and average gas per method call:

```sh
$ REPORT_GAS=true yarn test
```

### Clean

Delete the smart contract artifacts, the coverage reports and the Hardhat cache:

```sh
$ yarn clean
```

### Deploy

Deploy the contracts to Hardhat Network:

```sh
$ yarn deploy
```

Deploy the contracts to a specific network, such as the Ropsten testnet:

```sh
$ yarn deploy:network ropsten
```

### Flatten

```sh
$ yarn flatten
```

Will flatten `PolsStake.sol` and write the result file `contracts_flat/PolsStake_flat.sol`

### Audit

```sh
$ yarn audit
```

Will execute `slither` contract audit.

## Syntax Highlighting

If you use VSCode, you can enjoy syntax highlighting for your Solidity code via the
[vscode-solidity](https://github.com/juanfranblanco/vscode-solidity) extension. The recommended approach to set the
compiler version is to add the following fields to your VSCode user settings:

```json
{
  "solidity.compileUsingRemoteVersion": "v0.8.4+commit.c7e474f2",
  "solidity.defaultCompiler": "remote"
}
```

Where of course `v0.8.4+commit.c7e474f2` can be replaced with any other version.
