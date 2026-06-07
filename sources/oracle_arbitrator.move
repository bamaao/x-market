/// Pluggable arbitration for macro_oracle disputes (PRD §10.3.3).
/// Builtin: committee quorum → `execute_arbitration`.
/// UMA DVM: outbound events → off-chain relayer → `execute_uma_dvm_arbitration`.
module x_market::oracle_arbitrator;

use sui::clock::{Self, Clock};
use sui::coin::Coin;
use sui::event;
use x_market::config::{Self, AdminCap, GlobalConfig};
use x_market::usdc::USDC;
use x_market::errors;
use x_market::macro_oracle::{Self, DataAssertion, DataFeed, OracleConfig};
use x_market::market_pool::MarketPool;

const CASE_OPEN: u8 = 0;
const CASE_EXECUTED: u8 = 1;

const VERDICT_NONE: u8 = 0;
const VERDICT_PROPOSER_WINS: u8 = 1;
const VERDICT_DISPUTER_WINS: u8 = 2;
const VERDICT_UNRESOLVED: u8 = 3;

const ADAPTER_BUILTIN: u8 = 0;
const ADAPTER_UMA_DVM: u8 = 1;

const CASE_TTL_SECS: u64 = 604800; // 7 days

/// Multi-sig committee or UMA DVM relayer policy registered on OracleConfig.
public struct OracleArbitrator has key {
    id: UID,
    adapter_type: u8,
    committee: vector<address>,
    threshold: u8,
    uma_relayer_allowlist: vector<address>,
}

/// Emitted when a dispute opens a case (indexer / frontend discovery).
public struct ArbitrationCaseOpened has copy, drop {
    case_id: ID,
    assertion_id: ID,
    feed_id: ID,
    pool_id: ID,
    proposer: address,
    disputer: address,
    claimed_value: u64,
    adapter_type: u8,
}

/// Outbound hook for UMA DVM relayer (PRD §10.3.3.2 / uma2.md §3.4.2).
public struct UmaDvmArbitrationRequested has copy, drop {
    case_id: ID,
    assertion_id: ID,
    feed_id: ID,
    pool_id: ID,
    data_identifier: vector<u8>,
    claimed_value: u64,
    proposer: address,
    disputer: address,
}

/// One case per disputed assertion; created in the same transaction as `dispute_assertion`.
public struct ArbitrationCase has key {
    id: UID,
    assertion_id: ID,
    feed_id: ID,
    pool_id: ID,
    data_identifier: vector<u8>,
    claimed_value: u64,
    proposer: address,
    disputer: address,
    verdict_type: u8,
    resolved_value: u64,
    verdict_proposer: address,
    approvals: vector<address>,
    required_approvals: u8,
    status: u8,
    created_at: u64,
    expires_at: u64,
}

public fun case_open(): u8 { CASE_OPEN }
public fun case_executed(): u8 { CASE_EXECUTED }

public fun verdict_none(): u8 { VERDICT_NONE }
public fun verdict_proposer_wins(): u8 { VERDICT_PROPOSER_WINS }
public fun verdict_disputer_wins(): u8 { VERDICT_DISPUTER_WINS }
public fun verdict_unresolved(): u8 { VERDICT_UNRESOLVED }

public fun adapter_builtin(): u8 { ADAPTER_BUILTIN }
public fun adapter_uma_dvm(): u8 { ADAPTER_UMA_DVM }

public fun is_valid_adapter_type(adapter_type: u8): bool {
    adapter_type == ADAPTER_BUILTIN || adapter_type == ADAPTER_UMA_DVM
}

public fun is_valid_threshold(threshold: u8, signer_count: u64): bool {
    threshold > 0 && (threshold as u64) <= signer_count
}

public fun is_committee_member(arbitrator: &OracleArbitrator, member: address): bool {
    let mut i = 0;
    let n = vector::length(&arbitrator.committee);
    while (i < n) {
        if (*vector::borrow(&arbitrator.committee, i) == member) {
            return true
        };
        i = i + 1;
    };
    false
}

public fun is_uma_relayer(arbitrator: &OracleArbitrator, relayer: address): bool {
    let mut i = 0;
    let n = vector::length(&arbitrator.uma_relayer_allowlist);
    while (i < n) {
        if (*vector::borrow(&arbitrator.uma_relayer_allowlist, i) == relayer) {
            return true
        };
        i = i + 1;
    };
    false
}

