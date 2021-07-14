# IDO Staking

## User Story

- user buys token (no change in the process until here)

- user has 2 options what is going to happen with his token after the token sale ends:

  1.  Claim : tokens will be released into user's wallet according to vesting schedule (as before - no change here)

  2.  Stake : tokens will be directly transferred into the "IDO Staking contract"

### Claim case

- Once claimed, the wallet can never return to farm = tokens can only be staked by choosing option "Stake", so tokens will be directly, immediately transferred to the IDO Staking contract.

- As a reward the user will receive a certain amount of the same (project) token or any other token

- The reward tokens have to be pre-loaded into the IDO Staking contract by the project.

- User can user can withdraw staked token any time

  - but will not be able to enter the staking pool again (covered by the initial condition already)
  - but only the full amount (not partial withdraw)

### Questions

- How is the reward amount being calculated

  a) stake amount _ stake time _ x
  b) relative stake amount to all staked token _ stake time _ x
  c) bell curve

- When does the reward scheme end

  a) when all tokens have been distributed
  b) when all tokens have been distributed OR a certain time has been reached

- Can the project add more reward tokens to the IDO Staking pool while the reward scheme is active ?

- Can the project extend the reward scheme time period while the reward scheme is active ?

### Challenges & Implementation ideas

- implementing the "inverted bell bell curve" allocation and not generating high tranaction fees

- instead of a fixed curve / formula, a fully flexible approach which would allow to realize any function could be implemented. It have time periods of equal length (i.e. 1 week) and define for each time period how many tokens should be distributed within that time frame to all staked tokens.

Example :

[5% , 4.5% , 4% , 3% , 2% , 1% , ... 1% , 2% , 3% , 4% , 4.5% , 5% , ....]
