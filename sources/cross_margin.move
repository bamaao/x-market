/// Cross-Margin ledger (Phase 2): on-chain per-user liability book.
module x_market::cross_margin;

use x_market::errors;
use x_market::market_pool::{Self, MarketPool};
use x_market::position::{Self, Position};
use x_market::risk;

public struct MarginAccount has key, store {
    id: UID,
    market_id: ID,
    liability_by_slot: vector<u64>,
    gross_stake_usdc: u64,
    linked_positions: vector<ID>,
}

public entry fun open_account(pool: &MarketPool, ctx: &mut TxContext) {
    let account = MarginAccount {
        id: object::new(ctx),
        market_id: market_pool::pool_id(pool),
        liability_by_slot: risk::zero_liability(),
        gross_stake_usdc: 0,
        linked_positions: vector::empty<ID>(),
    };
    transfer::public_transfer(account, ctx.sender());
}

public entry fun register_position(
    account: &mut MarginAccount,
    pool: &mut MarketPool,
    pos: &Position,
    _ctx: &TxContext,
) {
    assert_market_match(account, pos, pool);

    let pid = position::position_id(pos);
    if (contains_position(&account.linked_positions, pid)) {
        abort errors::out_of_bounds()
    };
    if (market_pool::is_margin_position_locked(pool, pid)) {
        abort errors::out_of_bounds()
    };

    apply_position_liability(&mut account.liability_by_slot, pool, pos, true);
    account.gross_stake_usdc = account.gross_stake_usdc + position::stake_usdc(pos);
    vector::push_back(&mut account.linked_positions, pid);
    market_pool::lock_margin_position(pool, pid);
}

public entry fun unregister_position(
    account: &mut MarginAccount,
    pool: &mut MarketPool,
    pos: &Position,
    _ctx: &TxContext,
) {
    assert_market_match(account, pos, pool);

    let pid = position::position_id(pos);
    let idx = find_position_index(&account.linked_positions, pid);
    if (idx == 18446744073709551615) {
        abort errors::out_of_bounds()
    };

    apply_position_liability(&mut account.liability_by_slot, pool, pos, false);
    account.gross_stake_usdc = account.gross_stake_usdc - position::stake_usdc(pos);
    let _ = vector::remove(&mut account.linked_positions, idx);
    market_pool::unlock_margin_position(pool, pid);
}

public fun market_id(account: &MarginAccount): ID {
    account.market_id
}

public fun gross_stake_usdc(account: &MarginAccount): u64 {
    account.gross_stake_usdc
}

public fun linked_count(account: &MarginAccount): u64 {
    vector::length(&account.linked_positions)
}

public fun max_liability(account: &MarginAccount): u64 {
    max_liability_from_slots(&account.liability_by_slot)
}

public fun max_liability_from_slots(slots: &vector<u64>): u64 {
    let mut max_v = 0u64;
    let mut i = 0u64;
    let len = vector::length(slots);
    while (i < len) {
        let v = *vector::borrow(slots, i);
        if (v > max_v) {
            max_v = v;
        };
        i = i + 1;
    };
    max_v
}

fun assert_market_match(account: &MarginAccount, pos: &Position, pool: &MarketPool) {
    let pid = position::market_id(pos);
    if (pid != account.market_id || pid != market_pool::pool_id(pool)) {
        abort errors::lp_market_mismatch()
    };
}

fun contains_position(v: &vector<ID>, target: ID): bool {
    let mut i = 0u64;
    while (i < vector::length(v)) {
        if (*vector::borrow(v, i) == target) {
            return true
        };
        i = i + 1;
    };
    false
}

fun find_position_index(v: &vector<ID>, target: ID): u64 {
    let mut i = 0u64;
    while (i < vector::length(v)) {
        if (*vector::borrow(v, i) == target) {
            return i
        };
        i = i + 1;
    };
    18446744073709551615
}

fun apply_position_liability(
    slots: &mut vector<u64>,
    pool: &MarketPool,
    pos: &Position,
    add: bool,
) {
    let len = vector::length(slots);
    let stake = position::stake_usdc(pos);
    let kind = position::contract_kind(pos);

    let mut k = 0u64;
    while (k < len) {
        let delta = liability_for_slot(pool, pos, kind, stake, k as u8);
        if (delta > 0) {
            let slot = vector::borrow_mut(slots, k);
            if (add) {
                *slot = *slot + delta;
            } else {
                if (*slot < delta) {
                    abort errors::out_of_bounds()
                };
                *slot = *slot - delta;
            };
        };
        k = k + 1;
    };
}

fun liability_for_slot(
    pool: &MarketPool,
    pos: &Position,
    kind: u8,
    stake: u64,
    slot: u8,
): u64 {
    if (
        position::is_linear_call(pos) ||
            position::is_linear_put(pos) ||
            position::is_straddle(pos) ||
            position::is_variance_swap(pos) ||
            position::is_structured_note(pos) ||
            position::is_range_note(pos) ||
            position::is_barrier_note(pos)
    ) {
        return risk::derivative_payout_usdc(
            kind,
            position::interval_a(pos),
            position::interval_b(pos),
            slot,
            stake,
        )
    };

    let payout = risk::position_payout_usdc(stake, position::entry_prob_ppb(pos));

    if (market_pool::is_normal(pool) && position::is_digital(pos)) {
        if (slot >= position::interval_a(pos)) payout else 0
    } else if (position::is_digital(pos)) {
        if (slot == position::interval_a(pos)) payout else 0
    } else {
        if (slot >= position::interval_a(pos) && slot <= position::interval_b(pos)) payout else 0
    }
}
