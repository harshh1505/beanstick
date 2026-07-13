// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RailRegistry
 * @notice Registry of supported fiat rails and their verifiers.
 *         Demo-only rails (e.g. BankSim) are gated by the `demoMode` flag so
 *         they cannot be used on a mainnet deployment.
 */
contract RailRegistry is Ownable {
    struct Rail {
        string railType;
        address verifier;
        bool enabled;
        bool isDemoOnly;
    }

    mapping(string => Rail) public rails;
    string[] public railTypes;

    bool public demoMode;

    event RailRegistered(string railType, address verifier, bool isDemoOnly);
    event RailDisabled(string railType);
    event DemoModeChanged(bool enabled);

    error RailNotFound(string railType);
    error RailDisabled_();
    error DemoRailOnMainnet(string railType);

    constructor(bool _demoMode) Ownable(msg.sender) {
        demoMode = _demoMode;
    }

    function registerRail(
        string calldata railType,
        address verifier,
        bool isDemoOnly
    ) external onlyOwner {
        if (rails[railType].verifier == address(0)) {
            railTypes.push(railType);
        }
        rails[railType] = Rail({
            railType: railType,
            verifier: verifier,
            enabled: true,
            isDemoOnly: isDemoOnly
        });
        emit RailRegistered(railType, verifier, isDemoOnly);
    }

    function disableRail(string calldata railType) external onlyOwner {
        if (rails[railType].verifier == address(0)) revert RailNotFound(railType);
        rails[railType].enabled = false;
        emit RailDisabled(railType);
    }

    function getVerifier(string calldata railType) external view returns (address) {
        Rail memory rail = rails[railType];
        if (rail.verifier == address(0)) revert RailNotFound(railType);
        if (!rail.enabled) revert RailDisabled_();
        if (rail.isDemoOnly && !demoMode) revert DemoRailOnMainnet(railType);
        return rail.verifier;
    }

    function setDemoMode(bool _demoMode) external onlyOwner {
        demoMode = _demoMode;
        emit DemoModeChanged(_demoMode);
    }

    function getAllRails() external view returns (Rail[] memory) {
        Rail[] memory all = new Rail[](railTypes.length);
        for (uint256 i = 0; i < railTypes.length; i++) {
            all[i] = rails[railTypes[i]];
        }
        return all;
    }
}
