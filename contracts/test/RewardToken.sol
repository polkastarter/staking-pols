// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RewardToken is ERC20 {
    constructor() ERC20("POLS Lottery Reward Token", "POLSLRT") {
        // actually we do not need/want an initial supply .. just for testing here
        uint256 initialSupply = 1000 * (uint256(10)**decimals()); // decimals = 18 by default
        _mint(msg.sender, initialSupply); // mint an initial supply
    }
}
