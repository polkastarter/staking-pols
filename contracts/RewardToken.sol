// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract RewardToken is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("POLS Lottery Reward Token", "POLSLRT") {
        // actually we do not need/want an initial supply .. just for testing here
        uint256 initialSupply = 1000 * (uint256(10)**decimals()); // decimals = 18 by default
        _mint(msg.sender, initialSupply); // mint an initial supply
    }
}
