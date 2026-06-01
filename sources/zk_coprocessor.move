/// Phase 3 Tier-2 ZK coprocessor integration surface.
/// This module keeps the on-chain interface minimal: users submit proof digests,
/// and admin/verifier accounts attest those proofs for a specific market.
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

/// Submit a proof hash for a market.
public entry fun submit_proof(
    pool: &MarketPool,
    proof_hash: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    if (vector::length(&proof_hash) == 0) {
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
