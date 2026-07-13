use anchor_lang::prelude::*;

#[account]
pub struct UserAccount {
    /// User wallet authority
    pub wallet: Pubkey,
    /// Timestamp when profile was created
    pub created_at: i64,
    /// Total number of fiat-to-crypto orders initiated
    pub total_orders: u64,
    /// Cumulative volume settled in USD cents
    pub total_volume_usd: u64,
    /// Canonical PDA bump
    pub bump: u8,
}

impl UserAccount {
    /// 8 (discriminator) + 32 (wallet) + 8 (created_at) + 8 (total_orders) + 8 (total_volume_usd) + 1 (bump) = 65 bytes
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"user";
}
