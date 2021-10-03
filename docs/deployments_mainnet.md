# PolsStake Deployments Mainnet

## BSC Mainet

### solc 0.8.9 0d0108c

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

## ETH Mainnet

# Release v2.0.0

```json
{
  "version": "0.8.9",
  "settings": {
    "metadata": {
      // Not including the metadata hash
      // https://github.com/paulrberg/solidity-template/issues/31
      "bytecodeHash": "none"
    },
    // You should disable the optimizer when debugging
    // https://hardhat.org/hardhat-network/#solidity-optimizer-support
    "optimizer": {
      "enabled": true,
      "runs": 800
    }
  }
}
```

```

 ·---------------------------|-------------·
 |  Contract Name            ·  Size (Kb)  │
 ····························|··············
 |  Address                  ·       0.04  │
 ····························|··············
 |  BasicToken               ·       0.80  │
 ····························|··············
 |  CappedToken              ·       2.28  │
 ····························|··············
 |  EnumerableSet            ·       0.04  │
 ····························|··············
 |  ERC20                    ·       2.27  │
 ····························|··············
 |  ERC20PresetMinterPauser  ·       6.61  │
 ····························|··············
 |  Ownable                  ·       0.32  │
 ····························|··············
 |  Pausable                 ·       0.62  │
 ····························|··············
 |  PausableToken            ·       2.71  │
 ····························|··············
 |  PolkastarterToken        ·       3.25  │
 ····························|··············
 |  PolsStake                ·       8.25  │
 ····························|··············
 |  RewardToken              ·       2.27  │
 ····························|··············
 |  SafeERC20                ·       0.04  │
 ····························|··············
 |  SafeMath                 ·       0.07  │
 ····························|··············
 |  StandardToken            ·       1.98  │
 ····························|··············
 |  Strings                  ·       0.04  │
 ·---------------------------|-------------·
```

```json
{
  currentNetwork: {
    name: 'homestead',
    chainId: 1,
    ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    _defaultProvider: [Function: func] { renetwork: [Function (anonymous)] }
  }
}
```

```
deployer account         : 0xb748910Bf3926DC2eE18ddB7c8b279eE9331955c
stakeTokenAddress (POLS) : 0x83e6f1E41cdd28eAcEB20Cb649155049Fac3D5Aa
LOCK_TIME_PERIOD         : 604800
constructorArgs = [ '0x83e6f1E41cdd28eAcEB20Cb649155049Fac3D5Aa', 604800 ]

PolsStake deployed to    : 0xc24A365A870821EB83Fd216c9596eDD89479d8d7

```
