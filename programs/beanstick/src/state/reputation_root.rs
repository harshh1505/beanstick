use anchor_lang::prelude::*;

#[account]
pub struct ReputationRootAccount {
    /// Epoch number of Neo4j AuraDB trust score commitment
    pub epoch: u64,
    /// 32-byte Merkle root of LP wallet trust scores & fraud risk vectors
    pub merkle_root: [u8; 32],
    /// UNIX timestamp when state root was committed
    pub updated_at: i64,
    /// Oracle authority committing the graph root
    pub oracle_authority: Pubkey,
    /// Canonical PDA bump
    pub bump: u8,
}

impl ReputationRootAccount {
    /// 8 (discriminator) + 8 (epoch) + 32 (merkle_root) + 8 (updated_at) + 32 (oracle_authority) + 1 (bump) = 89 bytes
    pub const LEN: usize = 8 + 8 + 32 + 8 + 32 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"reputation_root";
}
