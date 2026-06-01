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

const SLASH_TIMELOCK_SECS: u64 = 1800;
const SLASH_MAX_SINGLE_BPS: u64 = 3000; // 30%
const SLASH_MAX_CYCLE_BPS: u64 = 5000; // 50%

public fun can_slash(amount_usdc: u64, collateral_usdc: u64): bool {
    amount_usdc > 0 && amount_usdc <= collateral_usdc
}

public fun slash_timelock_secs(): u64 {
    SLASH_TIMELOCK_SECS
}

public fun slash_max_single_bps(): u64 {
    SLASH_MAX_SINGLE_BPS
}

public fun slash_max_cycle_bps(): u64 {
    SLASH_MAX_CYCLE_BPS
}

public fun within_bps_limit(amount_usdc: u64, base_collateral_usdc: u64, limit_bps: u64): bool {
    if (base_collateral_usdc == 0) {
        return false
    };
    amount_usdc * 10_000 <= base_collateral_usdc * limit_bps
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
    let collateral = market_pool::collateral_value(pool);
    if (!can_slash(amount_usdc, collateral)) {
        if (amount_usdc == 0) {
            abort errors::out_of_bounds()
        };
        abort errors::insufficient_equity()
    };
    let base = if (market_pool::slash_cycle_base_collateral_usdc(pool) == 0) {
        collateral
    } else {
        market_pool::slash_cycle_base_collateral_usdc(pool)
    };
    if (!within_bps_limit(amount_usdc, base, SLASH_MAX_SINGLE_BPS)) {
        abort errors::out_of_bounds()
    };
    let cycle_total = market_pool::slash_cycle_total_usdc(pool) + amount_usdc;
    if (!within_bps_limit(cycle_total, base, SLASH_MAX_CYCLE_BPS)) {
        abort errors::out_of_bounds()
    };
    let now = clock::timestamp_ms(clock) / 1000;

    let slashed_coin = market_pool::withdraw_vault(pool, amount_usdc, ctx);
    transfer::public_transfer(slashed_coin, recipient);
    market_pool::set_paused(pool, true);
    market_pool::set_slash_state(pool, base, cycle_total, now + SLASH_TIMELOCK_SECS);

    let rec = SlashRecord {
        id: object::new(ctx),
        market_id: market_pool::pool_id(pool),
        amount_usdc,
        reason_code,
        recipient,
        slashed_by: ctx.sender(),
        slashed_at: now,
    };
    transfer::share_object(rec);
}

/// Governance/admin can resume market after slashing handling is complete.
public entry fun unslash_resume_pool(
    config: &GlobalConfig,
    cap: &AdminCap,
    pool: &mut MarketPool,
    clock: &Clock,
    ctx: &TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    let now = clock::timestamp_ms(clock) / 1000;
    if (now < market_pool::slash_resume_after_ts(pool)) {
        abort errors::out_of_bounds()
    };
    market_pool::set_paused(pool, false);
    market_pool::reset_slash_state(pool);
}
