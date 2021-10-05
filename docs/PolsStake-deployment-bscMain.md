# Polkastarter PolsStake - Deployment

## BSC Mainet

### solc 0.8.9 0d0108c - deployment

```json
{
  "currentNetwork": {
    "name": "bnb",
    "chainId": 56,
    "ensAddress": null,
    "_defaultProvider": null
  }
}
```

```
deployer account         : 0xb748910Bf3926DC2eE18ddB7c8b279eE9331955c
stakeTokenAddress (POLS) : 0x7e624fa0e1c4abfd309cc15719b7e2580887f570
PolsStake deployed to    : 0xD558675a8c8E1fd45002010BaC970B115163dE3a
```

### BscScan verification

`$ MAINNET_PRIVATE_KEY=e15ffb... npx hardhat run scripts/verify-bsc.ts --network bscMain`

```
{
  currentNetwork: {
    name: 'bnb',
    chainId: 56,
    ensAddress: null,
    _defaultProvider: null
  }
}

stakeTokenAddress (POLS) = 0x7e624fa0e1c4abfd309cc15719b7e2580887f570

Compiling 1 file with 0.8.9
Successfully submitted source code for contract
contracts/PolsStake.sol:PolsStake at 0xD558675a8c8E1fd45002010BaC970B115163dE3a
for verification on Etherscan. Waiting for verification result...

Successfully verified contract PolsStake on Etherscan.

```

https://bscscan.com/address/0xD558675a8c8E1fd45002010BaC970B115163dE3a#code
