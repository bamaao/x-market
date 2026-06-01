/// Phase 3 slashing mechanism:
/// - emergency direct slash by admin
/// - optional multisig proposal/approval/execute path.
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

public struct SlashGovernance has key {
    id: UID,
    signers: vector<address>,
    threshold: u8,
    next_request_nonce: u64,
}

public struct SlashRequest has key {
    id: UID,
    market_id: ID,
    amount_usdc: u64,
    reason_code: u64,
    recipient: address,
    proposer: address,
    approvals: vector<address>,
    required_approvals: u8,
    created_at: u64,
    expires_at: u64,
    nonce: u64,
    executed: bool,
}

const SLASH_TIMELOCK_SECS: u64 = 1800;
const SLASH_MAX_SINGLE_BPS: u64 = 3000; // 30%
const SLASH_MAX_CYCLE_BPS: u64 = 5000; // 50%
const SLASH_REQUEST_TTL_SECS: u64 = 86400;

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

public fun slash_request_ttl_secs(): u64 {
    SLASH_REQUEST_TTL_SECS
}

public fun within_bps_limit(amount_usdc: u64, base_collateral_usdc: u64, limit_bps: u64): bool {
    if (base_collateral_usdc == 0) {
        return false
    };
    amount_usdc * 10_000 <= base_collateral_usdc * limit_bps
}

public fun is_valid_threshold(threshold: u8, signer_count: u64): bool {
    threshold > 0 && (threshold as u64) <= signer_count
}

public fun quorum_reached(approval_count: u64, threshold: u8): bool {
    approval_count >= (threshold as u64)
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
    execute_slash(pool, amount_usdc, reason_code, recipient, clock, ctx.sender(), ctx);
}

public entry fun init_slash_governance(
    config: &GlobalConfig,
    cap: &AdminCap,
    signers: vector<address>,
    threshold: u8,
    ctx: &mut TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    if (!is_valid_threshold(threshold, vector::length(&signers))) {
        abort errors::out_of_bounds()
    };
    assert_unique_addresses(&signers);
    let gov = SlashGovernance {
        id: object::new(ctx),
        signers,
        threshold,
        next_request_nonce: 1,
    };
    transfer::share_object(gov);
}

public entry fun update_slash_governance(
    config: &GlobalConfig,
    cap: &AdminCap,
    gov: &mut SlashGovernance,
    signers: vector<address>,
    threshold: u8,
    ctx: &TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    if (!is_valid_threshold(threshold, vector::length(&signers))) {
        abort errors::out_of_bounds()
    };
    assert_unique_addresses(&signers);
    gov.signers = signers;
    gov.threshold = threshold;
}

public entry fun propose_slash_request(
    gov: &mut SlashGovernance,
    pool: &MarketPool,
    amount_usdc: u64,
    reason_code: u64,
    recipient: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_signer(gov, ctx.sender());
    if (!can_slash(amount_usdc, market_pool::collateral_value(pool))) {
        abort errors::out_of_bounds()
    };
    let now = clock::timestamp_ms(clock) / 1000;
    let req = SlashRequest {
        id: object::new(ctx),
        market_id: market_pool::pool_id(pool),
        amount_usdc,
        reason_code,
        recipient,
        proposer: ctx.sender(),
        approvals: vector[ctx.sender()],
        required_approvals: gov.threshold,
        created_at: now,
        expires_at: now + SLASH_REQUEST_TTL_SECS,
        nonce: gov.next_request_nonce,
        executed: false,
    };
    gov.next_request_nonce = gov.next_request_nonce + 1;
    transfer::share_object(req);
}

public entry fun approve_slash_request(
    gov: &SlashGovernance,
    req: &mut SlashRequest,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert_signer(gov, ctx.sender());
    assert_request_live(req, clock::timestamp_ms(clock) / 1000);
    if (contains_address(&req.approvals, ctx.sender())) {
        abort errors::out_of_bounds()
    };
    vector::push_back(&mut req.approvals, ctx.sender());
}

public entry fun execute_slash_request(
    gov: &SlashGovernance,
    pool: &mut MarketPool,
    req: &mut SlashRequest,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_signer(gov, ctx.sender());
    assert_request_live(req, clock::timestamp_ms(clock) / 1000);
    if (req.market_id != market_pool::pool_id(pool)) {
        abort errors::lp_market_mismatch()
    };
    let approvals = active_approval_count(gov, req);
    if (!quorum_reached(approvals, req.required_approvals)) {
        abort errors::out_of_bounds()
    };
    execute_slash(
        pool,
        req.amount_usdc,
        req.reason_code,
        req.recipient,
        clock,
        ctx.sender(),
        ctx,
    );
    req.executed = true;
}

fun execute_slash(
    pool: &mut MarketPool,
    amount_usdc: u64,
    reason_code: u64,
    recipient: address,
    clock: &Clock,
    slashed_by: address,
    ctx: &mut TxContext,
) {
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
        slashed_by,
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

fun assert_signer(gov: &SlashGovernance, signer: address) {
    if (!contains_address(&gov.signers, signer)) {
        abort errors::not_admin()
    };
}

fun assert_request_live(req: &SlashRequest, now: u64) {
    if (req.executed || now > req.expires_at) {
        abort errors::out_of_bounds()
    };
}

fun active_approval_count(gov: &SlashGovernance, req: &SlashRequest): u64 {
    let mut i = 0u64;
    let mut count = 0u64;
    while (i < vector::length(&req.approvals)) {
        let signer = *vector::borrow(&req.approvals, i);
        if (contains_address(&gov.signers, signer)) {
            count = count + 1;
        };
        i = i + 1;
    };
    count
}

fun contains_address(v: &vector<address>, target: address): bool {
    let mut i = 0u64;
    while (i < vector::length(v)) {
        if (*vector::borrow(v, i) == target) {
            return true
        };
        i = i + 1;
    };
    false
}

fun assert_unique_addresses(v: &vector<address>) {
    let len = vector::length(v);
    let mut i = 0u64;
    while (i < len) {
        let a = *vector::borrow(v, i);
        let mut j = i + 1;
        while (j < len) {
            if (*vector::borrow(v, j) == a) {
                abort errors::out_of_bounds()
            };
            j = j + 1;
        };
        i = i + 1;
    };
}
