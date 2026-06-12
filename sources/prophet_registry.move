/// SuiProphet: private prophecy commit, paid unlock, post-oracle audit (PRD §11).
module x_market::prophet_registry;

use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::dynamic_field as df;
use sui::hash;
use x_market::config::{Self, AdminCap, GlobalConfig};
use x_market::errors;
use x_market::macro_oracle;
use x_market::market_pool::{Self, MarketPool};
use x_market::prophet_leaderboard::{Self, ProphetStats};
use x_market::usdc::USDC;

const PROPHECY_OPEN: u8 = 0;
const PROPHECY_AUDITED_WIN: u8 = 1;
const PROPHECY_AUDITED_LOSS: u8 = 2;
const PROPHECY_CHEAT: u8 = 3;

const UNLOCK_CUTOFF_SECS: u64 = 300;
const MAX_BLOB_ID_LEN: u64 = 128;
const PLAINTEXT_HASH_LEN: u64 = 32;
const SEAL_ID_LEN: u64 = 32;
const DEFAULT_PROTOCOL_FEE_BPS: u16 = 500;

public struct ProphetRegistry has key {
    id: UID,
    protocol_fee_bps: u16,
    treasury: Balance<USDC>,
    prophecy_count: u64,
}

/// Per-market index for on-chain discovery.
public struct MarketProphecyList has store {
    ids: vector<ID>,
}

/// Shared prophecy object — paid_buyers gate Seal condition A (PRD §11.2).
public struct PrivateProphecy has key {
    id: UID,
    prophet: address,
    market_id: ID,
    blob_id: vector<u8>,
    seal_id: vector<u8>,
    plaintext_hash: vector<u8>,
    predicted_value: u64,
    unlock_price: u64,
    lock_time: u64,
    paid_buyers: vector<address>,
    escrow: Balance<USDC>,
    status: u8,
    is_public: bool,
    unlock_count: u64,
}

public fun prophecy_open(): u8 { PROPHECY_OPEN }
public fun prophecy_audited_win(): u8 { PROPHECY_AUDITED_WIN }
public fun prophecy_audited_loss(): u8 { PROPHECY_AUDITED_LOSS }
public fun prophecy_cheat(): u8 { PROPHECY_CHEAT }
public fun unlock_cutoff_secs(): u64 { UNLOCK_CUTOFF_SECS }

public fun can_commit(pool_resolved: bool, now: u64, lock_time: u64): bool {
    !pool_resolved && now < lock_time
}

public fun can_unlock(
    status: u8,
    now: u64,
    lock_time: u64,
    already_paid: bool,
): bool {
    status == PROPHECY_OPEN &&
        !already_paid &&
        now + UNLOCK_CUTOFF_SECS < lock_time
}

public fun can_decrypt_paid(prophecy: &PrivateProphecy, buyer: address): bool {
    vector::contains(&prophecy.paid_buyers, &buyer)
}

public fun can_decrypt_public(
    prophecy: &PrivateProphecy,
    now: u64,
    pool_resolved: bool,
): bool {
    prophecy.is_public || now > prophecy.lock_time || pool_resolved
}

public fun can_audit(
    status: u8,
    pool_resolved: bool,
    now: u64,
    lock_time: u64,
): bool {
    status == PROPHECY_OPEN && pool_resolved && now >= lock_time
}

public fun is_valid_blob_id_len(len: u64): bool {
    len > 0 && len <= MAX_BLOB_ID_LEN
}

public fun is_valid_plaintext_hash_len(len: u64): bool {
    len == PLAINTEXT_HASH_LEN
}

public fun is_valid_seal_id_len(len: u64): bool {
    len == SEAL_ID_LEN
}

/// Free/public prophecies (unlock_price = 0) skip Seal; paid prophecies require seal_id.
public fun is_public_at_commit(unlock_price: u64): bool {
    unlock_price == 0
}

public fun is_valid_seal_id_for_commit(unlock_price: u64, len: u64): bool {
    if (is_public_at_commit(unlock_price)) {
        len == 0
    } else {
        is_valid_seal_id_len(len)
    }
}

/// Seal OR policy (PRD §11.2): paid_buyer OR lock_time passed OR is_public.
public fun seal_access_allowed(
    prophecy: &PrivateProphecy,
    sender: address,
    now: u64,
): bool {
    if (prophecy.is_public) {
        true
    } else if (vector::contains(&prophecy.paid_buyers, &sender)) {
        true
    } else {
        now > prophecy.lock_time
    }
}

