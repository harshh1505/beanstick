use anchor_lang::prelude::*;
use crate::state::LpAccount;
use crate::events::LpRegisteredEvent;

#[derive(Accounts)]
pub struct RegisterLp<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = LpAccount::LEN,
        seeds = [LpAccount::SEED_PREFIX, authority.key().as_ref()],
        bump
    )]
    pub lp_account: Account<'info, LpAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterLp>,
    axl_pubkey: [u8; 32],
    bps_fee: u16,
) -> Result<()> {
    let lp = &mut ctx.accounts.lp_account;
    lp.authority = ctx.accounts.authority.key();
    lp.axl_pubkey = axl_pubkey;
    lp.staked_amount = 0;
    lp.success_count = 0;
    lp.fail_count = 0;
    lp.total_volume_usd = 0;
    lp.bps_fee = bps_fee;
    lp.is_active = true;
    lp.registered_at = Clock::get()?.unix_timestamp;
    lp.bump = ctx.bumps.lp_account;

    emit!(LpRegisteredEvent {
        authority: lp.authority,
        axl_pubkey,
        staked_amount: 0,
    });

    Ok(())
}
