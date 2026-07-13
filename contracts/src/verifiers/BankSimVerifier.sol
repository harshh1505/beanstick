// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title BankSimVerifier
 * @notice [DEMO-ONLY] Accepts BANKSIM_DEMO_V1-prefixed proofs.
 *         Production deployments must use real zkTLS or webhook-evidence paths.
 */
contract BankSimVerifier {
    bytes32 public constant DEMO_PREFIX = keccak256("BANKSIM_DEMO_V1");

    event ProofVerified(uint256 amount, string currency, string railType);

    function verify(
        bytes calldata proofData,
        uint256 expectedAmount,
        string calldata currency,
        string calldata /* railType */
    ) external view returns (bool) {
        (
            bytes32 prefix,
            uint256 amount,
            string memory proofCurrency,
            uint256 timestamp
        ) = abi.decode(proofData, (bytes32, uint256, string, uint256));

        if (prefix != DEMO_PREFIX) return false;
        if (amount != expectedAmount) return false;
        if (keccak256(bytes(proofCurrency)) != keccak256(bytes(currency))) return false;
        if (block.timestamp - timestamp > 1 hours) return false;
        return true;
    }

    function generateDemoProof(
        uint256 amount,
        string calldata currency
    ) external view returns (bytes memory) {
        return abi.encode(DEMO_PREFIX, amount, currency, block.timestamp);
    }
}