public entry fun create_prophet_registry(
    global_config: &GlobalConfig,
    cap: &AdminCap,
    protocol_fee_bps: u16,
    ctx: &mut TxContext,
) {
    config::assert_admin(global_config, cap, ctx.sender());
    if (protocol_fee_bps > 10_000) {
        abort errors::out_of_bounds()
    };
    let registry = ProphetRegistry {
        id: object::new(ctx),
        protocol_fee_bps: if (protocol_fee_bps == 0) {
            DEFAULT_PROTOCOL_FEE_BPS
        } else {
            protocol_fee_bps
        },
        treasury: balance::zero(),
        prophecy_count: 0,
    };
    transfer::share_object(registry);
}

/// Seal key-server gate — first arg is inner identity (`vector<u8>` id at encrypt time).
entry fun seal_approve_prophecy(
    id: vector<u8>,
    prophecy: &PrivateProphecy,
    clock: &Clock,
    ctx: &TxContext,
) {
    if (!is_valid_seal_id_len(vector::length(&id))) {
        abort errors::invalid_hash_len()
    };
    if (id != prophecy.seal_id) {
        abort errors::seal_id_mismatch()
    };
    let now = clock::timestamp_ms(clock) / 1000;
    if (!seal_access_allowed(prophecy, ctx.sender(), now)) {
        abort errors::not_paid_buyer()
    };
}

public entry fun commit_private_prophecy(
    registry: &mut ProphetRegistry,
    pool: &MarketPool,
    blob_id: vector<u8>,
    seal_id: vector<u8>,
    plaintext_hash: vector<u8>,
    predicted_value: u64,
    unlock_price: u64,
    lock_time: u64,
    ctx: &mut TxContext,
) {
    if (market_pool::is_resolved(pool)) {
        abort errors::market_already_resolved()
    };
    if (!is_valid_blob_id_len(vector::length(&blob_id))) {
        abort errors::out_of_bounds()
    };
    if (!is_valid_plaintext_hash_len(vector::length(&plaintext_hash))) {
        abort errors::invalid_hash_len()
    };
    if (!is_valid_seal_id_for_commit(unlock_price, vector::length(&seal_id))) {
        abort errors::invalid_hash_len()
    };
    if (unlock_price > 0) {
        assert_paid_unlock_eligible(registry, ctx.sender());
    };
    let is_public = is_public_at_commit(unlock_price);
    let maturity = market_pool::maturity_ts(pool);
    if (lock_time != maturity) {
        abort errors::out_of_bounds()
    };
    macro_oracle::assert_valid_resolution(pool, predicted_value);
    let market_id = market_pool::pool_id(pool);
    let prophecy = PrivateProphecy {
        id: object::new(ctx),
        prophet: ctx.sender(),
        market_id,
        blob_id,
        seal_id,
        plaintext_hash,
        predicted_value,
        unlock_price,
        lock_time,
        paid_buyers: vector[],
        escrow: balance::zero(),
        status: PROPHECY_OPEN,
        is_public,
        unlock_count: 0,
    };
    let prophecy_id = object::id(&prophecy);
    index_prophecy(registry, market_id, prophecy_id);
    registry.prophecy_count = registry.prophecy_count + 1;
    event::emit(ProphecyCommitted {
        prophecy_id,
        market_id,
        prophet: ctx.sender(),
        lock_time,
        unlock_price,
    });
    transfer::share_object(prophecy);
}

public struct ProphecyCommitted has copy, drop {
    prophecy_id: ID,
    market_id: ID,
    prophet: address,
    lock_time: u64,
    unlock_price: u64,
}

