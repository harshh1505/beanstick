// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IVerifier {
    function verify(
        bytes calldata proofData,
        uint256 expectedAmount,
        string calldata currency,
        string calldata railType
    ) external view returns (bool);
}

interface IVerifierV2 {
    function verify(
        bytes calldata proofData,
        uint256 expectedAmount,
        string calldata currency,
        string calldata railType,
        bytes32 receiverCommitment,
        bytes32 referenceHash,
        string calldata attestationMode
    ) external view returns (bool);
}

/**
 * @title Escrow
 * @notice Manages fiat-to-crypto swap escrows. Two release paths:
 *         (a) zkTLS-style proof verified by `verifier` (legacy / future),
 *         (b) keeper-driven release(orderId, evidenceHash) where evidenceHash
 *             is a 0G Storage root hash pinned by the KeeperHub webhook
 *             receiver after HMAC-verifying the PSP webhook (Section 7).
 *         Both paths converge on `OrderState.RELEASED` and pay tokens to buyer.
 */
contract Escrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    enum OrderState {
        INIT,
        LOCKED,
        PAID,
        RELEASED,
        EXPIRED,
        DISPUTED,
        RESOLVED_BUYER,
        RESOLVED_LP
    }

    struct Order {
        uint256 id;
        address buyer;
        address lp;
        address token;
        uint256 tokenAmount;
        uint256 fiatAmount;
        string fiatCurrency;
        string railType;
        uint256 buyerBond;
        uint256 lpBond;
        uint256 deadline;
        OrderState state;
        bytes32 proofHash;           // 0G Storage root (zkTLS path)
        bytes32 evidenceHash;        // 0G Storage root (webhook path)
        // G.14 additions for trust-minimized fiat edge architecture
        bytes32 receiverCommitment;  // LP's committed payment receiver hash
        bytes32 referenceHash;       // Payment reference for matching
        uint256 challengeWindow;     // Seconds before final release (per rail)
        string attestationMode;      // "banksim", "webhook", "zktls", "multi-attestor"
    }

    mapping(uint256 => Order) public orders;
    /// orderId hash (keccak256) -> on-chain numeric id (for webhook releases that
    /// reference the off-chain orderId string instead of the numeric id).
    mapping(bytes32 => uint256) public orderIdByHash;
    uint256 public nextOrderId = 1;
    uint256[] public lockedOrderIds;

    uint256 public constant BOND_PERCENT = 100;       // 1%
    uint256 public constant MIN_DEADLINE = 5 minutes;
    uint256 public constant MAX_DEADLINE = 1 hours;
    uint256 public constant DISPUTE_WINDOW = 15 minutes;

    address public verifier;
    address public keeper;

    event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed lp);
    event OrderLocked(uint256 indexed orderId, uint256 tokenAmount, uint256 deadline);
    event OrderPaid(uint256 indexed orderId, bytes32 proofHash);
    event OrderReleased(uint256 indexed orderId, address indexed buyer, uint256 tokenAmount);
    /// Emitted by the webhook-driven release(bytes32,bytes32) path.
    event Released(bytes32 indexed orderIdHash, bytes32 evidenceHash);
    event OrderExpired(uint256 indexed orderId, address slashed);
    event OrderDisputed(uint256 indexed orderId, address disputant);
    event OrderResolved(uint256 indexed orderId, OrderState resolution);
    // G.14 events for trust-minimized fiat edge architecture
    event ReceiverCommitted(uint256 indexed orderId, bytes32 receiverCommitment);
    event PaymentObserved(uint256 indexed orderId, string rail, uint256 amount);
    event EvidenceSubmitted(uint256 indexed orderId, bytes32 evidenceHash, string attestationMode);
    event ReleaseChallenged(uint256 indexed orderId, bytes32 challenge);
    event ReleaseFinalized(uint256 indexed orderId);

    error InvalidState(OrderState expected, OrderState actual);
    error Unauthorized();
    error InvalidDeadline();
    error InsufficientBond();
    error DeadlineNotReached();
    error DeadlinePassed();
    error ProofVerificationFailed();
    error UnknownOrder();

    constructor(address _verifier, address _keeper) Ownable(msg.sender) {
        verifier = _verifier;
        keeper = _keeper;
    }

    // ============================================
    // Core lifecycle
    // ============================================

    function lock(
        address buyer,
        address token,
        uint256 tokenAmount,
        uint256 fiatAmount,
        string calldata fiatCurrency,
        string calldata railType,
        uint256 deadlineSeconds,
        string calldata orderRefId
    ) external payable nonReentrant returns (uint256 orderId) {
        if (deadlineSeconds < MIN_DEADLINE || deadlineSeconds > MAX_DEADLINE) {
            revert InvalidDeadline();
        }

        uint256 lpBond = (tokenAmount * BOND_PERCENT) / 10000;
        if (msg.value < lpBond) revert InsufficientBond();

        orderId = nextOrderId++;
        orders[orderId] = Order({
            id: orderId,
            buyer: buyer,
            lp: msg.sender,
            token: token,
            tokenAmount: tokenAmount,
            fiatAmount: fiatAmount,
            fiatCurrency: fiatCurrency,
            railType: railType,
            buyerBond: 0,
            lpBond: lpBond,
            deadline: block.timestamp + deadlineSeconds,
            state: OrderState.LOCKED,
            proofHash: bytes32(0),
            evidenceHash: bytes32(0),
            receiverCommitment: bytes32(0),
            referenceHash: bytes32(0),
            challengeWindow: 0,
            attestationMode: ""
        });

        if (bytes(orderRefId).length > 0) {
            orderIdByHash[keccak256(bytes(orderRefId))] = orderId;
        }
        lockedOrderIds.push(orderId);

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);

        emit OrderCreated(orderId, buyer, msg.sender);
        emit OrderLocked(orderId, tokenAmount, orders[orderId].deadline);
    }

    /**
     * @notice Lock with G.14 commitments (trust-minimized fiat edge architecture)
     */
    function lockWithCommitments(
        address buyer,
        address token,
        uint256 tokenAmount,
        uint256 fiatAmount,
        string calldata fiatCurrency,
        string calldata railType,
        uint256 deadlineSeconds,
        string calldata orderRefId,
        bytes32 receiverCommitment,
        bytes32 referenceHash,
        uint256 challengeWindow,
        string calldata attestationMode
    ) external payable nonReentrant returns (uint256 orderId) {
        if (deadlineSeconds < MIN_DEADLINE || deadlineSeconds > MAX_DEADLINE) {
            revert InvalidDeadline();
        }

        uint256 lpBond = (tokenAmount * BOND_PERCENT) / 10000;
        if (msg.value < lpBond) revert InsufficientBond();

        orderId = nextOrderId++;
        orders[orderId] = Order({
            id: orderId,
            buyer: buyer,
            lp: msg.sender,
            token: token,
            tokenAmount: tokenAmount,
            fiatAmount: fiatAmount,
            fiatCurrency: fiatCurrency,
            railType: railType,
            buyerBond: 0,
            lpBond: lpBond,
            deadline: block.timestamp + deadlineSeconds,
            state: OrderState.LOCKED,
            proofHash: bytes32(0),
            evidenceHash: bytes32(0),
            receiverCommitment: receiverCommitment,
            referenceHash: referenceHash,
            challengeWindow: challengeWindow,
            attestationMode: attestationMode
        });

        if (bytes(orderRefId).length > 0) {
            orderIdByHash[keccak256(bytes(orderRefId))] = orderId;
        }
        lockedOrderIds.push(orderId);

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);

        emit OrderCreated(orderId, buyer, msg.sender);
        emit OrderLocked(orderId, tokenAmount, orders[orderId].deadline);
        emit ReceiverCommitted(orderId, receiverCommitment);
    }

    function commit(uint256 orderId) external payable nonReentrant {
        Order storage order = orders[orderId];
        if (order.state != OrderState.LOCKED) revert InvalidState(OrderState.LOCKED, order.state);
        if (msg.sender != order.buyer) revert Unauthorized();

        uint256 requiredBond = (order.tokenAmount * BOND_PERCENT) / 10000;
        if (msg.value < requiredBond) revert InsufficientBond();

        order.buyerBond = msg.value;
    }

    function submitProof(
        uint256 orderId,
        bytes32 proofHash,
        bytes calldata proofData
    ) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.state != OrderState.LOCKED) revert InvalidState(OrderState.LOCKED, order.state);
        if (msg.sender != order.buyer) revert Unauthorized();
        if (block.timestamp > order.deadline) revert DeadlinePassed();

        bool valid = IVerifier(verifier).verify(
            proofData,
            order.fiatAmount,
            order.fiatCurrency,
            order.railType
        );
        if (!valid) revert ProofVerificationFailed();

        order.proofHash = proofHash;
        order.state = OrderState.PAID;
        emit OrderPaid(orderId, proofHash);
    }

    /**
     * @notice LP / keeper releases tokens to buyer after the zkTLS path.
     */
    function release(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.state != OrderState.PAID) revert InvalidState(OrderState.PAID, order.state);
        if (msg.sender != order.lp && msg.sender != keeper) revert Unauthorized();

        order.state = OrderState.RELEASED;
        _removeFromLocked(orderId);

        IERC20(order.token).safeTransfer(order.buyer, order.tokenAmount);
        payable(order.buyer).transfer(order.buyerBond);
        payable(order.lp).transfer(order.lpBond);

        emit OrderReleased(orderId, order.buyer, order.tokenAmount);
    }

    /**
     * @notice Webhook-driven release. KeeperHub workflow (Section 7) calls
     *         this with the off-chain orderId hash and the 0G-Storage root of
     *         the verified webhook payload. Only the keeper may invoke.
     */
    function release(bytes32 orderIdHash, bytes32 evidenceHash) external nonReentrant {
        if (msg.sender != keeper) revert Unauthorized();
        uint256 id = orderIdByHash[orderIdHash];
        if (id == 0) revert UnknownOrder();

        Order storage order = orders[id];
        if (order.state != OrderState.LOCKED && order.state != OrderState.PAID) {
            revert InvalidState(OrderState.LOCKED, order.state);
        }

        order.evidenceHash = evidenceHash;
        order.state = OrderState.RELEASED;
        _removeFromLocked(id);

        IERC20(order.token).safeTransfer(order.buyer, order.tokenAmount);
        if (order.buyerBond > 0) payable(order.buyer).transfer(order.buyerBond);
        if (order.lpBond > 0) payable(order.lp).transfer(order.lpBond);

        emit OrderReleased(id, order.buyer, order.tokenAmount);
        emit Released(orderIdHash, evidenceHash);
    }

    function expire(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.state != OrderState.LOCKED) revert InvalidState(OrderState.LOCKED, order.state);
        if (block.timestamp <= order.deadline) revert DeadlineNotReached();

        order.state = OrderState.EXPIRED;
        _removeFromLocked(orderId);

        IERC20(order.token).safeTransfer(order.lp, order.tokenAmount);
        payable(order.lp).transfer(order.lpBond + order.buyerBond);

        emit OrderExpired(orderId, order.buyer);
    }

    function dispute(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.state != OrderState.LOCKED && order.state != OrderState.PAID) {
            revert InvalidState(OrderState.LOCKED, order.state);
        }
        if (msg.sender != order.buyer && msg.sender != order.lp) revert Unauthorized();

        order.state = OrderState.DISPUTED;
        emit OrderDisputed(orderId, msg.sender);
    }

    function resolveDispute(uint256 orderId, bool favorBuyer) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.state != OrderState.DISPUTED) revert InvalidState(OrderState.DISPUTED, order.state);
        if (msg.sender != keeper && msg.sender != owner()) revert Unauthorized();

        _removeFromLocked(orderId);

        if (favorBuyer) {
            order.state = OrderState.RESOLVED_BUYER;
            IERC20(order.token).safeTransfer(order.buyer, order.tokenAmount);
            payable(order.buyer).transfer(order.buyerBond + order.lpBond);
        } else {
            order.state = OrderState.RESOLVED_LP;
            IERC20(order.token).safeTransfer(order.lp, order.tokenAmount);
            payable(order.lp).transfer(order.buyerBond + order.lpBond);
        }
        emit OrderResolved(orderId, order.state);
    }

    // ============================================
    // Views
    // ============================================

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    function getLockedOrders() external view returns (uint256[] memory) {
        return lockedOrderIds;
    }

    function getOrderDeadline(uint256 orderId) external view returns (uint256) {
        return orders[orderId].deadline;
    }

    // ============================================
    // Internal
    // ============================================

    function _removeFromLocked(uint256 orderId) internal {
        uint256 n = lockedOrderIds.length;
        for (uint256 i = 0; i < n; i++) {
            if (lockedOrderIds[i] == orderId) {
                lockedOrderIds[i] = lockedOrderIds[n - 1];
                lockedOrderIds.pop();
                break;
            }
        }
    }

    // ============================================
    // Admin
    // ============================================

    function setVerifier(address _verifier) external onlyOwner { verifier = _verifier; }
    function setKeeper(address _keeper) external onlyOwner { keeper = _keeper; }

    /// Allow the contract to receive native bond refunds.
    receive() external payable {}
}
