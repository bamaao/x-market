/// Optimistic macro-data oracle (PRD §10):
/// propose -> liveness -> (optional dispute + oracle_arbitrator committee callback) -> finalize.
module x_market::macro_oracle;

use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::dynamic_field as df;
use x_market::config::{Self, AdminCap, GlobalConfig};
use x_market::errors;
use x_market::market_pool::{Self, MarketPool};
use x_market::risk;
use x_market::usdc::USDC;

const FEED_OPEN: u8 = 0;
const FEED_FINALIZED: u8 = 1;
const FEED_NULLIFIED: u8 = 2;

/// In_Arbitration (PRD §10.5): dispute window closed, awaiting arbitrator callback.
const ASSERTION_PROPOSED: u8 = 0;
const ASSERTION_DISPUTED: u8 = 1;
const ASSERTION_FINALIZED: u8 = 2;
const ASSERTION_REJECTED: u8 = 3;

const NULLIFY_AFTER_EVENT_SECS: u64 = 259200; // 72h
const SLASH_WINNER_SHARE_BPS: u64 = 5000;
const VERDICT_PROPOSER_WINS: u8 = 1;
const VERDICT_DISPUTER_WINS: u8 = 2;
const VERDICT_UNRESOLVED: u8 = 3;
const MAX_IDENTIFIER_LEN: u64 = 64;
const MAX_ANCILLARY_LEN: u64 = 512;

/// Maps `market_id` (MarketPool) → `DataFeed` object id for O(1) on-chain discovery.
public struct FeedRegistry has key {
    id: UID,
}

public struct OracleConfig has key {
    id: UID,
    minimum_bond: u64,
    default_liveness_secs: u64,
    feed_registry_id: ID,
    /// Authorized `OracleArbitrator` shared object (committee / pluggable DVM adapter).
    arbitrator_id: option::Option<ID>,
    treasury: Balance<USDC>,
}

/// Registered macro indicator linked to a market pool for settlement.
public struct DataFeed has key {
    id: UID,
    identifier: vector<u8>,
    market_id: ID,
    event_ts: u64,
    liveness_secs: u64,
    bond_required: u64,
    ancillary_data: vector<u8>,
    feed_status: u8,
    finalized_value: u64,
    active_assertion: option::Option<ID>,
}

public struct DataAssertion has key {
    id: UID,
    feed_id: ID,
    proposer: address,
    claimed_value: u64,
    proposed_at: u64,
    liveness_end_at: u64,
    status: u8,
    proposer_bond: Balance<USDC>,
    disputer: option::Option<address>,
    disputer_bond: Balance<USDC>,
}

public fun feed_open(): u8 { FEED_OPEN }
public fun feed_finalized(): u8 { FEED_FINALIZED }
public fun feed_nullified(): u8 { FEED_NULLIFIED }

public fun assertion_proposed(): u8 { ASSERTION_PROPOSED }
public fun assertion_disputed(): u8 { ASSERTION_DISPUTED }
public fun assertion_finalized(): u8 { ASSERTION_FINALIZED }
public fun assertion_rejected(): u8 { ASSERTION_REJECTED }

public fun nullify_after_event_secs(): u64 { NULLIFY_AFTER_EVENT_SECS }

public fun is_valid_identifier_len(len: u64): bool {
    len > 0 && len <= MAX_IDENTIFIER_LEN
}

public fun is_valid_ancillary_len(len: u64): bool {
    len <= MAX_ANCILLARY_LEN
}

public fun can_propose(
    feed_status: u8,
    has_active_assertion: bool,
    pool_resolved: bool,
    now: u64,
    event_ts: u64,
): bool {
    feed_status == FEED_OPEN &&
        !has_active_assertion &&
        !pool_resolved &&
        now >= event_ts
}

public fun can_dispute(
    assertion_status: u8,
    now: u64,
    liveness_end_at: u64,
    feed_finalized: bool,
): bool {
    !feed_finalized &&
        assertion_status == ASSERTION_PROPOSED &&
        now <= liveness_end_at
}

public fun can_finalize_assertion(
    assertion_status: u8,
    now: u64,
    liveness_end_at: u64,
): bool {
    assertion_status == ASSERTION_PROPOSED && now > liveness_end_at
}

