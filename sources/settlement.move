/// Position settlement after oracle resolution (PRD Phase 1).
module x_market::settlement;

use x_market::coin_util;
use x_market::errors;
use x_market::market_pool::{Self, MarketPool};
use x_market::position::{Self, Position};
use x_market::risk;

public entry fun claim_position(
    pool: &mut MarketPool,
    mut pos: Position,
    ctx: &mut TxContext,
) {
    if (position::is_claimed(&pos)) {
        abort errors::already_claimed()
    };
    if (!market_pool::is_resolved(pool)) {
        abort errors::not_resolved()
    };
    if (!is_winner(pool, &pos)) {
        abort errors::not_winner()
    };
    let resolved_slot = resolved_slot_checked(pool);
    let payout = if (
        position::is_linear_call(&pos) ||
            position::is_linear_put(&pos) ||
            position::is_straddle(&pos) ||
            position::is_variance_swap(&pos) ||
            position::is_structured_note(&pos) ||
            position::is_range_note(&pos) ||
            position::is_barrier_note(&pos)
    ) {
        risk::derivative_payout_usdc(
            position::contract_kind(&pos),
            position::interval_a(&pos),
            position::interval_b(&pos),
            resolved_slot,
            position::stake_usdc(&pos),
        )
    } else {
        risk::position_payout_usdc(
            position::stake_usdc(&pos),
            position::entry_prob_ppb(&pos),
        )
    };
    let vault = market_pool::collateral_value(pool);
    if (payout > vault) {
        abort errors::max_loss_exceeded()
    };
    position::mark_claimed(&mut pos);
    let coin = coin_util::withdraw_from_vault(pool, payout, ctx);
    position::destroy_after_claim(pos);
    transfer::public_transfer(coin, ctx.sender());
}

fun resolved_slot_checked(pool: &MarketPool): u8 {
    let rv = market_pool::resolved_value(pool);
    if (!risk::is_valid_slot(rv)) {
        abort errors::out_of_bounds()
    };
    rv as u8
}

fun is_winner(pool: &MarketPool, pos: &Position): bool {
    let rv = market_pool::resolved_value(pool);
    if (market_pool::is_poisson(pool)) {
        if (!risk::is_valid_slot(rv)) {
            abort errors::out_of_bounds()
        };
        let k = rv as u8;
        if (position::is_digital(pos)) {
            k == position::interval_a(pos)
        } else {
            k >= position::interval_a(pos) && k <= position::interval_b(pos)
        }
    } else if (market_pool::is_dirichlet(pool)) {
        if (!risk::is_valid_slot(rv)) {
            abort errors::out_of_bounds()
        };
        (rv as u8) == position::interval_a(pos)
    } else if (market_pool::is_normal(pool)) {
        let v = rv;
        if (
            position::is_linear_call(pos) ||
                position::is_linear_put(pos) ||
                position::is_straddle(pos) ||
                position::is_variance_swap(pos) ||
                position::is_structured_note(pos) ||
                position::is_range_note(pos) ||
                position::is_barrier_note(pos)
        ) {
            true
        } else if (position::is_digital(pos)) {
            v >= (position::interval_a(pos) as u64)
        } else {
            v >= (position::interval_a(pos) as u64) && v <= (position::interval_b(pos) as u64)
        }
    } else {
        false
    }
}
