# Beanstick: Technical Documentation & Reference

## 1. Introduction
Beanstick is a trustless, non-custodial fiat-to-crypto settlement network designed to eliminate the counterparty risk typically associated with Web2-to-Web3 bridging. By leveraging an autonomous Agentic Swarm Protocol, zero-knowledge proofs (zkTLS), and Neo4j AuraDB graph routing, Beanstick allows users to seamlessly convert fiat currency into cryptocurrency without relying on centralized exchanges, manual operators, or custodians.

## 2. Core Architecture
The architecture is divided into three primary layers:
- **The Decentralized Swarm (Routing & Quotes):** A network of Liquidity Provider (LP) AI agents. These agents analyze real-time market data to offer competitive quotes.
- **Escrow & Execution (Smart Contracts):** Strictly deterministic Solidity smart contracts that lock and release funds strictly based on verifiable cryptographic proofs.
- **Verification (zkTLS):** Multi-party computation (MPC) and ZK-SNARKs are used to verify Web2 bank receipts (e.g., Venmo, Plaid) without ever exposing the user's sensitive bank login credentials.

## 3. Step-by-Step Transaction Flow
1. **Discovery & Routing:** A user broadcasts an intent (e.g., converting $100 USD to ETH). Neo4j AuraDB routes this request through an Agent Reputation Graph, using algorithms like `PageRank` to find a highly trusted agent offering the best exchange rate via a lightning-fast reverse-auction mechanism.
2. **Cryptographic Commitment:** The winning LP agent locks the agreed-upon cryptocurrency in the On-Chain Escrow Smart Contract. The state of this escrow is hashed and stored on the 0G Data Availability layer to minimize Layer 1 gas costs.
3. **Fiat Execution:** The user initiates a standard fiat transfer (e.g., Venmo, SEPA, or UPI) to the LP agent's bank account.
4. **Zero-Knowledge Verification:** An Attestor agent intercepts the TLS response from the bank via MPC. It generates a concise ZK-SNARK proof confirming the fiat transaction was successful.
5. **Trustless Settlement:** The ZK proof is submitted to the Escrow Contract. Upon successful on-chain cryptographic validation, the crypto funds are automatically released to the user's wallet. If the proof is not provided within a specific timeframe, funds are safely refunded to the LP.

## 4. Key Technologies
- **Neo4j AuraDB:** Serves as the backbone for routing and fraud detection. By modeling LP agents and historical transactions as a graph, it enables sub-millisecond calculation of trust scores and optimal liquidity pathfinding.
- **zkTLS:** Bridges Web2 banking API responses directly to Web3. It eliminates the need for centralized oracles by allowing smart contracts to natively verify HTTPS data.
- **0G Data Availability (DA):** Ensures infinite scalability. Complex attestations and settlement states are batched into a Merkle tree, with only the root hash posted to Ethereum (Sepolia Testnet), drastically reducing fees.
- **Frontend Stack:** Next.js, React, Tailwind CSS, and Framer Motion deliver a premium, intuitive fintech user experience.

## 5. Value Proposition
Beanstick completely removes the centralized middleman from the fiat onramp process. Smart contracts guarantee that Liquidity Providers cannot default on their obligations, while zkTLS ensures that users' bank details remain entirely private. By running graph algorithms over agent reputations, the system automatically curates a secure, fast, and highly liquid network, paving the way for the next generation of decentralized finance.
