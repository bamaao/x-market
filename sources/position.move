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

public struct Position has key, store {
    id: UID,
    owner: address,
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
    owner: address,
    market_id: ID,
    interval_a: u8,
    interval_b: u8,
    stake_usdc: u64,
    entry_prob_ppb: u64,
    ctx: &mut TxContext,
): Position {
    Position {
        id: object::new(ctx),
        owner,
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
    owner: address,
    market_id: ID,
    outcome: u8,
    stake_usdc: u64,
    entry_prob_ppb: u64,
    ctx: &mut TxContext,
): Position {
    Position {
        id: object::new(ctx),
        owner,
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
    owner: address,
    market_id: ID,
    contract_kind: u8,
    strike_slot: u8,
    stake_usdc: u64,
    ctx: &mut TxContext,
): Position {
    Position {
        id: object::new(ctx),
        owner,
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

public fun owner(pos: &Position): address {
    pos.owner
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

public fun linear_call_kind(): u8 { CONTRACT_LINEAR_CALL }
public fun linear_put_kind(): u8 { CONTRACT_LINEAR_PUT }
public fun straddle_kind(): u8 { CONTRACT_STRADDLE }

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
