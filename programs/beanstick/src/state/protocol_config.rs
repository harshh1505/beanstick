use anchor_lang::prelude::*;

#[account]
pub struct ProtocolConfig {
    /// Protocol admin authority
    pub admin: Pubkey,
    /// Authorized keeper / oracle authority that can commit Neo4j reputation roots and resolve disputes
    pub keeper_authority: Pubkey,
    /// Protocol fee treasury wallet
    pub treasury_wallet: Pubkey,
    /// Fee in basis points (e.g. 10 = 0.1%)
    pub fee_bps: u16,
    /// Circuit breaker to pause protocol operations
    pub is_paused: bool,
    /// Canonical PDA bump
    pub bump: u8,
}

impl ProtocolConfig {
    /// Total storage footprint:
    /// 8 (discriminator) + 32 (admin) + 32 (keeper_authority) + 32 (treasury_wallet) + 2 (fee_bps) + 1 (is_paused) + 1 (bump) = 108 bytes
    pub const LEN: usize = 8 + 32 + 32 + 32 + 2 + 1 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"config";
}