public entry fun unlock_prophecy(
    registry: &mut ProphetRegistry,
    prophecy: &mut PrivateProphecy,
    payment: Coin<USDC>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    if (prophecy.unlock_price == 0) {
        abort errors::public_prophecy_no_unlock()
    };
    let now = clock::timestamp_ms(clock) / 1000;
    let buyer = ctx.sender();
    let already = vector::contains(&prophecy.paid_buyers, &buyer);
    if (!can_unlock(prophecy.status, now, prophecy.lock_time, already)) {
        if (already) {
            abort errors::already_unlocked()
        };
        if (prophecy.status != PROPHECY_OPEN) {
            abort errors::prophecy_closed()
        };
        abort errors::unlock_window_closed()
    };
    if (coin::value(&payment) != prophecy.unlock_price) {
        abort errors::out_of_bounds()
    };
    vector::push_back(&mut prophecy.paid_buyers, buyer);
    prophecy.unlock_count = prophecy.unlock_count + 1;
    balance::join(&mut prophecy.escrow, coin::into_balance(payment));
    record_unlock_stats_internal(registry, prophecy.prophet, prophecy.unlock_price);
}

/// Post-oracle audit: verify plaintext hash, compare prediction, settle escrow (PRD §11.3.4).
public entry fun audit_prophecy(
    registry: &mut ProphetRegistry,
    prophecy: &mut PrivateProphecy,
    pool: &MarketPool,
    plaintext: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let now = clock::timestamp_ms(clock) / 1000;
    if (!can_audit(prophecy.status, market_pool::is_resolved(pool), now, prophecy.lock_time)) {
        if (!market_pool::is_resolved(pool)) {
            abort errors::not_resolved()
        };
        if (now < prophecy.lock_time) {
            abort errors::lock_not_reached()
        };
        abort errors::already_audited()
    };
    if (market_pool::pool_id(pool) != prophecy.market_id) {
        abort errors::lp_market_mismatch()
    };
    let computed = hash::blake2b256(&plaintext);
    if (computed != prophecy.plaintext_hash) {
        prophecy.status = PROPHECY_CHEAT;
        prophecy.is_public = true;
        let prophet_addr = prophecy.prophet;
        update_prophet_cheat(registry, prophet_addr);
        refund_escrow_to_buyers(prophecy, ctx);
        return
    };
    let resolved = market_pool::resolved_value(pool);
    let won = resolved == prophecy.predicted_value;
    let escrow_total = balance::value(&prophecy.escrow);
    if (won) {
        prophecy.status = PROPHECY_AUDITED_WIN;
    } else {
        prophecy.status = PROPHECY_AUDITED_LOSS;
    };
    prophecy.is_public = true;
    settle_escrow(
        registry,
        prophecy,
        escrow_total,
        won,
        ctx,
    );
}

fun assert_paid_unlock_eligible(registry: &ProphetRegistry, prophet: address) {
    if (df::exists<address>(&registry.id, prophet)) {
        let stats = df::borrow<address, ProphetStats>(&registry.id, prophet);
        if (!prophet_leaderboard::paid_unlock_eligible(stats)) {
            abort errors::prophet_not_paid_eligible()
        };
    } else {
        abort errors::prophet_not_paid_eligible()
    };
}

fun index_prophecy(registry: &mut ProphetRegistry, market_id: ID, prophecy_id: ID) {
    if (df::exists<ID>(&registry.id, market_id)) {
        let list = df::borrow_mut<ID, MarketProphecyList>(&mut registry.id, market_id);
        vector::push_back(&mut list.ids, prophecy_id);
    } else {
        let list = MarketProphecyList { ids: vector[prophecy_id] };
        df::add(&mut registry.id, market_id, list);
    };
}

fun update_prophet_cheat(registry: &mut ProphetRegistry, prophet: address) {
    if (df::exists<address>(&registry.id, prophet)) {
        let stats = df::borrow_mut<address, ProphetStats>(&mut registry.id, prophet);
        prophet_leaderboard::record_cheat(stats);
    } else {
        let mut stats = prophet_leaderboard::new_stats(prophet);
        prophet_leaderboard::record_cheat(&mut stats);
        df::add(&mut registry.id, prophet, stats);
    };
}

fun update_prophet_audit(
    registry: &mut ProphetRegistry,
    prophet: address,
    won: bool,
    escrow_total: u64,
) {
    if (df::exists<address>(&registry.id, prophet)) {
        let stats = df::borrow_mut<address, ProphetStats>(&mut registry.id, prophet);
        if (won) {
            prophet_leaderboard::record_audit_win(stats, escrow_total);
        } else {
            prophet_leaderboard::record_audit_loss(stats, escrow_total);
        };
    } else {
        let mut stats = prophet_leaderboard::new_stats(prophet);
        if (won) {
            prophet_leaderboard::record_audit_win(&mut stats, escrow_total);
        } else {
            prophet_leaderboard::record_audit_loss(&mut stats, escrow_total);
        };
        df::add(&mut registry.id, prophet, stats);
    };
}

