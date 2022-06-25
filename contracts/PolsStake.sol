// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;

import "hardhat/console.sol"; // DEBUG ONLY
import "@openzeppelin/contracts/utils/Strings.sol"; // DEBUG ONLY

import "@openzeppelin/contracts/access/AccessControl.sol"; // OZ contracts v4
import "@openzeppelin/contracts/security/ReentrancyGuard.sol"; // OZ contracts v4
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol"; // OZ contracts v4

contract PolsStake is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Strings for uint256; // DEBUG ONLY

    // bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    event Stake(address indexed wallet, uint256 amount, uint48 stakeTime, uint48 unlockTime);
    event Withdraw(address indexed wallet, uint256 amount, uint48 withdrawTime);
    event Claimed(address indexed wallet, address indexed rewardToken, uint256 amount);

    event RewardTokenChanged(address indexed oldRewardToken, uint256 returnedAmount, address indexed newRewardToken);
    event LockedRewardsEnabledChanged(bool lockedRewardsEnabled);
    event UnlockedRewardsFactorChanged(uint256 unlockedRewardsFactor);
    event LockTimePeriodOptionsChanged(uint32[] lockTimePeriod, uint32[] lockTimePeriodRewardFactor);
    event LockTimePeriodRewardFactorsChanged(uint32[] lockTimePeriodRewardFactor);
    event StakeRewardFactorChanged(uint256 stakeRewardFactor);
    event StakeRewardEndTimeChanged(uint48 stakeRewardEndTime);
    event RewardsBurned(address indexed staker, uint256 amount);
    event ERC20TokensRemoved(address indexed tokenAddress, address indexed receiver, uint256 amount);

    uint48 public constant MAX_TIME = type(uint48).max; // = 2^48 - 1
    uint32 public constant REWARDS_DIV = 1_000_000;

    struct User {
        uint48 stakeTime;
        uint48 unlockTime;
        uint32 stakePeriodRewardFactor;
        uint128 stakeAmount;
        uint256 accumulatedRewards;
    }

    mapping(address => User) public userMap;

    uint256 public tokenTotalStaked; // sum of all staked tokens

    address public immutable stakingToken; // address of token which can be staked into this contract
    address public rewardToken; // address of reward token
    bool public lockedRewardsEnabled; // determine if users get rewards upfront for the time they have locked the staked tokens
    uint256 public unlockedRewardsFactor; // rewards multiplier outside locked period (default v1=1 , v2=0) * REWARDS_DIV

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
    uint32[] public lockTimePeriodRewardFactor = [
        REWARDS_DIV,
        REWARDS_DIV,
        REWARDS_DIV,
        REWARDS_DIV,
        REWARDS_DIV,
        REWARDS_DIV,
        REWARDS_DIV
    ];
    uint48 public stakeRewardEndTime; // unix time in seconds when the reward scheme will end
    uint256 public stakeRewardFactor; // time in seconds * amount of staked token to receive 1 reward token

    constructor(address _stakingToken) {
        require(_stakingToken != address(0), "stakingToken.address == 0");

        stakingToken = _stakingToken;

        // set some defaults
        lockedRewardsEnabled = false;
        unlockedRewardsFactor = 1 * REWARDS_DIV; // by default (amount * time * 1.0) rewards for staked, but unlocked tokens (like v1)
        stakeRewardFactor = 1000 * 1 days; // default : a user has to stake 1000 token for 1 day to receive 1 reward token
        stakeRewardEndTime = uint48(block.timestamp + 366 days); // default : reward scheme ends in 1 year
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * PolsStake v1 backwards compatibility functions (to be removed later)
     * mostly used to run v1 test (almost) unchanged on v2
     */
    function stake(uint256 _amount) external nonReentrant returns (uint256) {
        return _stakelockTimeChoice(_amount, 0); // use default index 0 which should be 7 days
    }

    function getLockTimePeriod() external view returns (uint32) {
        return lockTimePeriod[0];
    }

    function setLockTimePeriodDefault(uint32 _defaultLockTime) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lockTimePeriod[0] = _defaultLockTime;
    }

    /**
     * based on OpenZeppelin SafeCast v4.3
     * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v4.3/contracts/utils/math/SafeCast.sol
     */

    function toUint48(uint256 value) internal pure returns (uint48) {
        require(value <= type(uint48).max, "value does not fit in 48 bits");
        return uint48(value);
    }

    function toUint128(uint256 value) internal pure returns (uint128) {
        require(value <= type(uint128).max, "value does not fit in 160 bits");
        return uint128(value);
    }

    /**
     * @dev Returns the largest of two numbers.
     */
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }

    /**
     * @dev Returns the smallest of two numbers.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /**
     * External API functions - account related
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
     * DEBUG ONLY - Helper functions
     * requires solc >=0.8.12
     * https://docs.soliditylang.org/en/v0.8.12/types.html#the-functions-bytes-concat-and-string-concat
     */
    function console_log_time(string memory message, uint256 t) internal view {
        uint256 t_seconds = t % 60;
        t = t / 60;
        uint256 t_minutes = t % 60;
        t = t / 60;
        uint256 t_hours = t % 24;
        t = t / 24;
        uint256 t_days = t;
        string memory timeString = string.concat(t_days.toString(), " ");
        if (t_hours < 10) {
            timeString = string.concat(timeString, "0");
        }
        timeString = string.concat(timeString, t_hours.toString());
        timeString = string.concat(timeString, ":");
        if (t_minutes < 10) {
            timeString = string.concat(timeString, "0");
        }
        timeString = string.concat(timeString, t_minutes.toString());
        timeString = string.concat(timeString, ":");
        if (t_seconds < 10) {
            timeString = string.concat(timeString, "0");
        }
        timeString = string.concat(timeString, t_seconds.toString());
        console.log(message, timeString);
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

    function getLockTimePeriodRewardFactors() external view returns (uint32[] memory) {
        return lockTimePeriodRewardFactor;
    }

    // onlyOwner / DEFAULT_ADMIN_ROLE functions --------------------------------------------------

    function setLockedRewardsEnabled(bool _lockedRewardsEnabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lockedRewardsEnabled = _lockedRewardsEnabled;
        emit LockedRewardsEnabledChanged(_lockedRewardsEnabled);
    }

    function setUnlockedRewardsFactor(uint256 _unlockedRewardsFactor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        unlockedRewardsFactor = _unlockedRewardsFactor;
        emit UnlockedRewardsFactorChanged(_unlockedRewardsFactor);
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
     * @param _lockTimePeriodRewardFactor array of factors reward factors for each option
     */
    function setLockTimePeriodOptions(uint32[] calldata _lockTimePeriod, uint32[] calldata _lockTimePeriodRewardFactor)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (_lockTimePeriodRewardFactor.length == 0) {
            delete lockTimePeriodRewardFactor;
            for (uint256 i = 0; i < _lockTimePeriod.length; i++) {
                lockTimePeriodRewardFactor.push(REWARDS_DIV);
            }
        } else {
            lockTimePeriodRewardFactor = _lockTimePeriodRewardFactor;
        }
        require(_lockTimePeriod.length == lockTimePeriodRewardFactor.length, "arrays have different lengths");
        lockTimePeriod = _lockTimePeriod;
        emit LockTimePeriodOptionsChanged(lockTimePeriod, lockTimePeriodRewardFactor);
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

    function _userClaimableRewards(address _staker, bool lockedRewards) public view returns (uint256) {
        User storage user = userMap[_staker];
        return
            _userClaimableRewardsCalculation(
                user.stakeAmount,
                user.stakeTime,
                user.unlockTime,
                block.timestamp,
                stakeRewardEndTime,
                lockedRewards
            );
    }

    /**
     * calculate current rewards
     *
     * We have to cover 6 cases here :
     * 1) block time < stake time < end time   : should never happen => error
     * 2) block time < end time   < stake time : should never happen => error
     * 3) end time   < block time < stake time : should never happen => error
     * 4) end time   < stake time < block time : staked after reward period is over => no rewards
     * 5) stake time < block time < end time   : end time in the future
     * 6) stake time < end time   < block time : end time in the past & staked before
     * @param user_stakeAmount  amount of staked tokens
     * @param user_stakeTime    time the user has staked
     * @param user_unlockTime   time when user's staked tokens will be unlocked
     * @param block_timestamp   current block time
     * @param endTime           time when the rewards scheme will end
     * @param lockedRewards     if true user will get full rewards for lock time upfront
     * @return claimableRewards rewards user has received / can claim at this block time
     */
    function _userClaimableRewardsCalculation(
        uint256 user_stakeAmount,
        uint256 user_stakeTime,
        uint256 user_unlockTime,
        uint256 block_timestamp,
        uint256 endTime,
        bool lockedRewards
    ) public view returns (uint256) {
        if (user_stakeAmount == 0) return 0; // shortcut if user hasn't even staked anything

        // case 1) 2) 3)
        // stake time in the future - should never happen - actually an (internal ?) error
        require(user_stakeTime <= block_timestamp, "INTERNAL ERROR : current blocktime before staketime");

        // unlockTime before staketime - should never happen - actually an (internal ?) error
        // CORRECTION : is possible if partial withdraw after unlock time
        // console_log_time("user_stakeTime  (dd hh mm ss) =", user_stakeTime);
        // console_log_time("user_unlockTime (dd hh mm ss) =", user_unlockTime);
        // require(user_stakeTime <= user_unlockTime, "INTERNAL ERROR : unlockTime before staketime");

        // case 4)
        // staked after reward period is over => no rewards
        // end time < stake time < block time
        if (endTime <= user_stakeTime) return 0;

        uint256 timePeriod;
        uint256 rewards;

        // conditions which are true at this point
        // - user_stakeTime <= block_timestamp
        // - user_stakeTime <  endTime

        if (lockedRewards) {
            timePeriod = min(user_unlockTime, endTime) - user_stakeTime; // safe - see conditions above
            rewards = timePeriod * user_stakeAmount;

            // check for extra rewards outside lock period
            if ((block_timestamp > user_unlockTime) && (endTime > user_unlockTime)) {
                timePeriod = min(block_timestamp, endTime) - user_unlockTime; // <<<<<<<<<<<<<<<<<<<<<<<
                rewards += (timePeriod * user_stakeAmount * unlockedRewardsFactor) / REWARDS_DIV;
            }
        } else {
            timePeriod = min(block_timestamp, endTime) - user_stakeTime; // safe - see conditions above
            rewards = (timePeriod * user_stakeAmount * unlockedRewardsFactor) / REWARDS_DIV;
        }

        return rewards;
    }

    function userClaimableRewards(address _staker) public view returns (uint256) {
        return _userClaimableRewards(_staker, lockedRewardsEnabled);
    }

    function userTotalRewards(address _staker) public view returns (uint256) {
        return userClaimableRewards(_staker) + userMap[_staker].accumulatedRewards;
    }

    function getEarnedRewardTokens(address _staker) public view returns (uint256 claimableRewardTokens) {
        if (address(rewardToken) == address(0) || stakeRewardFactor == 0) {
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

        user.stakeAmount = toUint128(user.stakeAmount + _amount);
        tokenTotalStaked += _amount;

        uint48 newUserUnlockTime = toUint48(block.timestamp + lockTimePeriod[lockTimeIndex]);
        require(newUserUnlockTime >= user.unlockTime, "new unlockTime not after current");
        user.unlockTime = newUserUnlockTime;

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
        require(amount > 0, "staked amount is 0");
        require(block.timestamp > getUnlockTime(msg.sender), "staked tokens are still locked");

        User storage user = _updateRewards(msg.sender); // update rewards and return reference to user

        require(amount <= user.stakeAmount, "withdraw amount > staked amount");
        user.stakeAmount -= toUint128(amount);
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
