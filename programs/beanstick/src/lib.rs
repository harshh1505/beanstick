pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use instructions::*;

declare_id!("Bean111111111111111111111111111111111111111");

#[program]
pub mod beanstick {
    use super::*;

    /// Initialize the global protocol configuration and treasury fee settings
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        keeper_authority: Pubkey,
        treasury_wallet: Pubkey,
        fee_bps: u16,
    ) -> Result<()> {
        instructions::initialize_config::handler(ctx, keeper_authority, treasury_wallet, fee_bps)
    }

    /// Register a Liquidity Provider Agent on Solana
    pub fn register_lp(
        ctx: Context<RegisterLp>,
        axl_pubkey: [u8; 32],
        bps_fee: u16,
    ) -> Result<()> {
        instructions::register_lp::handler(ctx, axl_pubkey, bps_fee)
    }

    /// Lock SPL Token / Token-2022 in Escrow PDA Vault for a fiat settlement
    pub fn lock_escrow(
        ctx: Context<LockEscrow>,
        order_id: u64,
        token_amount: u64,
        fiat_amount: u64,
        fiat_currency_hash: [u8; 32],
        rail_type_hash: [u8; 32],
        deadline_seconds: i64,
        receiver_commitment: [u8; 32],
        reference_hash: [u8; 32],
        challenge_window: u64,
    ) -> Result<()> {
        instructions::lock_escrow::handler(
            ctx,
            order_id,
            token_amount,
            fiat_amount,
            fiat_currency_hash,
            rail_type_hash,
            deadline_seconds,
            receiver_commitment,
            reference_hash,
            challenge_window,
        )
    }

    /// Submit cryptographically verified zkTLS attestation proof of fiat transfer
    pub fn submit_zktls_attestation(
        ctx: Context<SubmitZkTlsAttestation>,
        zk_proof_hash: [u8; 32],
        storage_root: [u8; 32],
    ) -> Result<()> {
        instructions::submit_zktls_attestation::handler(ctx, zk_proof_hash, storage_root)
    }

    /// Trustless release of escrow vault tokens to buyer via PDA signer seeds
    pub fn release_escrow(ctx: Context<ReleaseEscrow>) -> Result<()> {
        instructions::release_escrow::handler(ctx)
    }

    /// Refund expired escrow funds back to LP if deadline passed without proof
    pub fn refund_escrow(ctx: Context<RefundEscrow>) -> Result<()> {
        instructions::refund_escrow::handler(ctx)
    }

    /// Dispute an escrow transaction
    pub fn dispute_escrow(ctx: Context<DisputeEscrow>) -> Result<()> {
        instructions::dispute_escrow::handler(ctx)
    }

    /// Commit periodic Neo4j AuraDB trust score Merkle root on-chain
    pub fn commit_reputation_root(
        ctx: Context<CommitReputationRoot>,
        epoch: u64,
        merkle_root: [u8; 32],
    ) -> Result<()> {
        instructions::commit_reputation_root::handler(ctx, epoch, merkle_root)
    }
}
