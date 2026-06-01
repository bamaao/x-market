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
    challenge_deadline_at: u64,
    finalized: bool,
}

const STATUS_ACCEPTED: u8 = 1;
const STATUS_REJECTED: u8 = 2;
const STATUS_CHALLENGED: u8 = 3;
const CHALLENGE_WINDOW_SECS: u64 = 3600;

public fun is_valid_status_code(status_code: u8): bool {
    status_code == STATUS_ACCEPTED ||
        status_code == STATUS_REJECTED ||
        status_code == STATUS_CHALLENGED
}

public fun is_valid_proof_hash_len(len: u64): bool {
    // Keep hash payload bounded for storage/gas predictability.
    len >= 32 && len <= 128
}

public fun challenge_window_secs(): u64 {
    CHALLENGE_WINDOW_SECS
}

public fun is_challenge_window_open(verified_at: u64, now: u64): bool {
    if (now < verified_at) {
        return false
    };
    now - verified_at <= CHALLENGE_WINDOW_SECS
}

public fun can_finalize(verification: &ZkVerification, now: u64): bool {
    !verification.finalized && now > verification.challenge_deadline_at
}

public fun status_code(verification: &ZkVerification): u8 {
    verification.status_code
}

public fun finalized(verification: &ZkVerification): bool {
    verification.finalized
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

    let now = clock::timestamp_ms(clock) / 1000;
    let verification = ZkVerification {
        id: object::new(ctx),
        market_id,
        verifier: ctx.sender(),
        proof_hash,
        status_code,
        verified_at: now,
        challenge_deadline_at: now + CHALLENGE_WINDOW_SECS,
        finalized: false,
    };
    transfer::share_object(verification);
}

/// Challenge a verification within the challenge window.
public entry fun challenge_verification(
    _pool: &MarketPool,
    verification: &mut ZkVerification,
    clock: &Clock,
    _ctx: &mut TxContext,
) {
    if (verification.finalized) {
        abort errors::out_of_bounds()
    };
    let now = clock::timestamp_ms(clock) / 1000;
    if (now > verification.challenge_deadline_at) {
        abort errors::out_of_bounds()
    };
    verification.status_code = STATUS_CHALLENGED;
}

/// Finalize after challenge window expires.
/// If status is challenged, verifier/admin must create a replacement verification later.
public entry fun finalize_verification(
    config: &GlobalConfig,
    cap: &AdminCap,
    verification: &mut ZkVerification,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    let now = clock::timestamp_ms(clock) / 1000;
    if (!can_finalize(verification, now)) {
        abort errors::out_of_bounds()
    };
    verification.finalized = true;
}
