use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};
use crate::state::{EscrowAccount, LpAccount, OrderState};
use crate::errors::BeanstickError;
use crate::events::EscrowReleasedEvent;

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    #[account(mut)]
    pub releaser: Signer<'info>,

    #[account(
        mut,
        constraint = escrow.state == OrderState::Attested || escrow.state == OrderState::Locked @ BeanstickError::InvalidOrderState
    )]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(
        mut,
        seeds = [LpAccount::SEED_PREFIX, escrow.lp.as_ref()],
        bump = lp_account.bump
    )]
    pub lp_account: Account<'info, LpAccount>,

    /// CHECK: Buyer receiving released crypto
    pub buyer: UncheckedAccount<'info>,

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
        token::authority = buyer
    )]
    pub buyer_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<ReleaseEscrow>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    let order_id_bytes = escrow.order_id.to_le_bytes();
    let signer_seeds: &[&[&[u8]]] = &[&[
        EscrowAccount::SEED_PREFIX,
        order_id_bytes.as_ref(),
        &[escrow.bump],
    ]];

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.vault.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.buyer_token_account.to_account_info(),
        authority: escrow.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
    token_interface::transfer_checked(cpi_ctx, escrow.token_amount, ctx.accounts.mint.decimals)?;

    escrow.state = OrderState::Released;

    let lp = &mut ctx.accounts.lp_account;
    lp.success_count = lp.success_count.saturating_add(1);
    lp.total_volume_usd = lp.total_volume_usd.saturating_add(escrow.fiat_amount);

    emit!(EscrowReleasedEvent {
        order_id: escrow.order_id,
        escrow: escrow.key(),
        buyer: escrow.buyer,
        lp: escrow.lp,
        token_amount: escrow.token_amount,
    });

    Ok(())
}
