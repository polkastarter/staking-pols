// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v3.4-solc-0.7/contracts/presets/ERC20PresetMinterPauser.sol";

contract POLSLRT is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("POLS Lottery Ticket Claim", "POLSL") {
        uint256 initialSupply = 10000 * (uint256(10)**decimals());
        _mint(msg.sender, initialSupply); // mint an initial supply
    }
}
