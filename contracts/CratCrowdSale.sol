// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/ICratCrowdsale.sol";

contract CratCrowdsale is ICratCrowdsale, Ownable, ReentrancyGuard, Pausable { 
    using SafeERC20 for IERC20;

    uint public constant ACCURACY = 1e18;
    uint public constant DENOMINATOR = 100000;
    uint public constant PRICE_DECIMALS = 1e16;
    uint public constant MAX_REFUND_INTEREST = 10000;

    uint public totalFundsRaised;
    uint public currentTokenPrice = 20e16;
    uint public referralRefundInterest = 1000;
    
    address public immutable cratToken;
    address public immutable usdtAddress;
    address public immutable usdcAddress;
    
    uint[7] public tierRates = [0, 200, 300, 500, 1000, 1500, 2500];
    uint[7] public tierAmounts = [0, 500, 1000, 2000, 5000, 10000, 20000];
    uint[10] public tierPrices = [20, 22, 23, 24, 25, 26, 27, 28, 29, 30];

    mapping(address => UserInfo) public userInfo;

    struct UserInfo{
        uint totalSpend;
        uint tier;
        uint bonusTokensReceived;
        uint referralReceived;
        address referralFather;
    }

    event RefundInterestChanged(uint256 newRefundInterest);
    event TokensWithdrawn(address token, uint256 amount);
    event PriceUpdate(uint newPrice, uint time);
    event Purchase(
        address indexed user, 
        address indexed stablecoin, 
        uint stablesAmount, 
        uint tokensAmount, 
        uint referralRefund, 
        uint time
    );
    event ReferralAdded(address user, address fatherAddress);
    
    constructor(
        address _admin,
        address _cratToken, 
        address _usdt, 
        address _usdc
    )
    {
        require(_admin != address(0) && _cratToken != address(0)
            && _usdt != address(0) && _usdc != address(0), "CratCrowdsale: zero address");
        transferOwnership(_admin);
        cratToken = _cratToken;
        usdtAddress = _usdt;
        usdcAddress = _usdc;
    }

    /**
     * @notice function to calculate referral amount
     * @param user user address to buy token
     * @param fatherAddress address which will be specified in buyCratTokens function as fatherAddress
     * @param stablesAmount stablecoin amount which will be specified in buyCratTokens function as stablesAmount
     * @return refundAmount referral refund amount to be expected
     */
    function calculateReferralRefundAmount(address user, address fatherAddress, uint256 stablesAmount) external view returns(uint256 refundAmount) {
        if (userInfo[user].referralFather != address(0) || (fatherAddress != address(0) && user != fatherAddress)) {
            refundAmount = stablesAmount * referralRefundInterest / MAX_REFUND_INTEREST;
        }
    }

    /**
     * @notice function to buy {cratToken}
     * @notice only not paused available
     * @param stableCoin stablecoin smart contract address to pay
     * @param stablesAmount stablecoin amount to pay
     * @param fatherAddress referral father address
     */
    function buyCratTokens(
        address stableCoin, 
        uint stablesAmount, 
        address fatherAddress,
        uint minRefundAmount
    )
        external 
        whenNotPaused() 
        nonReentrant()
    {
        address _user = msg.sender;
        require(stableCoin == usdtAddress || stableCoin == usdcAddress, "CratCrowdsale: invalid stablecoin");
        _verifyAmount(stablesAmount);
        uint _tokensAmount = calculateTokensAmount(stablesAmount);
        uint _refundAmount = _referralRefund(_user, fatherAddress, stableCoin, stablesAmount);
        require(_refundAmount >= minRefundAmount, "CratCrowdsale: minRefundAmount not met");
        uint _bonusStables = _updateTier(_user, stablesAmount);
        uint _bonusTokens = calculateTokensAmount(_bonusStables);
        userInfo[_user].bonusTokensReceived += _bonusTokens;
        _updatePrice(stablesAmount);
        IERC20(cratToken).safeTransfer(_user, _tokensAmount + _bonusTokens);
        IERC20(stableCoin).safeTransferFrom(_user, address(this), stablesAmount - _refundAmount);

        emit Purchase(_user, stableCoin, stablesAmount, _tokensAmount + _bonusTokens, _refundAmount, block.timestamp);
    }

    /**
     * @notice function to pause the crowdsale
     * @notice only {_owner} available
     */
    function pause()external onlyOwner(){
        super._pause();
    }

    /**
     * @notice function to unpause the crowdsale
     * @notice only {_owner} available
     */
    function unpause()external onlyOwner(){
        super._unpause();
    }

    /**
     * @notice function to change {referralRefundInterest}
     * @notice available only when paused
     * @notice only {_owner} available
     * @param newRefundInterest new {referralRefundInterest} value
     */
    function changeRefundInterest(uint newRefundInterest)external whenPaused() onlyOwner(){
        require(MAX_REFUND_INTEREST >= newRefundInterest, "CratCrowdsale: invalid new refund interest value");
        referralRefundInterest = newRefundInterest;
        emit RefundInterestChanged(newRefundInterest);
    } 

    /**
     * @notice function to withdraw any ERC20 tokens 
     * @notice only {_owner} available
     * @param token token smart contract address to withdraw
     * @param receiver address to receive tokens
     * @param amount tokens amount to withdraw
     */
    function withdrawTokens(
        address token, 
        address receiver, 
        uint amount
    )
        external 
        nonReentrant() 
        onlyOwner()
    {
        _verifyAmount(amount);
        IERC20(token).safeTransfer(receiver, amount);
        emit TokensWithdrawn(token, amount);
    } 

    /**
     * @notice view function to get stablecoins amount for buying certain {cratToken} amount
     * @param tokensAmount {cratToken} amount to buy
     * @return stablesAmount stablecoins amount to pay for {cratToken} {tokensAmount}
     */
    function calculateStableAmount(uint tokensAmount)public view returns(uint stablesAmount){
        stablesAmount = tokensAmount * currentTokenPrice / ACCURACY;
    } 

    /**
     * @notice view function to get {cratToken} amount for pay certain stablecoins amount
     * @param stablesAmount stablecoins amount to pay
     * @return tokensAmount {cratToken} amount to recieve for stablecoin {stablesAmount}
     */
    function calculateTokensAmount(uint stablesAmount)public view returns(uint tokensAmount){
        tokensAmount = stablesAmount * ACCURACY / currentTokenPrice;
    }

    function _updateTier(address _user, uint _stablesAmount)internal returns(uint _bonusStables){
        uint _newSpendAmount = _stablesAmount + userInfo[_user].totalSpend;
        userInfo[_user].totalSpend = _newSpendAmount;
        if(userInfo[_user].tier == 6){
            return 0;
        }
        uint _newTier;
        uint _oldTier = userInfo[_user].tier;
        for(uint i = _oldTier; 6 >= i; i++){
            if(_newSpendAmount >= tierAmounts[i] * ACCURACY){
                _newTier = i;
            } else {
                break;
            }
        }
        if(_newTier > _oldTier){
            _bonusStables = (tierAmounts[_newTier] - tierAmounts[_oldTier]) * ACCURACY;
            _bonusStables = _bonusStables * tierRates[_newTier] / MAX_REFUND_INTEREST;
            userInfo[_user].tier = _newTier;
        }
    }

    function _referralRefund(
        address _user, 
        address _fatherAddress, 
        address _stableCoin, 
        uint _stablesAmount
    )
        internal 
        returns(uint _refundAmount)
    {
        if(
            userInfo[_user].referralFather == address(0) && 
            _fatherAddress != address(0) && 
            _user != _fatherAddress
        )
        {
            userInfo[_user].referralFather = _fatherAddress;
            emit ReferralAdded(_user, _fatherAddress);
        } 
        address _referralFather = userInfo[_user].referralFather;
        if(_referralFather != address(0)){
            _refundAmount = _stablesAmount * referralRefundInterest / MAX_REFUND_INTEREST;
            IERC20(_stableCoin).safeTransferFrom(_user, _referralFather, _refundAmount);
            userInfo[_referralFather].referralReceived += _refundAmount;
        }
    }

    function _updatePrice(uint _stablesAmount)internal {
        uint _newTotalFundsRaised = _stablesAmount + totalFundsRaised;
        uint _priceTier = _newTotalFundsRaised / DENOMINATOR / ACCURACY;
        uint _oldPrice = currentTokenPrice;
        _priceTier = _priceTier > 9 ? 9 : _priceTier;
        currentTokenPrice = tierPrices[_priceTier] * PRICE_DECIMALS;
        totalFundsRaised = _newTotalFundsRaised;
        if(_oldPrice != tierPrices[_priceTier] * PRICE_DECIMALS){
            emit PriceUpdate(currentTokenPrice, block.timestamp);
        }
    }

    function _verifyAmount(uint _amount)internal pure {
        require(_amount > 0, "CratCrowdsale: invalid amount");
    }
}