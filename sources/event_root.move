/// Unified market root (PRD §3.7). Phase 4: wraps AMM + Prophet under one shared object.
module x_market::event_root;

use sui::dynamic_field as df;
use x_market::errors;

const STATUS_OPEN: u8 = 0;
const STATUS_TRADING: u8 = 1;
const STATUS_LOCKED: u8 = 2;
const STATUS_SETTLED: u8 = 3;
const STATUS_NULLIFIED: u8 = 4;

const DF_AMM: vector<u8> = b"amm";
const DF_PROPHET_REGISTRY: vector<u8> = b"prophet_registry";

/// Shared root for one real-world event. Oracle feed + lock_time are canonical here.
public struct EventRoot has key {
    id: UID,
    event_id: vector<u8>,
    lock_time: u64,
    oracle_feed_id: ID,
    status: u8,
}

public struct AMMExtension has store {
    pool_id: ID,
}

public struct ProphetExtension has store {
    registry_id: ID,
}

public fun status_open(): u8 { STATUS_OPEN }
public fun status_trading(): u8 { STATUS_TRADING }
public fun status_locked(): u8 { STATUS_LOCKED }
public fun status_settled(): u8 { STATUS_SETTLED }
public fun status_nullified(): u8 { STATUS_NULLIFIED }

public fun is_settled(root: &EventRoot): bool {
    root.status == STATUS_SETTLED
}

public fun event_id(root: &EventRoot): vector<u8> {
    root.event_id
}

public fun lock_time(root: &EventRoot): u64 {
    root.lock_time
}

public fun oracle_feed_id(root: &EventRoot): ID {
    root.oracle_feed_id
}

public fun status(root: &EventRoot): u8 {
    root.status
}

public entry fun create_event_root(
    event_id: vector<u8>,
    lock_time: u64,
    oracle_feed_id: ID,
    ctx: &mut TxContext,
) {
    assert!(vector::length(&event_id) > 0, errors::event_root_empty_id());
    let root = EventRoot {
        id: object::new(ctx),
        event_id,
        lock_time,
        oracle_feed_id,
        status: STATUS_OPEN,
    };
    transfer::share_object(root);
}

/// One-shot migration helper: create root + link AMM + link Prophet registry.
public entry fun create_and_link(
    event_id: vector<u8>,
    lock_time: u64,
    oracle_feed_id: ID,
    pool_id: ID,
    registry_id: ID,
    ctx: &mut TxContext,
) {
    assert!(vector::length(&event_id) > 0, errors::event_root_empty_id());
    let mut root = EventRoot {
        id: object::new(ctx),
        event_id,
        lock_time,
        oracle_feed_id,
        status: STATUS_OPEN,
    };
    link_amm_pool(&mut root, pool_id);
    link_prophet_registry(&mut root, registry_id);
    transfer::share_object(root);
}

public entry fun link_amm_pool_entry(root: &mut EventRoot, pool_id: ID) {
    link_amm_pool(root, pool_id);
}

public entry fun link_prophet_registry_entry(
    root: &mut EventRoot,
    registry_id: ID,
) {
    link_prophet_registry(root, registry_id);
}

public fun link_amm_pool(root: &mut EventRoot, pool_id: ID) {
    assert!(!df::exists(&root.id, DF_AMM), errors::event_root_already_linked());
    df::add(&mut root.id, DF_AMM, AMMExtension { pool_id });
    if (root.status == STATUS_OPEN) {
        root.status = STATUS_TRADING;
    };
}

public fun link_prophet_registry(root: &mut EventRoot, registry_id: ID) {
    assert!(
        !df::exists(&root.id, DF_PROPHET_REGISTRY),
        errors::event_root_already_linked(),
    );
    df::add(
        &mut root.id,
        DF_PROPHET_REGISTRY,
        ProphetExtension { registry_id },
    );
}

public entry fun mark_settled_entry(root: &mut EventRoot) {
    mark_settled(root);
}

public entry fun mark_nullified_entry(root: &mut EventRoot) {
    mark_nullified(root);
}

public fun mark_settled(root: &mut EventRoot) {
    root.status = STATUS_SETTLED;
}

public fun mark_nullified(root: &mut EventRoot) {
    root.status = STATUS_NULLIFIED;
}

public fun amm_pool_id(root: &EventRoot): option::Option<ID> {
    if (df::exists(&root.id, DF_AMM)) {
        let ext = df::borrow<vector<u8>, AMMExtension>(&root.id, DF_AMM);
        option::some(ext.pool_id)
    } else {
        option::none()
    }
}

public fun prophet_registry_id(root: &EventRoot): option::Option<ID> {
    if (df::exists(&root.id, DF_PROPHET_REGISTRY)) {
        let ext = df::borrow<vector<u8>, ProphetExtension>(&root.id, DF_PROPHET_REGISTRY);
        option::some(ext.registry_id)
    } else {
        option::none()
    }
}
