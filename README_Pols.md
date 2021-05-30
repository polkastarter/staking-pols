# Staking Contract with Time-based Rewards

## User function

### stake(amount)

Deposit the specified amount of POLS token into the staking contract.

### staked_msgSender() returns (uint amount)

Returns the amount of staked POLS token for a given address (msg.sender)

### calculateReward_msgSender() returns (uint amount)

Returns the amount of unclaimed reward tokens for a given address (msg.sender)

### claim()

Claim unclaimed reward tokens by minting them according to accrued credits.

### unlock()

Unlock staked token to be withdrawn after unlock time period passed

### withdraw()

Withdraw staked token from contract and return to user's wallet.

# Test

Run tests

```bash
$ npm test
```
