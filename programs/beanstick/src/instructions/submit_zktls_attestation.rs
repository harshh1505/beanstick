use anchor_lang::prelude::*;
use crate::state::{AttestationAccount, EscrowAccount, OrderState, ProtocolConfig};
use crate::errors::BeanstickError;
use crate::events::AttestationSubmittedEvent;

#[derive(Accounts)]
pub struct SubmitZkTlsAttestation<'info> {
    #[account(mut)]
    pub attestor: Signer<'info>,

    #[account(
        seeds = [ProtocolConfig::SEED_PREFIX],
        bump = config.bump,
        constraint = !config.is_paused @ BeanstickError::ProtocolPaused
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        constraint = escrow.state == OrderState::Locked @ BeanstickError::InvalidOrderState
    )]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(
        init,
        payer = attestor,
        space = AttestationAccount::LEN,
        seeds = [AttestationAccount::SEED_PREFIX, escrow.key().as_ref()],
        bump
    )]
    pub attestation: Account<'info, AttestationAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SubmitZkTlsAttestation>,
    zk_proof_hash: [u8; 32],
    storage_root: [u8; 32],
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(now <= ctx.accounts.escrow.deadline, BeanstickError::DeadlinePassed);

    let attestation = &mut ctx.accounts.attestation;
    attestation.escrow = ctx.accounts.escrow.key();
    attestation.attestor = ctx.accounts.attestor.key();
    attestation.zk_proof_hash = zk_proof_hash;
    attestation.storage_root = storage_root;
    attestation.verified_at = now;
    attestation.is_valid = true;
    attestation.bump = ctx.bumps.attestation;

    let escrow = &mut ctx.accounts.escrow;
    escrow.proof_hash = zk_proof_hash;
    escrow.evidence_hash = storage_root;
    escrow.state = OrderState::Attested;

    emit!(AttestationSubmittedEvent {
        order_id: escrow.order_id,
        escrow: escrow.key(),
        attestor: attestation.attestor,
        zk_proof_hash,
        storage_root,
    });

    Ok(())
}
