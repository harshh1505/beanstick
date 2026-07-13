// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/INFT.sol";

contract DeployINFT is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        AgentINFT inft = new AgentINFT();
        console.log("AgentINFT deployed at:", address(inft));

        vm.stopBroadcast();
    }
}
