use anchor_lang::prelude::*;

#[account]
pub struct RailAccount {
    /// Rail identifier hash (keccak256 of "banksim", "upi", "venmo", "sepa")
    pub rail_hash: [u8; 32],
    /// Authorized zkTLS verifier program or threshold oracle pubkey
    pub verifier: Pubkey,
    /// Whether this fiat rail is enabled for settlements
    pub is_enabled: bool,
    /// Whether this rail is demo-only (disallowed on mainnet-beta)
    pub is_demo_only: bool,
    /// Canonical PDA bump
    pub bump: u8,
}

impl RailAccount {
    /// 8 (discriminator) + 32 (rail_hash) + 32 (verifier) + 1 (is_enabled) + 1 (is_demo_only) + 1 (bump) = 75 bytes
    pub const LEN: usize = 8 + 32 + 32 + 1 + 1 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"rail";
}
