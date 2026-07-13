// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TestERC20
 * @notice Plain mintable ERC20 used as the on-chain test stablecoin for
 *         exercising Escrow.lock() / release() flows on 0G Galileo. Anyone
 *         can mint — this contract has no place on mainnet.
 */
contract TestERC20 is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
