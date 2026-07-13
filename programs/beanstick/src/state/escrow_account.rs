use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum OrderState {
    Initiated = 0,
    Locked = 1,
    Attested = 2,
    Released = 3,
    Expired = 4,
    Disputed = 5,
    ResolvedBuyer = 6,
    ResolvedLp = 7,
}

#[account]
pub struct EscrowAccount {
    /// Unique settlement sequence ID
    pub order_id: u64,
    /// Buyer (user onboarding fiat -> crypto)
    pub buyer: Pubkey,
    /// Winning LP Agent from reverse auction
    pub lp: Pubkey,
    /// SPL Token or Token-2022 Mint (e.g. USDC, PYUSD)
    pub mint: Pubkey,
    /// Program Derived Token Vault holding locked tokens
    pub vault: Pubkey,
    /// Crypto amount locked in atomic base units
    pub token_amount: u64,
    /// Fiat amount in cents (e.g. 10000 = $100.00)
    pub fiat_amount: u64,
    /// Keccak256 hash of fiat currency code ("USD", "EUR", "INR")
    pub fiat_currency_hash: [u8; 32],
    /// Keccak256 hash of rail ("banksim", "upi", "sepa", "venmo")
    pub rail_type_hash: [u8; 32],
    /// Native lamports locked by buyer as commitment bond
    pub buyer_bond: u64,
    /// Native lamports locked by LP as SLA guarantee bond
    pub lp_bond: u64,
    /// UNIX timestamp deadline for fiat transfer verification
    pub deadline: i64,
    /// Current finite state machine state
    pub state: OrderState,
    /// Merkle root or Groth16 circuit hash of zkTLS proof
    pub proof_hash: [u8; 32],
    /// 0G Storage / Arweave root hash of verified payment receipt
    pub evidence_hash: [u8; 32],
    /// LP's committed payment receiver hash
    pub receiver_commitment: [u8; 32],
    /// Payment reference hash for matching bank transfers
    pub reference_hash: [u8; 32],
    /// Seconds challenge window before auto-finalize
    pub challenge_window: u64,
    /// Canonical PDA bump for escrow account
    pub bump: u8,
    /// Canonical PDA bump for token vault
    pub vault_bump: u8,
}

impl EscrowAccount {
    /// Total storage layout footprint:
    /// 8 (discriminator) + 8 (order_id) + 32 (buyer) + 32 (lp) + 32 (mint) + 32 (vault)
    /// + 8 (token_amount) + 8 (fiat_amount) + 32 (fiat_currency_hash) + 32 (rail_type_hash)
    /// + 8 (buyer_bond) + 8 (lp_bond) + 8 (deadline) + 1 (state enum)
    /// + 32 (proof_hash) + 32 (evidence_hash) + 32 (receiver_commitment) + 32 (reference_hash)
    /// + 8 (challenge_window) + 1 (bump) + 1 (vault_bump) = 379 bytes
    pub const LEN: usize = 8 + 8 + 32 + 32 + 32 + 32 + 8 + 8 + 32 + 32 + 8 + 8 + 8 + 1 + 32 + 32 + 32 + 32 + 8 + 1 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"escrow";
    pub const VAULT_SEED_PREFIX: &'static [u8] = b"vault";
}
