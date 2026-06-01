/// Phase 3 Tier-2 ZK coprocessor integration surface.
/// IMPORTANT: current implementation is attestation-only.
/// It records admin verification status for proof hashes but does NOT execute
/// cryptographic proof verification on-chain yet.
module x_market::zk_coprocessor;

use sui::clock::{Self, Clock};
use x_market::config::{Self, AdminCap, GlobalConfig};
use x_market::errors;
use x_market::market_pool::{Self, MarketPool};

/// User-submitted proof ticket (owned object).
public struct ZkProofTicket has key, store {
    id: UID,
    market_id: ID,
    submitter: address,
    proof_hash: vector<u8>,
    submitted_at: u64,
}

/// Verifier-confirmed proof record (shared object).
public struct ZkVerification has key {
    id: UID,
    market_id: ID,
    verifier: address,
    proof_hash: vector<u8>,
    status_code: u8,
    verified_at: u64,
}

public fun is_valid_status_code(status_code: u8): bool {
    status_code > 0 && status_code <= 3
}

public fun is_valid_proof_hash_len(len: u64): bool {
    // Keep hash payload bounded for storage/gas predictability.
    len >= 32 && len <= 128
}

/// Submit a proof hash for a market.
public entry fun submit_proof(
    pool: &MarketPool,
    proof_hash: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    if (!is_valid_proof_hash_len(vector::length(&proof_hash))) {
        abort errors::out_of_bounds()
    };
    let ticket = ZkProofTicket {
        id: object::new(ctx),
        market_id: market_pool::pool_id(pool),
        submitter: ctx.sender(),
        proof_hash,
        submitted_at: clock::timestamp_ms(clock) / 1000,
    };
    transfer::public_transfer(ticket, ctx.sender());
}

/// Verify a previously submitted proof hash.
/// `status_code`: 1=accepted, 2=rejected, 3=challenged.
public entry fun verify_proof(
    config: &GlobalConfig,
    cap: &AdminCap,
    pool: &MarketPool,
    ticket: ZkProofTicket,
    status_code: u8,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    if (!is_valid_status_code(status_code)) {
        abort errors::out_of_bounds()
    };

    let ZkProofTicket {
        id,
        market_id,
        submitter: _,
        proof_hash,
        submitted_at: _,
    } = ticket;
    if (!is_valid_proof_hash_len(vector::length(&proof_hash))) {
        abort errors::out_of_bounds()
    };
    object::delete(id);

    if (market_id != market_pool::pool_id(pool)) {
        abort errors::lp_market_mismatch()
    };

    let verification = ZkVerification {
        id: object::new(ctx),
        market_id,
        verifier: ctx.sender(),
        proof_hash,
        status_code,
        verified_at: clock::timestamp_ms(clock) / 1000,
    };
    transfer::share_object(verification);
}
