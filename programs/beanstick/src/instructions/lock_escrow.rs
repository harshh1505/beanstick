use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};
use crate::state::{EscrowAccount, LpAccount, OrderState, ProtocolConfig};
use crate::errors::BeanstickError;
use crate::events::EscrowLockedEvent;

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct LockEscrow<'info> {
    #[account(mut)]
    pub lp_authority: Signer<'info>,

    #[account(
        seeds = [ProtocolConfig::SEED_PREFIX],
        bump = config.bump,
        constraint = !config.is_paused @ BeanstickError::ProtocolPaused
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [LpAccount::SEED_PREFIX, lp_authority.key().as_ref()],
        bump = lp_account.bump,
        constraint = lp_account.is_active @ BeanstickError::UnauthorizedSigner
    )]
    pub lp_account: Account<'info, LpAccount>,

    /// CHECK: Buyer receiving crypto upon successful zkTLS fiat verification
    pub buyer: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = lp_authority
    )]
    pub lp_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = lp_authority,
        space = EscrowAccount::LEN,
        seeds = [EscrowAccount::SEED_PREFIX, order_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(
        init,
        payer = lp_authority,
        token::mint = mint,
        token::authority = escrow,
        seeds = [EscrowAccount::VAULT_SEED_PREFIX, escrow.key().as_ref()],
        bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<LockEscrow>,
    order_id: u64,
    token_amount: u64,
    fiat_amount: u64,
    fiat_currency_hash: [u8; 32],
    rail_type_hash: [u8; 32],
    deadline_seconds: i64,
    receiver_commitment: [u8; 32],
    reference_hash: [u8; 32],
    challenge_window: u64,
) -> Result<()> {
    require!(
        deadline_seconds >= 300 && deadline_seconds <= 86400,
        BeanstickError::InvalidDeadline
    );

    // CPI transfer SPL Token / Token-2022 from LP to Escrow Vault
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.lp_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.lp_authority.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token_interface::transfer_checked(cpi_ctx, token_amount, ctx.accounts.mint.decimals)?;

    let escrow = &mut ctx.accounts.escrow;
    escrow.order_id = order_id;
    escrow.buyer = ctx.accounts.buyer.key();
    escrow.lp = ctx.accounts.lp_authority.key();
    escrow.mint = ctx.accounts.mint.key();
    escrow.vault = ctx.accounts.vault.key();
    escrow.token_amount = token_amount;
    escrow.fiat_amount = fiat_amount;
    escrow.fiat_currency_hash = fiat_currency_hash;
    escrow.rail_type_hash = rail_type_hash;
    escrow.buyer_bond = 0;
    escrow.lp_bond = 0;
    escrow.deadline = Clock::get()?.unix_timestamp + deadline_seconds;
    escrow.state = OrderState::Locked;
    escrow.proof_hash = [0u8; 32];
    escrow.evidence_hash = [0u8; 32];
    escrow.receiver_commitment = receiver_commitment;
    escrow.reference_hash = reference_hash;
    escrow.challenge_window = challenge_window;
    escrow.bump = ctx.bumps.escrow;
    escrow.vault_bump = ctx.bumps.vault;

    emit!(EscrowLockedEvent {
        order_id,
        escrow: escrow.key(),
        buyer: escrow.buyer,
        lp: escrow.lp,
        mint: escrow.mint,
        token_amount,
        fiat_amount,
        deadline: escrow.deadline,
    });

    Ok(())
}
