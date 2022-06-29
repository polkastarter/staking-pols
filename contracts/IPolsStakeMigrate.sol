// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPolsStakeMigrate {
    function balanceOf(address _staker) external view returns (uint256);

    function userAccumulatedRewards(address _staker) external view returns (uint256);

    function burnRewards(address _staker, uint256 _amount) external;

    // function userTotalRewards(address _staker) external view returns (uint256);
}
