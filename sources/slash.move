/// Phase 3 slashing mechanism: admin can slash part of pool collateral
/// to a designated recipient and force-pause the market.
module x_market::slash;

use sui::clock::{Self, Clock};
use x_market::config::{Self, AdminCap, GlobalConfig};
use x_market::errors;
use x_market::market_pool::{Self, MarketPool};

public struct SlashRecord has key {
    id: UID,
    market_id: ID,
    amount_usdc: u64,
    reason_code: u64,
    recipient: address,
    slashed_by: address,
    slashed_at: u64,
}

public fun can_slash(amount_usdc: u64, collateral_usdc: u64): bool {
    amount_usdc > 0 && amount_usdc <= collateral_usdc
}

/// Slash collateral and transfer to `recipient`.
/// reason_code is an opaque number for off-chain governance mapping.
public entry fun slash_pool(
    config: &GlobalConfig,
    cap: &AdminCap,
    pool: &mut MarketPool,
    amount_usdc: u64,
    reason_code: u64,
    recipient: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    if (!can_slash(amount_usdc, market_pool::collateral_value(pool))) {
        if (amount_usdc == 0) {
            abort errors::out_of_bounds()
        };
        abort errors::insufficient_equity()
    };

    let slashed_coin = market_pool::withdraw_vault(pool, amount_usdc, ctx);
    transfer::public_transfer(slashed_coin, recipient);
    market_pool::set_paused(pool, true);

    let rec = SlashRecord {
        id: object::new(ctx),
        market_id: market_pool::pool_id(pool),
        amount_usdc,
        reason_code,
        recipient,
        slashed_by: ctx.sender(),
        slashed_at: clock::timestamp_ms(clock) / 1000,
    };
    transfer::share_object(rec);
}

/// Governance/admin can resume market after slashing handling is complete.
public entry fun unslash_resume_pool(
    config: &GlobalConfig,
    cap: &AdminCap,
    pool: &mut MarketPool,
    ctx: &TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    market_pool::set_paused(pool, false);
}