public fun can_nullify_feed(
    feed_status: u8,
    has_active_assertion: bool,
    now: u64,
    event_ts: u64,
): bool {
    feed_status == FEED_OPEN &&
        !has_active_assertion &&
        now >= event_ts + NULLIFY_AFTER_EVENT_SECS
}

public fun assert_valid_resolution(pool: &MarketPool, value: u64) {
    if (market_pool::is_poisson(pool) || market_pool::is_dirichlet(pool)) {
        if (!risk::is_valid_slot(value)) {
            abort errors::out_of_bounds()
        };
        if (
            market_pool::is_dirichlet(pool) &&
                value >= (market_pool::dirichlet_len(pool) as u64)
        ) {
            abort errors::out_of_bounds()
        };
    };
}

public entry fun create_oracle_config(
    config: &GlobalConfig,
    cap: &AdminCap,
    minimum_bond: u64,
    default_liveness_secs: u64,
    ctx: &mut TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    if (minimum_bond == 0 || default_liveness_secs == 0) {
        abort errors::out_of_bounds()
    };
    let registry = FeedRegistry {
        id: object::new(ctx),
    };
    let registry_id = object::id(&registry);
    transfer::share_object(registry);
    let oracle = OracleConfig {
        id: object::new(ctx),
        minimum_bond,
        default_liveness_secs,
        feed_registry_id: registry_id,
        arbitrator_id: option::none(),
        treasury: balance::zero(),
    };
    transfer::share_object(oracle);
}

public fun feed_registry_id(oracle: &OracleConfig): ID {
    oracle.feed_registry_id
}

/// On-chain discovery: `market_id` → `DataFeed` id (PRD auto-register model).
public fun lookup_feed_by_market(registry: &FeedRegistry, market_id: ID): option::Option<ID> {
    if (df::exists(&registry.id, market_id)) {
        option::some(*df::borrow(&registry.id, market_id))
    } else {
        option::none()
    }
}

public fun has_feed_for_market(registry: &FeedRegistry, market_id: ID): bool {
    df::exists(&registry.id, market_id)
}

/// Read-only entry for off-chain discovery (`devInspect`).
public entry fun lookup_feed_entry(
    registry: &FeedRegistry,
    market_id: ID,
    _ctx: &mut TxContext,
): option::Option<ID> {
    lookup_feed_by_market(registry, market_id)
}

public entry fun set_oracle_arbitrator(
    config: &GlobalConfig,
    cap: &AdminCap,
    oracle: &mut OracleConfig,
    arbitrator_id: ID,
    ctx: &mut TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    oracle.arbitrator_id = option::some(arbitrator_id);
}

public fun oracle_arbitrator_id(oracle: &OracleConfig): option::Option<ID> {
    oracle.arbitrator_id
}

/// Permissionless: pool creator registers settlement feed (one per market).
public entry fun register_data_feed_for_pool(
    oracle: &OracleConfig,
    registry: &mut FeedRegistry,
    pool: &MarketPool,
    identifier: vector<u8>,
    event_ts: u64,
    liveness_secs: u64,
    bond_required: u64,
    ancillary_data: vector<u8>,
    ctx: &mut TxContext,
) {
    if (ctx.sender() != market_pool::authority(pool)) {
        abort errors::not_pool_authority()
    };
    register_feed_internal(
        oracle,
        registry,
        pool,
        identifier,
        event_ts,
        liveness_secs,
        bond_required,
        ancillary_data,
        ctx,
    );
}

/// Legacy admin path (governance override / migration).
public entry fun register_data_feed(
    config: &GlobalConfig,
    cap: &AdminCap,
    oracle: &OracleConfig,
    registry: &mut FeedRegistry,
    pool: &MarketPool,
    identifier: vector<u8>,
    event_ts: u64,
    liveness_secs: u64,
    bond_required: u64,
    ancillary_data: vector<u8>,
    ctx: &mut TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    register_feed_internal(
        oracle,
        registry,
        pool,
        identifier,
        event_ts,
        liveness_secs,
        bond_required,
        ancillary_data,
        ctx,
    );
}

