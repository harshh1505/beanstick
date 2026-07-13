use anchor_lang::prelude::*;
use crate::state::{ProtocolConfig, ReputationRootAccount};
use crate::errors::BeanstickError;
use crate::events::ReputationRootCommittedEvent;

#[derive(Accounts)]
#[instruction(epoch: u64)]
pub struct CommitReputationRoot<'info> {
    #[account(mut)]
    pub oracle_authority: Signer<'info>,

    #[account(
        seeds = [ProtocolConfig::SEED_PREFIX],
        bump = config.bump,
        constraint = config.keeper_authority == oracle_authority.key() @ BeanstickError::UnauthorizedSigner
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        init_if_needed,
        payer = oracle_authority,
        space = ReputationRootAccount::LEN,
        seeds = [ReputationRootAccount::SEED_PREFIX, epoch.to_le_bytes().as_ref()],
        bump
    )]
    pub reputation_root: Account<'info, ReputationRootAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CommitReputationRoot>,
    epoch: u64,
    merkle_root: [u8; 32],
) -> Result<()> {
    let rep = &mut ctx.accounts.reputation_root;
    rep.epoch = epoch;
    rep.merkle_root = merkle_root;
    rep.updated_at = Clock::get()?.unix_timestamp;
    rep.oracle_authority = ctx.accounts.oracle_authority.key();
    rep.bump = ctx.bumps.reputation_root;

    emit!(ReputationRootCommittedEvent {
        epoch,
        merkle_root,
        oracle_authority: rep.oracle_authority,
    });

    Ok(())
}