public fun adapter_type_of(arbitrator: &OracleArbitrator): u8 {
    arbitrator.adapter_type
}

public fun quorum_reached(approval_count: u64, threshold: u8): bool {
    approval_count >= (threshold as u64)
}

public fun case_is_live(status: u8, now: u64, expires_at: u64): bool {
    status == CASE_OPEN && now <= expires_at
}

public fun can_propose_verdict(
    adapter_type: u8,
    status: u8,
    now: u64,
    expires_at: u64,
    verdict_type: u8,
): bool {
    if (adapter_type == ADAPTER_UMA_DVM) {
        return false
    };
    if (!case_is_live(status, now, expires_at)) {
        return false
    };
    verdict_type == VERDICT_PROPOSER_WINS ||
        verdict_type == VERDICT_DISPUTER_WINS ||
        verdict_type == VERDICT_UNRESOLVED
}

public fun can_approve_verdict(
    adapter_type: u8,
    status: u8,
    now: u64,
    expires_at: u64,
    case_verdict: u8,
    proposed_verdict: u8,
    case_resolved_value: u64,
    proposed_resolved_value: u64,
    already_approved: bool,
): bool {
    if (adapter_type == ADAPTER_UMA_DVM) {
        return false
    };
    case_is_live(status, now, expires_at) &&
        !already_approved &&
        case_verdict != VERDICT_NONE &&
        proposed_verdict == case_verdict &&
        (case_verdict != VERDICT_DISPUTER_WINS || case_resolved_value == proposed_resolved_value)
}

public fun can_execute_arbitration(
    adapter_type: u8,
    status: u8,
    now: u64,
    expires_at: u64,
    approval_count: u64,
    threshold: u8,
    verdict_type: u8,
): bool {
    if (adapter_type == ADAPTER_UMA_DVM) {
        return false
    };
    case_is_live(status, now, expires_at) &&
        verdict_type != VERDICT_NONE &&
        quorum_reached(approval_count, threshold)
}

public fun can_execute_uma_dvm(
    adapter_type: u8,
    status: u8,
    now: u64,
    expires_at: u64,
    verdict_type: u8,
): bool {
    adapter_type == ADAPTER_UMA_DVM &&
        case_is_live(status, now, expires_at) &&
        (verdict_type == VERDICT_PROPOSER_WINS ||
            verdict_type == VERDICT_DISPUTER_WINS ||
            verdict_type == VERDICT_UNRESOLVED)
}

public fun arbitrator_id(arbitrator: &OracleArbitrator): ID {
    object::id(arbitrator)
}

public fun case_assertion_id(case: &ArbitrationCase): ID {
    case.assertion_id
}

public fun case_status(case: &ArbitrationCase): u8 {
    case.status
}

public fun case_verdict_type(case: &ArbitrationCase): u8 {
    case.verdict_type
}

/// Builtin multi-sig committee (default Testnet path).
public entry fun create_oracle_arbitrator(
    config: &GlobalConfig,
    cap: &AdminCap,
    committee: vector<address>,
    threshold: u8,
    ctx: &mut TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    let count = vector::length(&committee);
    if (count == 0 || !is_valid_threshold(threshold, count)) {
        abort errors::out_of_bounds()
    };
    let arb = OracleArbitrator {
        id: object::new(ctx),
        adapter_type: ADAPTER_BUILTIN,
        committee,
        threshold,
        uma_relayer_allowlist: vector[],
    };
    transfer::share_object(arb);
}

/// UMA DVM adapter: relayer allowlist executes callback after off-chain DVM vote.
public entry fun create_uma_dvm_arbitrator(
    config: &GlobalConfig,
    cap: &AdminCap,
    relayer_allowlist: vector<address>,
    ctx: &mut TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    if (vector::length(&relayer_allowlist) == 0) {
        abort errors::out_of_bounds()
    };
    let arb = OracleArbitrator {
        id: object::new(ctx),
        adapter_type: ADAPTER_UMA_DVM,
        committee: vector[],
        threshold: 0,
        uma_relayer_allowlist: relayer_allowlist,
    };
    transfer::share_object(arb);
}

public entry fun update_uma_relayer_allowlist(
    config: &GlobalConfig,
    cap: &AdminCap,
    arbitrator: &mut OracleArbitrator,
    relayer_allowlist: vector<address>,
    ctx: &mut TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    if (arbitrator.adapter_type != ADAPTER_UMA_DVM) {
        abort errors::invalid_adapter()
    };
    if (vector::length(&relayer_allowlist) == 0) {
        abort errors::out_of_bounds()
    };
    arbitrator.uma_relayer_allowlist = relayer_allowlist;
}

