use anchor_lang::prelude::*;

#[account]
pub struct LpAccount {
    /// Wallet address of the Liquidity Provider agent
    pub authority: Pubkey,
    /// AXL Agent public-key hash (keccak256 or sha256 32-byte identifier)
    pub axl_pubkey: [u8; 32],
    /// Amount of SOL or SPL tokens staked as security bond
    pub staked_amount: u64,
    /// Number of successfully completed settlements
    pub success_count: u64,
    /// Number of failed or expired settlements
    pub fail_count: u64,
    /// Cumulative volume settled in USD cents
    pub total_volume_usd: u64,
    /// LP fee spread in basis points
    pub bps_fee: u16,
    /// Whether the LP agent is active and eligible to win reverse auctions
    pub is_active: bool,
    /// UNIX timestamp of LP registration
    pub registered_at: i64,
    /// Canonical PDA bump
    pub bump: u8,
}

impl LpAccount {
    /// Storage size layout:
    /// 8 (discriminator) + 32 (authority) + 32 (axl_pubkey) + 8 (staked_amount)
    /// + 8 (success_count) + 8 (fail_count) + 8 (total_volume_usd)
    /// + 2 (bps_fee) + 1 (is_active) + 8 (registered_at) + 1 (bump) = 116 bytes
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 2 + 1 + 8 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"lp";
}
