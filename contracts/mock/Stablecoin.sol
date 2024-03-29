// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract Stablecoin is ERC20Burnable {
    
    constructor(address _to, uint _amount) ERC20("Stablecoin", "Stablecoin") {
        _mint(_to, _amount);
    }

} 