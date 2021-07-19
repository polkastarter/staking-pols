# IDO Staking

## User Story

- user buys tokens (using FixedSwap token sale contract, no change in the process until here)

- user has 2 options what is going to happen with his tokens after the token sale ends:

  1.  Claim : tokens will be released into user's wallet according to vesting schedule (as before - no change here)

  2.  Stake : tokens will be directly transferred into the "IDO Staking contract"

### Stake case

- Tokens can only be staked by choosing option "Stake", in which case the tokens will be transferred directly, immediately into the IDO Staking contract. This is the only way the tokens can get staked. As a result, once claimed from the staking contract, the wallet can never return to the staking contract (as it does not satisfy the condition that the tokens have to come directly out of the token sale contract).

- The reward tokens have to be pre-loaded by the project into the IDO Staking contract (ideally before start of sale, but definitely before the end of the token sale).

- A user can withdraw staked tokens any time, but only the full amount (no partial withdraw).

- Staked tokens will allocate reward tokens to the user over time.

- The reward tokens can either be the same token (as the staked token) or another token.

- The reward token allocation increases over time, but with the additional requirement that the allocation rate can vary over time in a "freely definable way) (i.e like an "inverted bell curve") This will be realized with defined allocations within discrete time periods of equal length and linear interpolation within the last period.

- The token allocation scheme ends either when

  a) all tokens have been distributed

  b) a certain point in time has been reached

### Limitations

- It is not required that more reward tokens can be added to the IDO Staking pool while the reward scheme is active (however we might allow that if it is easy to implement).

- It is not required that the reward scheme time period can be extended while the reward scheme is active (however we might allow that if it is easy to implement).
