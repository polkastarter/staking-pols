// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/utils/math/SafeCast.sol";         // OZ contracts v4
import "@openzeppelin/contracts/utils/math/SafeMath.sol"; // OZ contracts v4
import "@openzeppelin/contracts/security/ReentrancyGuard.sol"; // OZ contracts v4
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol"; // OZ contracts v4

// OpenZeppelin contracts <= v3
// import "./IERC20Metadata.sol";
// OpenZeppelin contracts >= v4
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

// import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";
import "./IERC20Mintable.sol";

contract PolsStake is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeMath for uint8;
    using SafeMath for uint256;

    using SafeERC20 for IERC20;

    event Claimed(address indexed wallet, address indexed rewardToken, uint256 amount);
    event Rewarded(address indexed rewardToken, uint256 amount, uint256 totalStaked, uint256 date);
    event Stake(address indexed wallet, uint256 amount, uint256 date);
    event Withdraw(address indexed wallet, uint256 amount, uint256 date);
    event Log(uint256 data);

    mapping(address => uint256) public stakeAmount; // TODO : uint128 in a struct
    mapping(address => uint256) public stakeTime; // TODO : uint32 .. uint64 in a struct
    mapping(address => uint256) public userAccumulatedRewards; // stake time * stake amount (accumulated time periods)

    // uint256 public tokenTotalStaked; // sum of all staked token

    address public stakingToken; // address of token which can be staked into this contract
    address public rewardToken; // address of reward token

    /**
     * Using block.timestamp instead of block.number for reward calculation
     * 1) Easier to handle for users
     * 2) Should result in same rewards across different chain with different block times
     * 3) "The current block timestamp must be strictly larger than the timestamp of the last block, ...
     *     but the only guarantee is that it will be somewhere between the timestamps ...
     *     of two consecutive blocks in the canonical chain."
     *    https://docs.soliditylang.org/en/v0.7.6/cheatsheet.html?highlight=block.timestamp#global-variables
     */

    uint256 public lockTimePeriod; // time in seconds a user has to wait after calling unlock until staked token can be withdrawn
    uint256 public stakeRewardFactor; // time in seconds * amount of staked token to receive 1 reward token
    uint256 public stakeRewardEndTime; // unix time in seconds after which no rewards will be paid out

    constructor(address _stakingToken, address _rewardToken) {
        stakingToken = _stakingToken;
        rewardToken = _rewardToken;
        lockTimePeriod = 0 days; // default : no lock period
        stakeRewardFactor = 1000 * 7 days; // default : a user has to stake 1000 token for 7 days to receive 1 reward token * decimals
        stakeRewardEndTime = block.timestamp + 365 days; // default : reward scheme ends in 1 year
    }

    // onlyOwner admin functions ------------------------------------------------------------------

    /**
     * @notice set a user has to wait after calling unlock until staked token can be withdrawn
     * @param _lockTimePeriod time in seconds
     */
    function setLockTimePeriod(uint256 _lockTimePeriod) external onlyOwner {
        lockTimePeriod = _lockTimePeriod;
    }

    /**
     * @notice set a user has to wait after calling unlock until staked token can be withdrawn
     * @notice see calculateUserClaimableReward() docs
     * @dev requires that reward token has the same decimals as stake token
     * @param _stakeRewardFactor time in seconds * amount of staked token to receive 1 reward token
     */
    function setStakeRewardFactor(uint256 _stakeRewardFactor) external onlyOwner {
        stakeRewardFactor = _stakeRewardFactor;
    }

    /**
     * @notice set block number when stake reward scheme will end
     * @param _stakeRewardEndTime unix time in seconds
     */
    function setStakeRewardEndTime(uint256 _stakeRewardEndTime) external onlyOwner {
        require(stakeRewardEndTime > block.timestamp, "time when reward scheme ends has to be in the future");
        stakeRewardEndTime = _stakeRewardEndTime;
    }

    /** msg.sender external view convenience functions *********************************/

    function stakeAmount_msgSender() external view returns (uint256) {
        return stakeAmount[msg.sender];
    }

    function stakeTime_msgSender() external view returns (uint256) {
        return stakeTime[msg.sender];
    }

    function userAccumulatedRewards_msgSender() external view returns (uint256) {
        return userAccumulatedRewards[msg.sender];
    }

    function userClaimableRewards_msgSender() external view returns (uint256) {
        return userClaimableRewards(msg.sender);
    }

    function userTotalRewards_msgSender() external view returns (uint256) {
        return userTotalRewards(msg.sender);
    }

    function userClaimableRewardToken_msgSender() public view returns (uint256) {
        return userClaimableRewardToken(msg.sender);
    }

    function userStakedTokenUnlockTime_msgSender() public view returns (uint256 unlockTime) {
        return userStakedTokenUnlockTime(msg.sender);
    }

    /** public external view functions (also used internally) **************************/

    /**
     * calculates unclaimed rewards
     * unclaimed rewards = expired time since last stake/unstake transaction * current staked amount
     *
     * We have to cover 6 cases here :
     * 1) block time < stake time < end time   : should never happen => error
     * 2) block time < end time   < stake time : should never happen => error
     * 3) end time   < block time < stake time : should never happen => error
     * 4) end time   < stake time < block time : staked after reward period is over => no rewards
     * 5) stake time < block time < end time   : end time in the future
     * 6) stake time < end time   < block time : end time in the past & staked before
     * @param _staker address
     */
    function userClaimableRewards(address _staker) public view returns (uint256) {
        // case 1) 2) 3)
        require(
            stakeTime[_staker] <= block.timestamp,
            "stake time > current block.timestamp - that should never happen"
        );

        // case 4)
        // staked after reward period is over => no rewards
        // end time < stake time < block time
        if (stakeRewardEndTime < stakeTime[_staker]) return 0;

        uint256 timePeriod;

        // case 5
        // we have not reached the end of the reward period
        // stake time < block time < end time
        if (block.timestamp <= stakeRewardEndTime) {
            timePeriod = block.timestamp - stakeTime[_staker]; // covered by assert
        } else {
            // case 6
            // user staked before end of reward period , but that is in the past now
            // stake time < end time < block time
            timePeriod = stakeRewardEndTime - stakeTime[_staker]; // covered by first if
        }

        return timePeriod.mul(stakeAmount[_staker]);
    }

    function userTotalRewards(address _staker) public view returns (uint256) {
        return userAccumulatedRewards[_staker].add(userClaimableRewards(_staker));
    }

    function userClaimableRewardToken(address _staker) public view returns (uint256) {
        uint256 decimalsFactor = 10**IERC20Metadata(rewardToken).decimals();
        return userTotalRewards(_staker).mul(decimalsFactor).div(stakeRewardFactor);
    }

    /**
     * @dev return unix epoch time when staked token will be unlocked
     * @dev return 0 if user has no token staked
     * @return unlockTime unix epoch time in seconds
     */
    function userStakedTokenUnlockTime(address _staker) public view returns (uint256 unlockTime) {
        return stakeAmount[_staker] > 0 ? stakeTime[_staker].add(lockTimePeriod) : 0;
    }

    /** user transactional functions ***************************************************/

    /**
     * TODO - FIXME - DOES NOT WORK
     * convenience function to approve staking token via this contract (address)
     * https://solidity-by-example.org/delegatecall/
     */
    function approveStakingToken(uint256 _amount) public returns (bool) {
        (bool success, ) =
            address(stakingToken).delegatecall(
                abi.encodeWithSignature("approve(address,uint256)", address(this), _amount)
            );
        return success;
    }

    /**
     *  @dev whenver the staked balance changes do for msg.sender :
     *
     *  @dev calculate userClaimableRewards = previous staked amount * (current time - last stake time)
     *  @dev add userClaimableRewards to userAccumulatedRewards
     *  @dev reset userClaimableRewards to 0 by setting stakeTime to current time
     */
    function _updateAccumulatedRewards() internal {
        // calculate reward credits using previous staking amount and previous time period
        // add new reward credits to already accumulated reward credits
        userAccumulatedRewards[msg.sender] = userAccumulatedRewards[msg.sender].add(userClaimableRewards(msg.sender));

        // update stake Time to current time (start new reward period)
        // will also reset userClaimableRewards()
        stakeTime[msg.sender] = block.timestamp;
    }

    /**
     * add stake token to staking pool
     * @dev requires the token to be approved for transfer
     */
    function _stake(uint256 _amount) internal returns (uint256) {
        require(_amount > 0, "stake amount must be > 0");

        _updateAccumulatedRewards();

        // using SafeERC20 for IERC20 => will revert in case of error
        IERC20(stakingToken).transferFrom(msg.sender, address(this), _amount);

        // update staked amount
        stakeAmount[msg.sender] = stakeAmount[msg.sender].add(_amount);
        // tokenTotalStaked = tokenTotalStaked.add(_amount);

        emit Stake(msg.sender, _amount, stakeTime[msg.sender]);
        return _amount;
    }

    /**
     * withdraw staked token, ...
     * do not claim (mint) rewards token (it might not be worth the gas)
     * @return _amount of token will be reurned to user's account
     */
    function _withdraw() internal returns (uint256) {
        require(stakeAmount[msg.sender] > 0, "no staked token to withdraw");
        require(block.timestamp > userStakedTokenUnlockTime(msg.sender), "staked token are still locked");

        _updateAccumulatedRewards();

        uint256 _amount = stakeAmount[msg.sender];
        stakeAmount[msg.sender] = 0;
        // tokenTotalStaked = tokenTotalStaked.sub(_amount);

        // using SafeERC20 for IERC20 => will revert in case of error
        IERC20(stakingToken).safeTransfer(msg.sender, _amount);

        emit Withdraw(msg.sender, _amount, block.timestamp);
        return _amount;
    }

    /**
     * claim & mint reward tokens for accumulated reward credits ...
     * but do not unstake staked token
     */
    function _claim() internal returns (uint256) {
        uint256 claimableRewardTokenAmount = userClaimableRewardToken(msg.sender);
        require(claimableRewardTokenAmount > 0, "no tokens to claim");

        // updateAccumulatedRewards => set to 0
        userAccumulatedRewards[msg.sender] = 0;
        // start a new rewards period
        stakeTime[msg.sender] = block.timestamp;

        // this contract must have MINTER_ROLE in order to be able to mint reward tokens
        IERC20Mintable(rewardToken).mint(msg.sender, claimableRewardTokenAmount);

        emit Claimed(msg.sender, rewardToken, claimableRewardTokenAmount);
        return claimableRewardTokenAmount;
    }

    function stake(uint256 _amount) external nonReentrant returns (uint256) {
        return _stake(_amount);
    }

    /**
     * @dev claim rewards token
     */
    function claim() external nonReentrant returns (uint256) {
        return _claim();
    }

    /**
     * @dev withdraw and claim dividends for a particular token that user has stake in
     */
    function withdraw() external nonReentrant returns (uint256) {
        return _withdraw();
    }
}
