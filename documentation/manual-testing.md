# Manual Testing of POLS Staking contract

### POLS token on BSC-testnet

`0xcfd314B14cAB8c3e36852A249EdcAa1D3Dd05055`

https://testnet.bscscan.com/address/0xcfd314B14cAB8c3e36852A249EdcAa1D3Dd05055#readContract

I have deployed the POLS staking contract on BSC testnet, and also verified it with BSC scan.
Successfully verified contract PolsStake on BSCscan.

`0x20c48C19Ca7079Ed8E7CD317829d4ebf75125390`

https://testnet.bscscan.com/address/0x20c48C19Ca7079Ed8E7CD317829d4ebf75125390#code

If you want to try it out yourself:
Goto the POLS contract, and execute the approve function (first one) ... click on the Web3 connected text (red)
https://testnet.bscscan.com/address/0xcfd314B14cAB8c3e36852A249EdcAa1D3Dd05055#code [WRITE CONTRACT]
\_spender (address) = 0x20c48C19Ca7079Ed8E7CD317829d4ebf75125390 (that's the POLS staking contract)
\_value (uint256) = 10000000000000000000000 (10000 POLS with 18 decimals)
[write}

3. Goto the POLS staking contract

https://testnet.bscscan.com/address/0x20c48C19Ca7079Ed8E7CD317829d4ebf75125390#code [Write Contract]

Connect to Web 3

goto 11. **stake**

\_amount (uint256) = 1000000000000000000000 (1000 POLS)

[write]

You can try 12. [withdraw] but the stake lock period is set to 10 minutes (600 sec), so until then you should expect an error, thereafter it should work.

Going to [Read Contract] you could try

4. balanceOf <your-account-address>

5. getUnlockTime <your-account-address> (when your staked tokens will be unlocked)

6. stakeAmount <your-account-address> (amount of staked POLS)

7. stakeTime <your-account-address> (when the POLS tokens were staked)

8. stakingToken (what token you can stake = contract address of POLS token on BSCtest)

9. userAccumulatedReward <your-account-address> (internal "secret" reward tracking)

10. userClaimableReward <your-account-address> (internal "secret" reward tracking)

11. userMap <your-account-address> (info about what the user staked and when)
