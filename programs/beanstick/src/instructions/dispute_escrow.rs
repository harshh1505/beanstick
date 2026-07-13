use anchor_lang::prelude::*;
use crate::state::{EscrowAccount, OrderState};
use crate::errors::BeanstickError;
use crate::events::EscrowDisputedEvent;

#[derive(Accounts)]
pub struct DisputeEscrow<'info> {
    #[account(mut)]
    pub disputant: Signer<'info>,

    #[account(
        mut,
        constraint = (disputant.key() == escrow.buyer || disputant.key() == escrow.lp) @ BeanstickError::UnauthorizedSigner,
        constraint = (escrow.state == OrderState::Locked || escrow.state == OrderState::Attested) @ BeanstickError::InvalidOrderState
    )]
    pub escrow: Account<'info, EscrowAccount>,
}

pub fn handler(ctx: Context<DisputeEscrow>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    escrow.state = OrderState::Disputed;

    emit!(EscrowDisputedEvent {
        order_id: escrow.order_id,
        escrow: escrow.key(),
        disputant: ctx.accounts.disputant.key(),
    });

    Ok(())
}
