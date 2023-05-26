// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract CratToken is ERC20Burnable, AccessControl {

    uint public constant PREMINT_AMOUNT = 20e24;

    bytes32 public constant CROWDSALE_ROLE = keccak256("CROWDSALE_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    constructor(address _admin) ERC20("CratD2C-Pre", "CratD2C-Pre"){
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        _setupRole(BRIDGE_ROLE, address(0));
        _mint(_admin, PREMINT_AMOUNT);
    }

    /**
     * @notice overridden ERC20 function {_beforeTokenTransfer}
     * @param from tokens owner
     * @param to tokens receiver
     * @param amount tokens amount
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount)internal view override {
        bool ownerAccess = hasRole(DEFAULT_ADMIN_ROLE, from) || hasRole(DEFAULT_ADMIN_ROLE, to);
        bool handlerAccess = hasRole(CROWDSALE_ROLE, from) || hasRole(BRIDGE_ROLE, to);
        require(ownerAccess || handlerAccess, "CratToken: invalid call");
    }
}