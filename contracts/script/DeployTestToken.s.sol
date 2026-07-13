// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/TestERC20.sol";

contract DeployTestToken is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);
        TestERC20 t = new TestERC20("Beanstick Test USD", "bUSD");
        t.mint(deployer, 1_000_000 * 1e18);
        console.log("TestERC20:", address(t));
        console.log("Minted 1,000,000 bUSD to", deployer);
        vm.stopBroadcast();
    }
}
