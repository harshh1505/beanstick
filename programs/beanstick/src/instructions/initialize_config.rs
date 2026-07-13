use anchor_lang::prelude::*;
use crate::state::ProtocolConfig;
use crate::events::ProtocolInitializedEvent;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = ProtocolConfig::LEN,
        seeds = [ProtocolConfig::SEED_PREFIX],
        bump
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeConfig>,
    keeper_authority: Pubkey,
    treasury_wallet: Pubkey,
    fee_bps: u16,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.keeper_authority = keeper_authority;
    config.treasury_wallet = treasury_wallet;
    config.fee_bps = fee_bps;
    config.is_paused = false;
    config.bump = ctx.bumps.config;

    emit!(ProtocolInitializedEvent {
        admin: config.admin,
        keeper_authority,
        fee_bps,
    });

    Ok(())
}
