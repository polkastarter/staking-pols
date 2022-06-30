# PolsStake v3

## v2 Staking Overview (previous version / first live deployment)

We have a POLS token staking contract v2 (it's actually our first version, just the github release was v2.0.0 when deployed. Whenever v1 is somewhere mentioned in a comment, it's actually this v2 version.).

https://github.com/polkastarter/staking-pols/releases

It was deployed Oct 2021 on ETH & BSC which a simple rewards scheme (see README. md which still describes this release) and has been operational since then without any issues.

The internal rewards calculation is pretty simple , its : staked time (in seconds) \* amount

When staked, the tokens are locked for 7 days, however there is no impact on the rewards if tokens are locked or if time is past the lock perios, rewards are always determined just be time\*amount.

## v3 Staking Overview

The main features of v3 are :

### Standard Stake (first time / no existing staked balance)

`function stakelockTimeChoice(amount, lockTimeIndex)`

- when staking, a user can select a lock period from a predefined list (7 days, 14 days, 30 days, ...)
- once staked, a user immediately receives the (future) rewards he would receive during the staking period (amount\*time)
- after the lock period has past (after unlock time) the user gets no rewards (however this is configurable and could be more than zero rewards outside the lock period)

requirements : `amount > 0` AND `lockTimeIndex > 0`

### Extend Lock Period

While a user has already staked a certain amount, he may choose to lock up his tokens for even longer.

He will receive only the rewards for the elapsed time (stake time ... current time _ amount), not the future rewards (current time ... unlock time _ amount)). However the reward calculation will be restarted with the current blockTime as the stakeTime and unlockTime = blockTime + lockPeriod. As in the normal stake case, he will then receive the (future) rewards based on this nwe lock period (stakeTime ... unlockTime).

This operation is initiated be either calling the standard stake function with `amount=0` and a chosen option for `lockTimeIndex` (which needs to be > 0).

The new unlockTime has to be later than the previous unlockTime, otherwise the transaction will revert.

Alternatively `function extendLockTime(uint8 lockTimeIndex)` can be called .. although we might remove this function as it is covered by the standard stake function with `amount=0` anyway.

### TopUp staked amount

While a user has already staked a certain amount, he may choose to just add funds to the current lockPeriod.

Same rules apply as for extending the look period, only elapsed amount\*time rewards will be recognized, and future rewards will be re-calculated based on new amount and remaining lockPeriod.

This operation is initiated be either calling the standard stake function with a certain `amount` (which needs to be >=0) and `lockTimeIndex = 0`.

Alternatively `function topUp(uint256 _amount)` can be called .. although we might remove this function as it is covered by the standard stake function with `lockTimeIndex = 0` anyway.

## v3 - Reward Calculation

### Parameter

Due to above features the reward calculation became more complex. In addition there are parameter to tune the rewards as well as switch between v2 and v3 mode.

- `lockedRewardsEnabled`
  - true : user gets (future) rewards for lockPeriod\*amount at time of staking (v3 mode)
  - false: user does NOT get (future) rewards for lockPeriod\*amount at time of staking (v2 mode)
- `unlockedRewardsFactor`
  - 0 : no rewards for staking outside the lockPeriod (v3 mode)
  - 1 : linear rewards anytime, also outside the lockPeriod (1 is represented as 1\*REWARDS_DIV) (v2 mode)
- `lockTimePeriodRewardFactor`
  - an option to give every choice from the `lockTimePeriod`-list a "boost factor"
  - not sure/decided if we use/add that actually to the rewards calculation
- `stakeRewardEndTime`
  - no matter when the lockPeriod or staking ends, no rewards will be given after endTime
- `lockedRewardsCurrent`
  - false : returns the rewards as described above (future rewards will be given until unlockTime)
  - true : "extending lockPeriod" as well as "topUp" requires to ignore the future rewards which a user would be normally receive and instead return what he has actually accumulated until this point of time

### Testing

As there are quite some combinations of stakeTime, unlockTime, current blockTime, endTime, lockedRewardsEnabled, and lockedRewardsCurrent the function to calculate the rewards for a certain account at a given time has been extracted into function `_userClaimableRewardsCalculation` for easier testing as well as giving front end application to possibility to request an expected reward for a certain (to be committed) parameter combination.

**test scripts**

- `PolsStake_v1.ts` tests v3 set to `v2 mode`
- `PolsStake_v1-PolsRewards.ts` tests v3 set to `v2 mode` (stake token = reward token , `removeOtherERC20Tokens`)
- `PolsStake-v3-RewardCalculation.ts` lots of (partially redundant) test cases to test function `_userClaimableRewardsCalculation`
- `PolsStake-v3.ts` tests most of v3 features, mainly the (upfront) rewards from locking tokens into the staking contract
- `PolsStake-v3-no-unlocked-rewards.ts` mostly the same as `PolsStake-v3.ts` but setup with `unlockedRewardsFactor = 0` so that users do not receive any rewards for tokens staked outside the lock period
