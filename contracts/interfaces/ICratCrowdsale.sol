// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface ICratCrowdsale{

    function buyCratTokens(address _stableCoin, uint _tokensAmount, address _fatherAddress)external;

    function pause()external;

    function changeRefundInterest(uint _newRefundInterest)external;

    function withdrawTokens(address _token, address _receiver, uint _amount)external;

    function calculateStableAmount(uint _tokensAmount)external view returns(uint _stablesAmount);

    function calculateTokensAmount(uint _stablesAmount)external view returns(uint _tokensAmount);

}