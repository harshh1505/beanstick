use anchor_lang::prelude::*;
use crate::state::OrderState;

#[event]
pub struct ProtocolInitializedEvent {
    pub admin: Pubkey,
    pub keeper_authority: Pubkey,
    pub fee_bps: u16,
}

#[event]
pub struct LpRegisteredEvent {
    pub authority: Pubkey,
    pub axl_pubkey: [u8; 32],
    pub staked_amount: u64,
}

#[event]
pub struct EscrowLockedEvent {
    pub order_id: u64,
    pub escrow: Pubkey,
    pub buyer: Pubkey,
    pub lp: Pubkey,
    pub mint: Pubkey,
    pub token_amount: u64,
    pub fiat_amount: u64,
    pub deadline: i64,
}

#[event]
pub struct AttestationSubmittedEvent {
    pub order_id: u64,
    pub escrow: Pubkey,
    pub attestor: Pubkey,
    pub zk_proof_hash: [u8; 32],
    pub storage_root: [u8; 32],
}

#[event]
pub struct EscrowReleasedEvent {
    pub order_id: u64,
    pub escrow: Pubkey,
    pub buyer: Pubkey,
    pub lp: Pubkey,
    pub token_amount: u64,
}

#[event]
pub struct EscrowRefundedEvent {
    pub order_id: u64,
    pub escrow: Pubkey,
    pub lp: Pubkey,
    pub reason: String,
}

#[event]
pub struct EscrowDisputedEvent {
    pub order_id: u64,
    pub escrow: Pubkey,
    pub disputant: Pubkey,
}

#[event]
pub struct DisputeResolvedEvent {
    pub order_id: u64,
    pub escrow: Pubkey,
    pub resolution: OrderState,
}

#[event]
pub struct ReputationRootCommittedEvent {
    pub epoch: u64,
    pub merkle_root: [u8; 32],
    pub oracle_authority: Pubkey,
}
