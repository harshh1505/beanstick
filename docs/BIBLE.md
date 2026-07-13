# The Beanstick Bible: Complete Architecture & Developer Reference

## 1. Introduction and Vision

### The Core Problem
Every fiat-to-crypto onramp today is centralized. They custody funds, control liquidity, and have the power to freeze accounts. The gateway to decentralization is still centralized.

### The Beanstick Solution
Beanstick is the first fiat-to-crypto onramp operated by no one. By leveraging an autonomous swarm of four specialized agents—**Fiat**, **Crypto**, **Watcher**, and **Attestation**—Beanstick coordinates peer-to-peer, negotiates quotes through sealed inference, verifies off-chain payments, and triggers on-chain settlement. 

Each agent has structurally different powers, ensuring **no single agent can move funds alone**. The system replaces operators with verifiable agent coordination and constrained execution.

### Core Principles
- **No Custody**: The agents never hold your assets. Funds are locked securely in the Escrow contract.
- **Trustless Settlement**: Escrow release is deterministic and bound by strict proofs.
- **Privacy First**: Negotiation runs on TEE-attested sealed inference on 0G Compute.

---

## 2. Architecture Deep Dive

Beanstick is built natively on the **0G modular AI x Web3 stack**.

### 2.1. 0G Modular Stack Integration
- **0G Chain**: Agents are minted as iNFTs (ERC-7857) on 0G Chain. It acts as the backbone for identity, embedding agent logic with on-chain verifiable binaries. The core Escrow mechanism also resides here.
- **0G Storage**: The memory layer. KV (Key-Value) memory for real-time agent state, plus Log memory for full settlement history. All storage is encrypted and Merkle-rooted for auditability.
- **0G Compute**: Sealed inference (TEE-attested LLM calls) for quote ranking and counterparty reputation scoring. This ensures that the proprietary logic for picking the best quote is secure and cannot be manipulated or front-run.
- **Graph Intelligence (Neo4j)**: A dedicated graph database that continuously models the network of users, LPs, and settlements. It prevents fraud (e.g. circular trading) and provides a quantitative Trust Score that directly influences Quote Ranking.

### 2.2. The Swarm Ecosystem
The power of Beanstick comes from a **4-Agent Quad** (defined in `/agents/manager.ts`):

1. **Fiat Agent**: Handles the user intent. It broadcasts an RFQ (Request for Quote) and runs deterministic logic to select the best quote. It does not custody crypto.
2. **Crypto Agent**: Acts as the Liquidity Provider (LP). Responds to RFQs with signed quotes. Upon acceptance, it locks the funds into the Escrow contract.
3. **Watcher Agent**: Observes off-chain payment networks. For example, it validates webhooks confirming UPI or Venmo payments. It **cannot execute** smart contracts, making it safe to run near traditional finance networks.
4. **Attestation Agent**: Consumes the observation from the Watcher Agent. It hashes the observed receiver and compares it to the on-chain commitment. If it matches, it submits a cryptographic proof to the Scoped Executor.

---

## 3. Core Workflows

### 3.1. End-to-End Settlement Flow
1. **Connect & Init**: A user connects their wallet, initializing a Quad of agents (managed by the `AgentManager`).
2. **Intent & RFQ**: The user's Fiat Agent broadcasts a desire (e.g., 100 USD to ETH).
3. **Graph Trust Evaluation**: The Fiat Agent queries **Neo4j** to fetch the Trust Score and fraud risk for each replying Crypto Agent (LP).
4. **Sealed Ranking**: Multiple Crypto Agents reply. The Fiat Agent selects the best one via sealed inference on 0G Compute, evaluating `(Best Price) + (Neo4j Trust Score)`.
5. **Escrow Lock**: The chosen Crypto Agent locks the requested tokens in the 0G `Escrow` contract and securely commits `keccak256(paymentReceiver)`.
5. **Fiat Transfer**: User pays via UPI/Bank transfer off-chain.
6. **Observation**: Watcher Agent intercepts the payment webhook and forwards the structured observation to the Attestation Agent.
7. **Attestation & Release**: Attestation Agent checks the hash against the on-chain commitment. A proof is generated and pinned to 0G Storage. The executor calls `release()` on the Escrow contract, and funds are distributed.

### 3.2. Receiver Commitment Binding (The Security Core)
The bedrock of Beanstick' security is the Receiver Commitment.
- **At Lock**: LP commits `keccak256(paymentReceiver)`.
- **At Verify**: Attestor verifies `keccak256(observedReceiver) == commitment`.
Only a strict match triggers a successful release, preventing payment spoofing or bait-and-switch vectors.

---

## 4. Technical Specifications

### 4.1. Contracts (`/contracts`)
The primary on-chain engine is located in `contracts/src/`.
- **`Escrow.sol`**: Manages the locked assets. Offers two paths for release:
  - (a) A legacy/zkTLS path where an external verifier is checked.
  - (b) A Keeper-driven webhook release where a 0G Storage root (evidence hash) is provided.
- **State Machine**: Orders cycle from `INIT` -> `LOCKED` -> `PAID` -> `RELEASED` (or `EXPIRED`/`DISPUTED`).
- **`AgentRegistry.sol`** & **`INFT.sol`**: Manage the identities and metadata of the agents running on the 0G Chain.

### 4.2. Agents (`/agents`)
The agents are written in TypeScript and orchestrated via `manager.ts`.
- `AgentManager.getOrCreateQuad()` instantiates the 4 essential agents.
- Agents communicate over specialized RPCs and maintain state securely.
- Agents operate in "demo" mode or live modes where they actively check bounds and spread (e.g., 50bps spread on CryptoAgent).

---

## 5. Security Model & Threat Vectors

- **Agent Compromise**: Because functions are strictly separated, a compromised Fiat Agent cannot move locked funds. A compromised Watcher can only observe, not execute. Even an Attestation Agent is bound by the cryptographic commitment on-chain.
- **Executor Bounds**: The Scoped Executor is strictly limited to `release()` and `expire()`. It cannot transfer funds to arbitrary addresses, it can only fulfill or revert the escrow.
- **Reentrancy & Faults**: The `Escrow.sol` utilizes standard OpenZeppelin `ReentrancyGuard` and strictly validates state transitions (`InvalidState` reverts).

---

## 6. Developer Guide

### Running Locally
To run the full stack locally for development or testing:

```bash
git clone https://github.com/arko05roy/Beanstick.git && cd Beanstick
pnpm install
cp .env.example .env

# Run services
pnpm run agent-server &
pnpm run webhook-receiver &

# Run frontend (Vite/Next)
pnpm dev
```

### Architecture Extensions
- If extending fiat rails (e.g., adding Stripe), implement a new webhook parser for the Watcher Agent.
- TEE attestation can be extended by upgrading the `RailRegistry.sol` to support new formats.
