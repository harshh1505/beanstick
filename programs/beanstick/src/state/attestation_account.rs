use anchor_lang::prelude::*;

#[account]
pub struct AttestationAccount {
    /// Associated Escrow Account PDA
    pub escrow: Pubkey,
    /// Public key of attesting watcher node / threshold signer
    pub attestor: Pubkey,
    /// Hash of zero-knowledge proof or Groth16 circuit verification receipt
    pub zk_proof_hash: [u8; 32],
    /// Immutable 0G Storage / Arweave root hash containing decrypted receipt metadata
    pub storage_root: [u8; 32],
    /// UNIX timestamp when attestation was verified on Solana
    pub verified_at: i64,
    /// Whether attestation passed cryptographic verification
    pub is_valid: bool,
    /// Canonical PDA bump
    pub bump: u8,
}

impl AttestationAccount {
    /// 8 (discriminator) + 32 (escrow) + 32 (attestor) + 32 (zk_proof_hash) + 32 (storage_root) + 8 (verified_at) + 1 (is_valid) + 1 (bump) = 146 bytes
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 8 + 1 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"attestation";
}
