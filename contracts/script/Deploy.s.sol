// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/Escrow.sol";
import "../src/RailRegistry.sol";
import "../src/AgentRegistry.sol";
import "../src/verifiers/BankSimVerifier.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        bool demoMode = vm.envBool("DEMO_MODE");
        address deployer = vm.addr(deployerPk);

        vm.startBroadcast(deployerPk);

        BankSimVerifier bankSim = new BankSimVerifier();
        console.log("BankSimVerifier:", address(bankSim));

        RailRegistry rails = new RailRegistry(demoMode);
        console.log("RailRegistry  :", address(rails));
        rails.registerRail("banksim", address(bankSim), true);

        AgentRegistry agents = new AgentRegistry();
        console.log("AgentRegistry :", address(agents));

        // Use deployer as keeper for Galileo deploy; can be reassigned later
        // via setKeeper() once a dedicated keeper wallet is provisioned.
        Escrow escrow = new Escrow(address(bankSim), deployer);
        console.log("Escrow        :", address(escrow));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("Network   : 0G Galileo (chain 16602)");
        console.log("Deployer  :", deployer);
        console.log("Demo Mode :", demoMode);
    }
}