/// Called from `pool::create_*_with_feed` in the same PTB as `share_pool`.
public(package) fun register_feed_for_pool(
    oracle: &OracleConfig,
    registry: &mut FeedRegistry,
    pool: &MarketPool,
    identifier: vector<u8>,
    event_ts: u64,
    liveness_secs: u64,
    bond_required: u64,
    ancillary_data: vector<u8>,
    ctx: &mut TxContext,
) {
    register_feed_internal(
        oracle,
        registry,
        pool,
        identifier,
        event_ts,
        liveness_secs,
        bond_required,
        ancillary_data,
        ctx,
    );
}

fun register_feed_internal(
    oracle: &OracleConfig,
    registry: &mut FeedRegistry,
    pool: &MarketPool,
    identifier: vector<u8>,
    event_ts: u64,
    liveness_secs: u64,
    bond_required: u64,
    ancillary_data: vector<u8>,
    ctx: &mut TxContext,
) {
    if (!is_valid_identifier_len(vector::length(&identifier))) {
        abort errors::out_of_bounds()
    };
    if (!is_valid_ancillary_len(vector::length(&ancillary_data))) {
        abort errors::out_of_bounds()
    };
    let market_id = market_pool::pool_id(pool);
    if (df::exists(&registry.id, market_id)) {
        abort errors::feed_already_exists()
    };
    let maturity = market_pool::maturity_ts(pool);
    let event = if (event_ts == 0) {
        maturity
    } else {
        event_ts
    };
    if (event < maturity) {
        abort errors::out_of_bounds()
    };
    let liveness = if (liveness_secs == 0) {
        oracle.default_liveness_secs
    } else {
        liveness_secs
    };
    let bond = if (bond_required == 0) {
        oracle.minimum_bond
    } else {
        bond_required
    };
    if (bond < oracle.minimum_bond) {
        abort errors::bond_too_low()
    };
    let feed = DataFeed {
        id: object::new(ctx),
        identifier,
        market_id,
        event_ts: event,
        liveness_secs: liveness,
        bond_required: bond,
        ancillary_data,
        feed_status: FEED_OPEN,
        finalized_value: 0,
        active_assertion: option::none(),
    };
    let feed_id = object::id(&feed);
    transfer::share_object(feed);
    df::add(&mut registry.id, market_id, feed_id);
}

public entry fun propose_data(
    feed: &mut DataFeed,
    pool: &MarketPool,
    bond: Coin<USDC>,
    claimed_value: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let now = sui::clock::timestamp_ms(clock) / 1000;
    let has_active = feed.active_assertion.is_some();
    if (
        !can_propose(
            feed.feed_status,
            has_active,
            market_pool::is_resolved(pool),
            now,
            feed.event_ts,
        )
    ) {
        if (feed.feed_status == FEED_NULLIFIED) {
            abort errors::feed_nullified()
        };
        if (now < feed.event_ts) {
            abort errors::event_not_occurred()
        };
        abort errors::assertion_active()
    };
    if (market_pool::pool_id(pool) != feed.market_id) {
        abort errors::lp_market_mismatch()
    };
    if (coin::value(&bond) < feed.bond_required) {
        abort errors::bond_too_low()
    };
    assert_valid_resolution(pool, claimed_value);
    let liveness_end = now + feed.liveness_secs;
    let mut assertion = DataAssertion {
        id: object::new(ctx),
        feed_id: object::id(feed),
        proposer: ctx.sender(),
        claimed_value,
        proposed_at: now,
        liveness_end_at: liveness_end,
        status: ASSERTION_PROPOSED,
        proposer_bond: coin::into_balance(bond),
        disputer: option::none(),
        disputer_bond: balance::zero(),
    };
    let assertion_id = object::id(&assertion);
    feed.active_assertion = option::some(assertion_id);
    transfer::share_object(assertion);
}