fun settle_escrow(
    registry: &mut ProphetRegistry,
    prophecy: &mut PrivateProphecy,
    escrow_total: u64,
    won: bool,
    ctx: &mut TxContext,
) {
    let prophet_addr = prophecy.prophet;
    update_prophet_audit(registry, prophet_addr, won, escrow_total);
    if (escrow_total == 0) {
        return
    };
    let fee_bps = (registry.protocol_fee_bps as u64);
    let protocol_fee = escrow_total * fee_bps / 10_000;
    let prophet_payout = escrow_total - protocol_fee;
    if (protocol_fee > 0) {
        let fee_bal = balance::split(&mut prophecy.escrow, protocol_fee);
        balance::join(&mut registry.treasury, fee_bal);
    };
    if (prophet_payout > 0) {
        let payout = balance::withdraw_all(&mut prophecy.escrow);
        transfer::public_transfer(coin::from_balance(payout, ctx), prophet_addr);
    };
}

fun refund_escrow_to_buyers(prophecy: &mut PrivateProphecy, ctx: &mut TxContext) {
    let buyers = &prophecy.paid_buyers;
    let n = vector::length(buyers);
    if (n == 0) {
        return
    };
    let total = balance::value(&prophecy.escrow);
    if (total == 0) {
        return
    };
    let per_buyer = total / n;
    let mut i = 0;
    while (i < n) {
        let buyer = *vector::borrow(buyers, i);
        if (per_buyer > 0) {
            let slice = balance::split(&mut prophecy.escrow, per_buyer);
            transfer::public_transfer(coin::from_balance(slice, ctx), buyer);
        };
        i = i + 1;
    };
    if (balance::value(&prophecy.escrow) > 0) {
        let remainder = balance::withdraw_all(&mut prophecy.escrow);
        transfer::public_transfer(
            coin::from_balance(remainder, ctx),
            prophecy.prophet,
        );
    };
}

fun record_unlock_stats_internal(registry: &mut ProphetRegistry, prophet: address, amount: u64) {
    if (df::exists<address>(&registry.id, prophet)) {
        let stats = df::borrow_mut<address, ProphetStats>(&mut registry.id, prophet);
        prophet_leaderboard::record_unlock_revenue(stats, amount);
    } else {
        let mut stats = prophet_leaderboard::new_stats(prophet);
        prophet_leaderboard::record_unlock_revenue(&mut stats, amount);
        df::add(&mut registry.id, prophet, stats);
    };
}

/// DevInspect / Indexer: list prophecy ids for a market pool.
public fun lookup_prophecies_by_market(
    registry: &ProphetRegistry,
    market_id: ID,
): vector<ID> {
    if (df::exists<ID>(&registry.id, market_id)) {
        let list = df::borrow<ID, MarketProphecyList>(&registry.id, market_id);
        list.ids
    } else {
        vector[]
    }
}

public fun lookup_prophet_stats(
    registry: &ProphetRegistry,
    prophet: address,
): option::Option<ProphetStats> {
    if (df::exists<address>(&registry.id, prophet)) {
        option::some(*df::borrow<address, ProphetStats>(&registry.id, prophet))
    } else {
        option::none()
    }
}

public fun is_paid_buyer(prophecy: &PrivateProphecy, buyer: address): bool {
    vector::contains(&prophecy.paid_buyers, &buyer)
}

public fun prophecy_status(prophecy: &PrivateProphecy): u8 {
    prophecy.status
}

public fun predicted_value(prophecy: &PrivateProphecy): u64 {
    prophecy.predicted_value
}

public fun unlock_price(prophecy: &PrivateProphecy): u64 {
    prophecy.unlock_price
}

public fun lock_time(prophecy: &PrivateProphecy): u64 {
    prophecy.lock_time
}

public fun is_public(prophecy: &PrivateProphecy): bool {
    prophecy.is_public
}

public fun market_id(prophecy: &PrivateProphecy): ID {
    prophecy.market_id
}

public fun seal_id(prophecy: &PrivateProphecy): &vector<u8> {
    &prophecy.seal_id
}

public fun prophet_address(prophecy: &PrivateProphecy): address {
    prophecy.prophet
}
