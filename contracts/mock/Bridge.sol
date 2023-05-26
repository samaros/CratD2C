// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Bridge { 
    using SafeERC20 for IERC20;

    address public immutable cratToken;

    constructor(address _cratToken){
        cratToken = _cratToken;
    }

    function swap(uint _amount)external {
        IERC20(cratToken).safeTransferFrom(msg.sender, address(this), _amount);
    }   
}