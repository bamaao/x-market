// Copyright (c) 2026 zouyc zouyccq@gmail.com.
// All rights reserved.
//
// Licensed under the Business Source License 1.1 (BSL 1.1).
// You may not use this file except in compliance with the License.
//
// Change Date: 2031-01-01
// On the Change Date, or the fourth anniversary of the first publicly available
// distribution of the code under the BSL, whichever comes first, the code
// automatically becomes available under the Apache License 2.0.

/// Emergency market void: admin stops trading on abnormal events (match cancelled, etc.)
/// and users reclaim position stake + LP NAV via existing withdraw paths.
module x_market::emergency_cancel;

use sui::clock::{Self, Clock};
use sui::event;
use x_market::coin_util;
use x_market::config::{Self, AdminCap, GlobalConfig};
use x_market::errors;
use x_market::market_pool::{Self, MarketPool};
use x_market::position::{Self, Position};
use x_market::risk;

/// Reason codes (opaque u64 for off-chain mapping):
/// 1 = match_cancelled, 2 = match_postponed, 3 = force_majeure, 4 = other
public struct VoidRecord has copy, drop {
    market_id: ID,
    reason_code: u64,
    voided_by: address,
    voided_at: u64,
}

/// Super-admin (AdminCap holder) voids a market before settlement.
/// Pauses trading; positions can `claim_position_refund`; LPs use `pool::withdraw_liquidity`.
public entry fun emergency_void_market(
    config: &GlobalConfig,
    cap: &AdminCap,
    pool: &mut MarketPool,
    reason_code: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    assert_voidable(pool);
    market_pool::set_voided(pool);
    event::emit(VoidRecord {
        market_id: market_pool::pool_id(pool),
        reason_code,
        voided_by: ctx.sender(),
        voided_at: clock::timestamp_ms(clock) / 1000,
    });
}

/// Reclaim net stake after emergency void (full principal refund, no fee return).
public entry fun claim_position_refund(
    pool: &mut MarketPool,
    mut pos: Position,
    ctx: &mut TxContext,
) {
    assert_voided(pool);
    if (position::market_id(&pos) != market_pool::pool_id(pool)) {
        abort errors::out_of_bounds()
    };
    if (position::is_claimed(&pos)) {
        abort errors::already_claimed()
    };
    let stake = position::stake_usdc(&pos);
    let vault = market_pool::collateral_value(pool);
    if (stake > vault) {
        abort errors::max_loss_exceeded()
    };
    let pool_kind = market_pool::kind(pool);
    risk::release_position_liability(
        market_pool::liability_by_k_mut(pool),
        pool_kind,
        &pos,
    );
    position::mark_claimed(&mut pos);
    let coin = coin_util::withdraw_from_vault(pool, stake, ctx);
    position::destroy_after_claim(pos);
    transfer::public_transfer(coin, ctx.sender());
}

public fun is_voidable(pool: &MarketPool): bool {
    !market_pool::is_voided(pool) &&
        !market_pool::is_settled(pool) &&
        !market_pool::is_resolved(pool)
}

fun assert_voidable(pool: &MarketPool) {
    if (market_pool::is_voided(pool)) {
        abort errors::already_voided()
    };
    if (market_pool::is_settled(pool) || market_pool::is_resolved(pool)) {
        abort errors::market_already_resolved()
    };
}

fun assert_voided(pool: &MarketPool) {
    if (!market_pool::is_voided(pool)) {
        abort errors::not_voided()
    };
}
