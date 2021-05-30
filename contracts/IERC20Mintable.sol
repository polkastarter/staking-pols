// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;

// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20Mintable {
    // is IERC20 {

    function mint(address to, uint256 amount) external;

    // mint will emit Transfer event which is already defined in IERC20
    // event Transfer(address indexed from, address indexed to, uint256 value);
}