/// Same PTB entry: dispute + open arbitration case (PRD §10.3.3.2 outbound).
public entry fun dispute_and_request_arbitration(
    oracle: &OracleConfig,
    feed: &DataFeed,
    pool: &MarketPool,
    assertion: &mut DataAssertion,
    arbitrator: &OracleArbitrator,
    bond: Coin<USDC>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let arb_id = object::id(arbitrator);
    macro_oracle::apply_dispute(
        oracle,
        feed,
        pool,
        assertion,
        arb_id,
        bond,
        clock,
        ctx,
    );
    request_arbitration(arbitrator, feed, pool, assertion, clock, ctx);
}

fun request_arbitration(
    arbitrator: &OracleArbitrator,
    feed: &DataFeed,
    _pool: &MarketPool,
    assertion: &DataAssertion,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let now = sui::clock::timestamp_ms(clock) / 1000;
    let assertion_id = object::id(assertion);
    if (macro_oracle::assertion_status(assertion) != macro_oracle::assertion_disputed()) {
        abort errors::not_disputed()
    };
    if (!macro_oracle::assertion_has_disputer(assertion)) {
        abort errors::not_disputed()
    };
    let adapter_type = arbitrator.adapter_type;
    let required = if (adapter_type == ADAPTER_BUILTIN) {
        arbitrator.threshold
    } else {
        0
    };
    let case = ArbitrationCase {
        id: object::new(ctx),
        assertion_id,
        feed_id: object::id(feed),
        pool_id: macro_oracle::feed_market_id(feed),
        data_identifier: macro_oracle::feed_identifier(feed),
        claimed_value: macro_oracle::assertion_claimed_value(assertion),
        proposer: macro_oracle::assertion_proposer(assertion),
        disputer: macro_oracle::assertion_disputer(assertion),
        verdict_type: VERDICT_NONE,
        resolved_value: 0,
        verdict_proposer: @0x0,
        approvals: vector[],
        required_approvals: required,
        status: CASE_OPEN,
        created_at: now,
        expires_at: now + CASE_TTL_SECS,
    };
    let case_id = object::id(&case);
    event::emit(ArbitrationCaseOpened {
        case_id,
        assertion_id,
        feed_id: object::id(feed),
        pool_id: macro_oracle::feed_market_id(feed),
        proposer: macro_oracle::assertion_proposer(assertion),
        disputer: macro_oracle::assertion_disputer(assertion),
        claimed_value: macro_oracle::assertion_claimed_value(assertion),
        adapter_type,
    });
    if (adapter_type == ADAPTER_UMA_DVM) {
        event::emit(UmaDvmArbitrationRequested {
            case_id,
            assertion_id,
            feed_id: object::id(feed),
            pool_id: macro_oracle::feed_market_id(feed),
            data_identifier: macro_oracle::feed_identifier(feed),
            claimed_value: macro_oracle::assertion_claimed_value(assertion),
            proposer: macro_oracle::assertion_proposer(assertion),
            disputer: macro_oracle::assertion_disputer(assertion),
        });
    };
    transfer::share_object(case);
}

public entry fun propose_verdict(
    arbitrator: &OracleArbitrator,
    case: &mut ArbitrationCase,
    verdict_type: u8,
    resolved_value: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();
    if (!is_committee_member(arbitrator, sender)) {
        abort errors::not_committee()
    };
    let now = sui::clock::timestamp_ms(clock) / 1000;
    if (
        !can_propose_verdict(
            arbitrator.adapter_type,
            case.status,
            now,
            case.expires_at,
            verdict_type,
        )
    ) {
        abort errors::uma_adapter_only_relayer()
    };
    if (verdict_type == VERDICT_DISPUTER_WINS && resolved_value == 0) {
        abort errors::out_of_bounds()
    };
    if (case.verdict_type == VERDICT_NONE) {
        case.verdict_type = verdict_type;
        case.resolved_value = resolved_value;
        case.verdict_proposer = sender;
        vector::push_back(&mut case.approvals, sender);
    } else if (
        case.verdict_type == verdict_type &&
            (verdict_type != VERDICT_DISPUTER_WINS || case.resolved_value == resolved_value)
    ) {
        if (!has_approval(&case.approvals, sender)) {
            vector::push_back(&mut case.approvals, sender);
        };
    } else {
        abort errors::verdict_mismatch()
    };
}

