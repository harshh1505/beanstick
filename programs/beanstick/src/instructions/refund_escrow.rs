use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};
use crate::state::{EscrowAccount, LpAccount, OrderState};
use crate::errors::BeanstickError;
use crate::events::EscrowRefundedEvent;

#[derive(Accounts)]
pub struct RefundEscrow<'info> {
    #[account(mut)]
    pub lp_authority: Signer<'info>,

    #[account(
        mut,
        constraint = escrow.lp == lp_authority.key() @ BeanstickError::UnauthorizedSigner,
        constraint = escrow.state == OrderState::Locked @ BeanstickError::InvalidOrderState
    )]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(
        mut,
        seeds = [LpAccount::SEED_PREFIX, lp_authority.key().as_ref()],
        bump = lp_account.bump
    )]
    pub lp_account: Account<'info, LpAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [EscrowAccount::VAULT_SEED_PREFIX, escrow.key().as_ref()],
        bump = escrow.vault_bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = lp_authority
    )]
    pub lp_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<RefundEscrow>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let escrow = &mut ctx.accounts.escrow;
    require!(now > escrow.deadline, BeanstickError::DeadlineNotReached);

    let order_id_bytes = escrow.order_id.to_le_bytes();
    let signer_seeds: &[&[&[u8]]] = &[&[
        EscrowAccount::SEED_PREFIX,
        order_id_bytes.as_ref(),
        &[escrow.bump],
    ]];

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.vault.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.lp_token_account.to_account_info(),
        authority: escrow.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
    token_interface::transfer_checked(cpi_ctx, escrow.token_amount, ctx.accounts.mint.decimals)?;

    escrow.state = OrderState::Expired;

    let lp = &mut ctx.accounts.lp_account;
    lp.fail_count = lp.fail_count.saturating_add(1);

    emit!(EscrowRefundedEvent {
        order_id: escrow.order_id,
        escrow: escrow.key(),
        lp: escrow.lp,
        reason: "Deadline passed without zkTLS proof submission".to_string(),
    });

    Ok(())
}
