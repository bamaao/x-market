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

module x_market::position;

/// Poisson / Normal interval [a, b] on discrete k or unit bins.
const CONTRACT_INTERVAL: u8 = 0;
/// Digital: exact k (Poisson), category i (Dirichlet), or threshold (Normal).
const CONTRACT_DIGITAL: u8 = 1;
/// Linear Call: max(X-K, 0), approximated on discrete slots.
const CONTRACT_LINEAR_CALL: u8 = 2;
/// Linear Put: max(K-X, 0), approximated on discrete slots.
const CONTRACT_LINEAR_PUT: u8 = 3;
/// Straddle: |X-K|, approximated on discrete slots.
const CONTRACT_STRADDLE: u8 = 4;
/// Variance Swap: (X-K)^2, approximated on discrete slots.
const CONTRACT_VARIANCE_SWAP: u8 = 5;
/// Structured Note: capped call payoff min(max(X-K, 0), C-K).
const CONTRACT_STRUCTURED_NOTE: u8 = 6;
/// Structured Note: range note pays fixed coupon if X in [L, U].
const CONTRACT_RANGE_NOTE: u8 = 7;
/// Structured Note: digital barrier note pays fixed coupon if X >= B.
const CONTRACT_BARRIER_NOTE: u8 = 8;

public struct Position has key, store {
    id: UID,
    market_id: ID,
    contract_kind: u8,
    /// Poisson/Normal interval low; Dirichlet category; digital strike k/index.
    interval_a: u8,
    /// Poisson/Normal interval high; digital same as a when single-point.
    interval_b: u8,
    stake_usdc: u64,
    entry_prob_ppb: u64,
    settled: bool,
    claimed: bool,
}

public(package) fun new_interval(
    market_id: ID,
    interval_a: u8,
    interval_b: u8,
    stake_usdc: u64,
    entry_prob_ppb: u64,
    ctx: &mut TxContext,
): Position {
    Position {
        id: object::new(ctx),
        market_id,
        contract_kind: CONTRACT_INTERVAL,
        interval_a,
        interval_b,
        stake_usdc,
        entry_prob_ppb,
        settled: false,
        claimed: false,
    }
}

public(package) fun new_digital(
    market_id: ID,
    outcome: u8,
    stake_usdc: u64,
    entry_prob_ppb: u64,
    ctx: &mut TxContext,
): Position {
    Position {
        id: object::new(ctx),
        market_id,
        contract_kind: CONTRACT_DIGITAL,
        interval_a: outcome,
        interval_b: outcome,
        stake_usdc,
        entry_prob_ppb,
        settled: false,
        claimed: false,
    }
}

public(package) fun new_linear(
    market_id: ID,
    contract_kind: u8,
    strike_slot: u8,
    stake_usdc: u64,
    ctx: &mut TxContext,
): Position {
    Position {
        id: object::new(ctx),
        market_id,
        contract_kind,
        interval_a: strike_slot,
        interval_b: strike_slot,
        stake_usdc,
        // linear products do not use probability quote at claim stage
        entry_prob_ppb: 1_000_000_000,
        settled: false,
        claimed: false,
    }
}

public(package) fun new_structured_note(
    market_id: ID,
    strike_slot: u8,
    cap_slot: u8,
    stake_usdc: u64,
    ctx: &mut TxContext,
): Position {
    Position {
        id: object::new(ctx),
        market_id,
        contract_kind: CONTRACT_STRUCTURED_NOTE,
        interval_a: strike_slot,
        interval_b: cap_slot,
        stake_usdc,
        entry_prob_ppb: 1_000_000_000,
        settled: false,
        claimed: false,
    }
}

public(package) fun new_range_note(
    market_id: ID,
    lower_slot: u8,
    upper_slot: u8,
    stake_usdc: u64,
    ctx: &mut TxContext,
): Position {
    Position {
        id: object::new(ctx),
        market_id,
        contract_kind: CONTRACT_RANGE_NOTE,
        interval_a: lower_slot,
        interval_b: upper_slot,
        stake_usdc,
        entry_prob_ppb: 1_000_000_000,
        settled: false,
        claimed: false,
    }
}

public(package) fun new_barrier_note(
    market_id: ID,
    barrier_slot: u8,
    stake_usdc: u64,
    ctx: &mut TxContext,
): Position {
    Position {
        id: object::new(ctx),
        market_id,
        contract_kind: CONTRACT_BARRIER_NOTE,
        interval_a: barrier_slot,
        interval_b: barrier_slot,
        stake_usdc,
        entry_prob_ppb: 1_000_000_000,
        settled: false,
        claimed: false,
    }
}

public fun market_id(pos: &Position): ID {
    pos.market_id
}

public fun position_id(pos: &Position): ID {
    object::id(pos)
}

public fun stake_usdc(pos: &Position): u64 {
    pos.stake_usdc
}

public fun entry_prob_ppb(pos: &Position): u64 {
    pos.entry_prob_ppb
}

public fun contract_kind(pos: &Position): u8 {
    pos.contract_kind
}

public fun interval_a(pos: &Position): u8 {
    pos.interval_a
}

public fun interval_b(pos: &Position): u8 {
    pos.interval_b
}

public fun is_digital(pos: &Position): bool {
    pos.contract_kind == CONTRACT_DIGITAL
}

public fun is_linear_call(pos: &Position): bool {
    pos.contract_kind == CONTRACT_LINEAR_CALL
}

public fun is_linear_put(pos: &Position): bool {
    pos.contract_kind == CONTRACT_LINEAR_PUT
}

public fun is_straddle(pos: &Position): bool {
    pos.contract_kind == CONTRACT_STRADDLE
}

public fun is_variance_swap(pos: &Position): bool {
    pos.contract_kind == CONTRACT_VARIANCE_SWAP
}

public fun is_structured_note(pos: &Position): bool {
    pos.contract_kind == CONTRACT_STRUCTURED_NOTE
}

public fun is_range_note(pos: &Position): bool {
    pos.contract_kind == CONTRACT_RANGE_NOTE
}

public fun is_barrier_note(pos: &Position): bool {
    pos.contract_kind == CONTRACT_BARRIER_NOTE
}

public fun linear_call_kind(): u8 { CONTRACT_LINEAR_CALL }
public fun linear_put_kind(): u8 { CONTRACT_LINEAR_PUT }
public fun straddle_kind(): u8 { CONTRACT_STRADDLE }
public fun variance_swap_kind(): u8 { CONTRACT_VARIANCE_SWAP }
public fun structured_note_kind(): u8 { CONTRACT_STRUCTURED_NOTE }
public fun range_note_kind(): u8 { CONTRACT_RANGE_NOTE }
public fun barrier_note_kind(): u8 { CONTRACT_BARRIER_NOTE }

public fun is_claimed(pos: &Position): bool {
    pos.claimed
}

public(package) fun mark_claimed(pos: &mut Position) {
    pos.claimed = true;
}

public fun transfer_to_sender(pos: Position, ctx: &TxContext) {
    transfer::public_transfer(pos, ctx.sender());
}

public fun destroy_after_claim(pos: Position) {
    let Position { id, .. } = pos;
    object::delete(id);
}