public entry fun approve_verdict(
    arbitrator: &OracleArbitrator,
    case: &mut ArbitrationCase,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();
    if (!is_committee_member(arbitrator, sender)) {
        abort errors::not_committee()
    };
    let now = sui::clock::timestamp_ms(clock) / 1000;
    let already = has_approval(&case.approvals, sender);
    if (
        !can_approve_verdict(
            arbitrator.adapter_type,
            case.status,
            now,
            case.expires_at,
            case.verdict_type,
            case.verdict_type,
            case.resolved_value,
            case.resolved_value,
            already,
        )
    ) {
        abort errors::uma_adapter_only_relayer()
    };
    vector::push_back(&mut case.approvals, sender);
}

/// Committee quorum reached → callback macro_oracle (builtin adapter only).
public entry fun execute_arbitration(
    arbitrator: &OracleArbitrator,
    oracle: &mut OracleConfig,
    case: &mut ArbitrationCase,
    feed: &mut DataFeed,
    pool: &mut MarketPool,
    assertion: &mut DataAssertion,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_authorized_arbitrator(oracle, arbitrator);
    let now = sui::clock::timestamp_ms(clock) / 1000;
    let approval_count = vector::length(&case.approvals);
    if (
        !can_execute_arbitration(
            arbitrator.adapter_type,
            case.status,
            now,
            case.expires_at,
            approval_count,
            case.required_approvals,
            case.verdict_type,
        )
    ) {
        abort errors::out_of_bounds()
    };
    let verdict_type = case.verdict_type;
    let resolved_value = case.resolved_value;
    finish_arbitration(
        oracle,
        case,
        feed,
        pool,
        assertion,
        verdict_type,
        resolved_value,
        ctx,
    );
}

/// Inbound UMA DVM callback path — allowlisted relayer only (uma2.md §3.4.2).
public entry fun execute_uma_dvm_arbitration(
    arbitrator: &OracleArbitrator,
    oracle: &mut OracleConfig,
    case: &mut ArbitrationCase,
    feed: &mut DataFeed,
    pool: &mut MarketPool,
    assertion: &mut DataAssertion,
    verdict_type: u8,
    resolved_value: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_authorized_arbitrator(oracle, arbitrator);
    if (!is_uma_relayer(arbitrator, ctx.sender())) {
        abort errors::not_uma_relayer()
    };
    let now = sui::clock::timestamp_ms(clock) / 1000;
    if (
        !can_execute_uma_dvm(
            arbitrator.adapter_type,
            case.status,
            now,
            case.expires_at,
            verdict_type,
        )
    ) {
        abort errors::out_of_bounds()
    };
    if (verdict_type == VERDICT_DISPUTER_WINS && resolved_value == 0) {
        abort errors::out_of_bounds()
    };
    finish_arbitration(
        oracle,
        case,
        feed,
        pool,
        assertion,
        verdict_type,
        resolved_value,
        ctx,
    );
}

fun finish_arbitration(
    oracle: &mut OracleConfig,
    case: &mut ArbitrationCase,
    feed: &mut DataFeed,
    pool: &mut MarketPool,
    assertion: &mut DataAssertion,
    verdict_type: u8,
    resolved_value: u64,
    ctx: &mut TxContext,
) {
    if (case.assertion_id != object::id(assertion)) {
        abort errors::out_of_bounds()
    };
    if (object::id(feed) != case.feed_id) {
        abort errors::out_of_bounds()
    };
    if (macro_oracle::feed_market_id(feed) != object::id(pool)) {
        abort errors::lp_market_mismatch()
    };
    macro_oracle::callback_arbitration_result(
        oracle,
        feed,
        pool,
        assertion,
        verdict_type,
        resolved_value,
        ctx,
    );
    case.status = CASE_EXECUTED;
    case.verdict_type = verdict_type;
    case.resolved_value = resolved_value;
}

fun assert_authorized_arbitrator(oracle: &OracleConfig, arbitrator: &OracleArbitrator) {
    macro_oracle::assert_authorized_arbitrator(oracle, object::id(arbitrator));
}

fun has_approval(approvals: &vector<address>, member: address): bool {
    let mut i = 0;
    let n = vector::length(approvals);
    while (i < n) {
        if (*vector::borrow(approvals, i) == member) {
            return true
        };
        i = i + 1;
    };
    false
}
