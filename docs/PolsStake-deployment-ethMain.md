# Polkastarter PolsStake - Deployment

## Etherem Meainnet

### Deployment

```
deployer account         : 0xb748910Bf3926DC2eE18ddB7c8b279eE9331955c
stakeTokenAddress (POLS) : 0x83e6f1E41cdd28eAcEB20Cb649155049Fac3D5Aa
LOCK_TIME_PERIOD         : 604800
constructorArgs = [ '0x83e6f1E41cdd28eAcEB20Cb649155049Fac3D5Aa', 604800 ]

PolsStake deployed to    : 0xc24A365A870821EB83Fd216c9596eDD89479d8d7

```

https://etherscan.io/address/0xc24a365a870821eb83fd216c9596edd89479d8d7#code

### Etherscan verification

`$ MAINNET_PRIVATE_KEY=e15ffb... npx hardhat run scripts/verify-eth.ts --network ethMain`

```
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
stakeTokenAddress (POLS) = 0x83e6f1E41cdd28eAcEB20Cb649155049Fac3D5Aa

Compiling 1 file with 0.8.9
Successfully submitted source code for contract
contracts/PolsStake.sol:PolsStake at 0xc24A365A870821EB83Fd216c9596eDD89479d8d7
for verification on Etherscan. Waiting for verification result...

Successfully verified contract PolsStake on Etherscan.
https://etherscan.io/address/0xc24A365A870821EB83Fd216c9596eDD89479d8d7#code

```