/// Called from `oracle_arbitrator::dispute_and_request` in the same PTB.
public(package) fun apply_dispute(
    oracle: &OracleConfig,
    feed: &DataFeed,
    pool: &MarketPool,
    assertion: &mut DataAssertion,
    arbitrator_id: ID,
    bond: Coin<USDC>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_authorized_arbitrator(oracle, arbitrator_id);
    let now = sui::clock::timestamp_ms(clock) / 1000;
    if (object::id(feed) != assertion.feed_id) {
        abort errors::out_of_bounds()
    };
    if (market_pool::pool_id(pool) != feed.market_id) {
        abort errors::lp_market_mismatch()
    };
    if (
        !can_dispute(
            assertion.status,
            now,
            assertion.liveness_end_at,
            feed.feed_status == FEED_FINALIZED,
        )
    ) {
        abort errors::not_disputed()
    };
    if (coin::value(&bond) < balance::value(&assertion.proposer_bond)) {
        abort errors::bond_too_low()
    };
    assertion.status = ASSERTION_DISPUTED;
    assertion.disputer = option::some(ctx.sender());
    balance::join(&mut assertion.disputer_bond, coin::into_balance(bond));
}

public entry fun finalize_assertion(
    feed: &mut DataFeed,
    pool: &mut MarketPool,
    assertion: &mut DataAssertion,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let now = sui::clock::timestamp_ms(clock) / 1000;
    assert_feed_assertion_match(feed, assertion);
    if (assertion.status == ASSERTION_DISPUTED) {
        abort errors::disputed()
    };
    if (!can_finalize_assertion(assertion.status, now, assertion.liveness_end_at)) {
        abort errors::liveness_active()
    };
    if (market_pool::pool_id(pool) != feed.market_id) {
        abort errors::lp_market_mismatch()
    };
    if (market_pool::is_resolved(pool)) {
        abort errors::already_finalized()
    };
    let value = assertion.claimed_value;
    assert_valid_resolution(pool, value);
    market_pool::set_resolution(pool, value);
    feed.feed_status = FEED_FINALIZED;
    feed.finalized_value = value;
    feed.active_assertion = option::none();
    assertion.status = ASSERTION_FINALIZED;
    let proposer = assertion.proposer;
    let bond = balance::withdraw_all(&mut assertion.proposer_bond);
    transfer::public_transfer(coin::from_balance(bond, ctx), proposer);
}

/// Inbound callback from authorized `oracle_arbitrator` only (PRD §10.3.3.2).
public(package) fun callback_arbitration_result(
    oracle: &mut OracleConfig,
    feed: &mut DataFeed,
    pool: &mut MarketPool,
    assertion: &mut DataAssertion,
    verdict_type: u8,
    resolved_value: u64,
    ctx: &mut TxContext,
) {
    assert_feed_assertion_match(feed, assertion);
    if (assertion.status != ASSERTION_DISPUTED) {
        abort errors::not_disputed()
    };
    if (market_pool::pool_id(pool) != feed.market_id) {
        abort errors::lp_market_mismatch()
    };
    if (market_pool::is_resolved(pool)) {
        abort errors::already_finalized()
    };
    let proposer = assertion.proposer;
    let disputer = assertion_disputer(assertion);
    feed.active_assertion = option::none();
    if (verdict_type == VERDICT_PROPOSER_WINS) {
        let claimed_value = assertion.claimed_value;
        assert_valid_resolution(pool, claimed_value);
        market_pool::set_resolution(pool, claimed_value);
        feed.feed_status = FEED_FINALIZED;
        feed.finalized_value = claimed_value;
        assertion.status = ASSERTION_FINALIZED;
        refund_bond(&mut assertion.proposer_bond, proposer, ctx);
        refund_bond(&mut assertion.disputer_bond, disputer, ctx);
    } else if (verdict_type == VERDICT_DISPUTER_WINS) {
        assert_valid_resolution(pool, resolved_value);
        market_pool::set_resolution(pool, resolved_value);
        feed.feed_status = FEED_FINALIZED;
        feed.finalized_value = resolved_value;
        assertion.status = ASSERTION_FINALIZED;
        slash_loser_to_winner_and_treasury(
            &mut assertion.proposer_bond,
            &mut oracle.treasury,
            disputer,
            ctx,
        );
        refund_bond(&mut assertion.disputer_bond, disputer, ctx);
    } else if (verdict_type == VERDICT_UNRESOLVED) {
        feed.feed_status = FEED_NULLIFIED;
        assertion.status = ASSERTION_REJECTED;
        refund_bond(&mut assertion.proposer_bond, proposer, ctx);
        refund_bond(&mut assertion.disputer_bond, disputer, ctx);
    } else {
        abort errors::out_of_bounds()
    };
}

