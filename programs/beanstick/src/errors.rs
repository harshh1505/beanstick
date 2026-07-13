use anchor_lang::prelude::*;

#[error_code]
pub enum BeanstickError {
    #[msg("Protocol is currently paused by admin.")]
    ProtocolPaused,
    #[msg("Invalid finite state machine state transition.")]
    InvalidOrderState,
    #[msg("Unauthorized signer for this escrow action.")]
    UnauthorizedSigner,
    #[msg("Escrow deadline outside permitted minimum/maximum window.")]
    InvalidDeadline,
    #[msg("Escrow deadline has not yet passed.")]
    DeadlineNotReached,
    #[msg("Escrow deadline has passed.")]
    DeadlinePassed,
    #[msg("Provided zkTLS cryptographic attestation proof verification failed.")]
    ProofVerificationFailed,
    #[msg("Insufficient LP security bond staked.")]
    InsufficientLpBond,
    #[msg("Fiat payment rail is disabled or demo-only on mainnet.")]
    RailDisabledOrDemoOnly,
    #[msg("Attestation signature threshold not met.")]
    ThresholdAttestationFailed,
    #[msg("Merkle proof verification failed for LP trust score.")]
    InvalidReputationMerkleProof,
}
