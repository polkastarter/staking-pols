// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// import "hardhat/console.sol";

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol"; // OZ contracts v4
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol"; // OZ contracts v4

contract PolsStake is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    event Stake(address indexed wallet, uint256 amount, uint48 stakeTime, uint48 unlockTime);
    event Withdraw(address indexed wallet, uint256 amount, uint48 withdrawTime);
    event Claimed(address indexed wallet, address indexed rewardToken, uint256 amount);

    event RewardTokenChanged(address indexed oldRewardToken, uint256 returnedAmount, address indexed newRewardToken);
    event LockTimePeriodChanged(uint32[] lockTimePeriod);
    event StakeRewardFactorChanged(uint256 stakeRewardFactor);
    event StakeRewardEndTimeChanged(uint48 stakeRewardEndTime);
    event RewardsBurned(address indexed staker, uint256 amount);
    event ERC20TokensRemoved(address indexed tokenAddress, address indexed receiver, uint256 amount);

    uint48 public constant MAX_TIME = type(uint48).max; // = 2^48 - 1

    struct User {
        uint48 stakeTime;
        uint48 unlockTime;
        uint160 stakeAmount;
        uint256 accumulatedRewards;
    }

    mapping(address => User) public userMap;

    uint256 public tokenTotalStaked; // sum of all staked tokens

    address public immutable stakingToken; // address of token which can be staked into this contract
    address public rewardToken; // address of reward token
    bool public lockedRewardsEnabled; // determine if users get rewards upfront for the time they have locked the staked tokens

    /**
     * Using block.timestamp instead of block.number for reward calculation
     * 1) Easier to handle for users
     * 2) Should result in same rewards across different chain with different block times
     * 3) "The current block timestamp must be strictly larger than the timestamp of the last block, ...
     *     but the only guarantee is that it will be somewhere between the timestamps ...
     *     of two consecutive blocks in the canonical chain."
     *    https://docs.soliditylang.org/en/v0.7.6/cheatsheet.html?highlight=block.timestamp#global-variables
     */

    uint32[] public lockTimePeriod = [7 days, 14 days, 30 days, 60 days, 90 days, 180 days, 365 days]; // time period tokens are locked after staking
    uint48 public stakeRewardEndTime; // unix time in seconds when the reward scheme will end
    uint256 public stakeRewardFactor; // time in seconds * amount of staked token to receive 1 reward token

    constructor(address _stakingToken) {
        require(_stakingToken != address(0), "stakingToken.address == 0");

        stakingToken = _stakingToken;

        // set some defaults
        stakeRewardFactor = 1000 * 1 days; // default : a user has to stake 1000 token for 1 day to receive 1 reward token
        stakeRewardEndTime = uint48(block.timestamp + 366 days); // default : reward scheme ends in 1 year
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * based on OpenZeppelin SafeCast v4.3
     * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v4.3/contracts/utils/math/SafeCast.sol
     */

    function toUint48(uint256 value) internal pure returns (uint48) {
        require(value <= type(uint48).max, "value doesn't fit in 48 bits");
        return uint48(value);
    }

    function toUint160(uint256 value) internal pure returns (uint160) {
        require(value <= type(uint160).max, "value doesn't fit in 160 bits");
        return uint160(value);
    }

    /**
     * External API functions - account specific
     */

    function stakeTime(address _staker) external view returns (uint48 dateTime) {
        return userMap[_staker].stakeTime;
    }

    function stakeAmount(address _staker) external view returns (uint256 balance) {
        return userMap[_staker].stakeAmount;
    }

    // redundant with stakeAmount() for compatibility
    function balanceOf(address _staker) external view returns (uint256 balance) {
        return userMap[_staker].stakeAmount;
    }

    function userAccumulatedRewards(address _staker) external view returns (uint256 rewards) {
        return userMap[_staker].accumulatedRewards;
    }

    /**
     * @dev return unix epoch time when staked tokens will be unlocked
     * @return unlockTime unix epoch time in seconds
     */
    function getUnlockTime(address _staker) public view returns (uint48 unlockTime) {
        return userMap[_staker].unlockTime;
    }

    /**
     * External API functions - contract specific
     */

    /**
     * @return balance of reward tokens held by this contract
     */
    function getRewardTokenBalance() public view returns (uint256 balance) {
        if (rewardToken == address(0)) return 0;
        balance = IERC20(rewardToken).balanceOf(address(this));
        if (stakingToken == rewardToken) {
            balance -= tokenTotalStaked;
        }
    }

    /**
     * @return array of lock times the user can choose from when staking
     */
    function getLockTimePeriodOptions() external view returns (uint32[] memory) {
        return lockTimePeriod;
    }

    // onlyOwner / DEFAULT_ADMIN_ROLE functions --------------------------------------------------

    function setLockedRewardsEnabled(bool _lockedRewardsEnabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lockedRewardsEnabled = _lockedRewardsEnabled;
    }

    /**
     * @notice setting rewardToken to address(0) disables claim/mint
     * @notice if there was a reward token set before, return remaining tokens to msg.sender/admin
     * @param newRewardToken address
     */
    function setRewardToken(address newRewardToken) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
        address oldRewardToken = rewardToken;
        uint256 rewardBalance = getRewardTokenBalance(); // balance of oldRewardToken
        if (rewardBalance > 0) {
            IERC20(oldRewardToken).safeTransfer(msg.sender, rewardBalance);
        }
        rewardToken = newRewardToken;
        emit RewardTokenChanged(oldRewardToken, rewardBalance, newRewardToken);
    }

    /**
     * @notice set lock time options the user can choose from when staking
     * @param _lockTimePeriod array of lock times the user can choose from when staking
     */
    function setLockTimePeriodOptions(uint32[] calldata _lockTimePeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lockTimePeriod = _lockTimePeriod;
        emit LockTimePeriodChanged(_lockTimePeriod);
    }

    /**
     * @notice see calculateUserClaimableReward() docs
     * @dev requires that reward token has the same decimals as stake token
     * @param _stakeRewardFactor time in seconds * amount of staked token to receive 1 reward token
     */
    function setStakeRewardFactor(uint256 _stakeRewardFactor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        stakeRewardFactor = _stakeRewardFactor;
        emit StakeRewardFactorChanged(_stakeRewardFactor);
    }

    /**
     * @notice set block time when stake reward scheme will end
     * @param _stakeRewardEndTime unix time in seconds
     */
    function setStakeRewardEndTime(uint48 _stakeRewardEndTime) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(stakeRewardEndTime > block.timestamp, "time has to be in the future");
        stakeRewardEndTime = _stakeRewardEndTime;
        emit StakeRewardEndTimeChanged(_stakeRewardEndTime);
    }

    /**
     * ADMIN_ROLE has to set BURNER_ROLE
     * allows an external (lottery token sale) contract to substract rewards
     */
    function burnRewards(address _staker, uint256 _amount) external onlyRole(BURNER_ROLE) {
        User storage user = _updateRewards(_staker);

        if (_amount < user.accumulatedRewards) {
            user.accumulatedRewards -= _amount; // safe
        } else {
            user.accumulatedRewards = 0; // burn at least all what's there
        }
        emit RewardsBurned(_staker, _amount);
    }

    /** msg.sender external view convenience functions *********************************/

    function stakeAmount_msgSender() public view returns (uint256) {
        return userMap[msg.sender].stakeAmount;
    }

    function stakeTime_msgSender() external view returns (uint48) {
        return userMap[msg.sender].stakeTime;
    }

    function getUnlockTime_msgSender() external view returns (uint48 unlockTime) {
        return getUnlockTime(msg.sender);
    }

    function userClaimableRewards_msgSender() external view returns (uint256) {
        return userClaimableRewards(msg.sender);
    }

    function userAccumulatedRewards_msgSender() external view returns (uint256) {
        return userMap[msg.sender].accumulatedRewards;
    }

    function userTotalRewards_msgSender() external view returns (uint256) {
        return userTotalRewards(msg.sender);
    }

    function getEarnedRewardTokens_msgSender() external view returns (uint256) {
        return getEarnedRewardTokens(msg.sender);
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
     * @return claimableRewards = timePeriod * stakeAmount
     */
    function _userClaimableRewards(address _staker, bool lockedRewards) internal view returns (uint256) {
        User storage user = userMap[_staker];
        uint256 user_stakeTime = user.stakeTime;
        uint256 user_unlockTime = user.unlockTime;

        // case 1) 2) 3)
        // stake time in the future - should never happen - actually an (internal ?) error
        if (block.timestamp <= user_stakeTime) return 0;

        // case 4)
        // staked after reward period is over => no rewards
        // end time < stake time < block time
        if (stakeRewardEndTime <= user_stakeTime) return 0;

        uint256 timePeriod;

        // case 5
        // we have not reached the end of the reward period
        // stake time < block time < end time
        if (block.timestamp <= stakeRewardEndTime) {
            if (lockedRewards && (block.timestamp < user_unlockTime)) {
                // locked rewards case : reward period = the whole lock time period (partially in the future)
                timePeriod = user_unlockTime - user_stakeTime;
            } else {
                // normal case : reward period = time since stakeTime
                timePeriod = block.timestamp - user_stakeTime; // safe - covered by case 1) 2) 3) 'if'
            }
        } else {
            // case 6
            // user staked before end of reward period , but that is in the past now
            // stake time < end time < block time
            timePeriod = stakeRewardEndTime - user_stakeTime; // safe - covered case 4)
        }

        return timePeriod * user.stakeAmount;
    }

    function userClaimableRewards(address _staker) public view returns (uint256) {
        return _userClaimableRewards(_staker, lockedRewardsEnabled);
    }

    function userTotalRewards(address _staker) public view returns (uint256) {
        return userClaimableRewards(_staker) + userMap[_staker].accumulatedRewards;
    }

    function getEarnedRewardTokens(address _staker) public view returns (uint256 claimableRewardTokens) {
        if (stakeRewardFactor == 0) {
            return 0;
        } else {
            return userTotalRewards(_staker) / stakeRewardFactor; // safe
        }
    }

    /**
     *  @dev whenver the staked balance changes do ...
     *
     *  @dev calculate userClaimableRewards = previous staked amount * (current time - last stake time)
     *  @dev add userClaimableRewards to userAccumulatedRewards
     *  @dev reset userClaimableRewards to 0 by setting stakeTime to current time
     *  @dev not used as doing it inline, local, within a function consumes less gas
     *
     *  @return user reference pointer for further processing
     */
    function _updateRewards(address _staker) internal returns (User storage user) {
        // calculate reward credits using previous staking amount and previous time period
        // add new reward credits to already accumulated reward credits
        user = userMap[_staker];
        user.accumulatedRewards += _userClaimableRewards(_staker, false); // do not take future, locked rewards into account !!!

        // update stake Time to current time (start new reward period)
        // will also reset userClaimableRewards()
        user.stakeTime = toUint48(block.timestamp);
    }

    /**
     * add stake token to staking pool
     * @dev requires the token to be approved for transfer
     * @dev we assume that (our) stake token is not malicious, so no special checks
     * @param _amount of token to be staked
     */
    function _stakelockTimeChoice(uint256 _amount, uint8 lockTimeIndex) internal returns (uint48) {
        require(_amount > 0, "stake amount must be > 0");

        User storage user = _updateRewards(msg.sender); // update rewards and return reference to user

        user.stakeAmount = toUint160(user.stakeAmount + _amount);
        tokenTotalStaked += _amount;

        user.unlockTime = toUint48(block.timestamp + lockTimePeriod[lockTimeIndex]);

        // using SafeERC20 for IERC20 => will revert in case of error
        IERC20(stakingToken).safeTransferFrom(msg.sender, address(this), _amount);

        emit Stake(msg.sender, _amount, toUint48(block.timestamp), user.unlockTime); // = user.stakeTime
        return user.unlockTime;
    }

    /**
     * withdraw staked token, ...
     * do not withdraw rewards token (it might not be worth the gas)
     * @return amount of tokens sent to user's account
     */
    function _withdraw(uint256 amount) internal returns (uint256) {
        require(amount > 0, "amount to withdraw not > 0");
        require(block.timestamp > getUnlockTime(msg.sender), "staked tokens are still locked");

        User storage user = _updateRewards(msg.sender); // update rewards and return reference to user

        require(amount <= user.stakeAmount, "withdraw amount > staked amount");
        user.stakeAmount -= toUint160(amount);
        tokenTotalStaked -= amount;

        // using SafeERC20 for IERC20 => will revert in case of error
        IERC20(stakingToken).safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, amount, toUint48(block.timestamp)); // = user.stakeTime
        return amount;
    }

    /**
     * claim reward tokens for accumulated reward credits
     * ... but do not unstake staked token
     */
    function _claim() internal returns (uint256) {
        require(rewardToken != address(0), "no reward token contract");
        uint256 earnedRewardTokens = getEarnedRewardTokens(msg.sender);
        require(earnedRewardTokens > 0, "no tokens to claim");

        // like _updateRewards() , but reset all rewards to 0
        User storage user = userMap[msg.sender];
        user.accumulatedRewards = 0;
        user.stakeTime = toUint48(block.timestamp); // will reset userClaimableRewards to 0
        // user.stakeAmount = unchanged

        require(earnedRewardTokens <= getRewardTokenBalance(), "not enough reward tokens"); // redundant but dedicated error message
        IERC20(rewardToken).safeTransfer(msg.sender, earnedRewardTokens);

        emit Claimed(msg.sender, rewardToken, earnedRewardTokens);
        return earnedRewardTokens;
    }

    /**
     * @notice stake token
     * @param _amount of tokens to stake
     * @param _lockTimeIndex to choose lock time
     */
    function stakelockTimeChoice(uint256 _amount, uint8 _lockTimeIndex) external nonReentrant returns (uint256) {
        return _stakelockTimeChoice(_amount, _lockTimeIndex);
    }

    function claim() external nonReentrant returns (uint256) {
        return _claim();
    }

    function withdraw(uint256 amount) external nonReentrant returns (uint256) {
        return _withdraw(amount);
    }

    function withdrawAll() external nonReentrant returns (uint256) {
        return _withdraw(stakeAmount_msgSender());
    }

    /**
     * Do not accept accidently sent ETH :
     * If neither a receive Ether nor a payable fallback function is present,
     * the contract cannot receive Ether through regular transactions and throws an exception.
     * https://docs.soliditylang.org/en/v0.8.7/contracts.html#receive-ether-function
     */

    /**
     * @notice withdraw accidently sent ERC20 tokens
     * @param _tokenAddress address of token to withdraw
     */
    function removeOtherERC20Tokens(address _tokenAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_tokenAddress != address(stakingToken), "can not withdraw staking token");
        uint256 balance = IERC20(_tokenAddress).balanceOf(address(this));
        IERC20(_tokenAddress).safeTransfer(msg.sender, balance);
        emit ERC20TokensRemoved(_tokenAddress, msg.sender, balance);
    }
}