public entry fun nullify_feed(
    feed: &mut DataFeed,
    clock: &Clock,
    _ctx: &mut TxContext,
) {
    let now = sui::clock::timestamp_ms(clock) / 1000;
    if (
        !can_nullify_feed(
            feed.feed_status,
            feed.active_assertion.is_some(),
            now,
            feed.event_ts,
        )
    ) {
        abort errors::out_of_bounds()
    };
    feed.feed_status = FEED_NULLIFIED;
}

/// Consumer read: reverts unless feed is finalized.
public fun get_finalized_value(feed: &DataFeed): u64 {
    if (feed.feed_status != FEED_FINALIZED) {
        abort errors::not_finalized()
    };
    feed.finalized_value
}

public fun feed_status(feed: &DataFeed): u8 {
    feed.feed_status
}

public fun feed_market_id(feed: &DataFeed): ID {
    feed.market_id
}

public fun assertion_status(assertion: &DataAssertion): u8 {
    assertion.status
}

public fun assertion_claimed_value(assertion: &DataAssertion): u64 {
    assertion.claimed_value
}

public fun assertion_liveness_end_at(assertion: &DataAssertion): u64 {
    assertion.liveness_end_at
}

public fun feed_identifier(feed: &DataFeed): vector<u8> {
    feed.identifier
}

public fun feed_event_ts(feed: &DataFeed): u64 {
    feed.event_ts
}

public fun feed_bond_required(feed: &DataFeed): u64 {
    feed.bond_required
}

public fun feed_liveness_secs(feed: &DataFeed): u64 {
    feed.liveness_secs
}

public fun feed_ancillary_data(feed: &DataFeed): vector<u8> {
    feed.ancillary_data
}

public fun feed_active_assertion_id(feed: &DataFeed): option::Option<ID> {
    feed.active_assertion
}

public fun assertion_proposer(assertion: &DataAssertion): address {
    assertion.proposer
}

public fun assertion_proposed_at(assertion: &DataAssertion): u64 {
    assertion.proposed_at
}

public fun assertion_feed_id(assertion: &DataAssertion): ID {
    assertion.feed_id
}

public fun assertion_has_disputer(assertion: &DataAssertion): bool {
    assertion.disputer.is_some()
}

public fun assertion_disputer(assertion: &DataAssertion): address {
    *option::borrow(&assertion.disputer)
}

public fun assert_authorized_arbitrator(oracle: &OracleConfig, arbitrator_id: ID) {
    if (oracle.arbitrator_id.is_none()) {
        abort errors::not_arbitrator()
    };
    let expected = *option::borrow(&oracle.arbitrator_id);
    if (expected != arbitrator_id) {
        abort errors::not_arbitrator()
    };
}

fun assert_feed_assertion_match(feed: &DataFeed, assertion: &DataAssertion) {
    if (object::id(feed) != assertion.feed_id) {
        abort errors::out_of_bounds()
    };
    if (feed.active_assertion.is_none()) {
        abort errors::out_of_bounds()
    };
    let active = *option::borrow(&feed.active_assertion);
    if (active != object::id(assertion)) {
        abort errors::out_of_bounds()
    };
}

fun refund_bond(
    bond: &mut Balance<USDC>,
    recipient: address,
    ctx: &mut TxContext,
) {
    let coin = balance::withdraw_all(bond);
    transfer::public_transfer(coin::from_balance(coin, ctx), recipient);
}

fun slash_loser_to_winner_and_treasury(
    loser_bond: &mut Balance<USDC>,
    treasury: &mut Balance<USDC>,
    winner: address,
    ctx: &mut TxContext,
) {
    let total = balance::value(loser_bond);
    let winner_amt = total * SLASH_WINNER_SHARE_BPS / 10000;
    let protocol_amt = total - winner_amt;
    if (winner_amt > 0) {
        let winner_coin = balance::split(loser_bond, winner_amt);
        transfer::public_transfer(coin::from_balance(winner_coin, ctx), winner);
    };
    if (protocol_amt > 0) {
        let protocol_coin = balance::split(loser_bond, protocol_amt);
        balance::join(treasury, protocol_coin);
    };
    if (balance::value(loser_bond) > 0) {
        balance::join(treasury, balance::withdraw_all(loser_bond));
    };
}
