// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentRegistry
 * @notice Maps EVM wallet addresses to AXL public-key hashes and roles.
 *         AXL pubkeys are 64-char hex; we store keccak256 of their bytes.
 */
contract AgentRegistry is Ownable {
    enum AgentRole { NONE, BUYER, LP, KEEPER }

    struct Agent {
        address wallet;
        bytes32 axlPubkey;
        AgentRole role;
        uint256 registeredAt;
        bool active;
    }

    mapping(address => Agent) public agents;
    mapping(bytes32 => address) public axlToWallet;
    address[] public agentList;

    event AgentRegistered(address indexed wallet, bytes32 axlPubkey, AgentRole role);
    event AgentDeactivated(address indexed wallet);
    event RoleUpdated(address indexed wallet, AgentRole newRole);

    error AgentExists();
    error AgentNotFound();
    error AXLKeyInUse();

    constructor() Ownable(msg.sender) {}

    function register(bytes32 axlPubkey, AgentRole role) external {
        if (agents[msg.sender].wallet != address(0)) revert AgentExists();
        if (axlToWallet[axlPubkey] != address(0)) revert AXLKeyInUse();

        agents[msg.sender] = Agent({
            wallet: msg.sender,
            axlPubkey: axlPubkey,
            role: role,
            registeredAt: block.timestamp,
            active: true
        });
        axlToWallet[axlPubkey] = msg.sender;
        agentList.push(msg.sender);
        emit AgentRegistered(msg.sender, axlPubkey, role);
    }

    function deactivate() external {
        if (agents[msg.sender].wallet == address(0)) revert AgentNotFound();
        agents[msg.sender].active = false;
        emit AgentDeactivated(msg.sender);
    }

    function updateRole(address wallet, AgentRole role) external onlyOwner {
        if (agents[wallet].wallet == address(0)) revert AgentNotFound();
        agents[wallet].role = role;
        emit RoleUpdated(wallet, role);
    }

    function getWalletByAXL(bytes32 axlPubkey) external view returns (address) {
        return axlToWallet[axlPubkey];
    }

    function getAgentsByRole(AgentRole role) external view returns (Agent[] memory) {
        uint256 count;
        for (uint256 i = 0; i < agentList.length; i++) {
            if (agents[agentList[i]].role == role && agents[agentList[i]].active) count++;
        }
        Agent[] memory result = new Agent[](count);
        uint256 j;
        for (uint256 i = 0; i < agentList.length; i++) {
            if (agents[agentList[i]].role == role && agents[agentList[i]].active) {
                result[j++] = agents[agentList[i]];
            }
        }
        return result;
    }
}
