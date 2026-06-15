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

/// Phase 3.1 Tier-2 ZK coprocessor integration surface.
/// Still attestation-based (no native Groth16/Plonk verifier precompile), but
/// strengthened with verifier-policy quorum and challenge-resolution constraints.
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

/// Shared verifier policy (off-chain prover committee mapped on-chain).
public struct ZkVerifierPolicy has key {
    id: UID,
    signers: vector<address>,
    threshold: u8,
}

/// Verifier-confirmed proof record (shared object).
public struct ZkVerification has key {
    id: UID,
    market_id: ID,
    verifier: address,
    proof_hash: vector<u8>,
    proof_scheme_code: u8,
    public_inputs_hash: vector<u8>,
    required_approvals: u8,
    approvals: vector<address>,
    status_code: u8,
    verified_at: u64,
    challenge_deadline_at: u64,
    challenge_evidence_hash: vector<u8>,
    challenge_resolved: bool,
    finalized: bool,
}

const STATUS_ACCEPTED: u8 = 1;
const STATUS_REJECTED: u8 = 2;
const STATUS_CHALLENGED: u8 = 3;
const SCHEME_GROTH16: u8 = 1;
const SCHEME_PLONK: u8 = 2;
const SCHEME_STARK: u8 = 3;
const CHALLENGE_WINDOW_SECS: u64 = 3600;

public fun is_valid_status_code(status_code: u8): bool {
    status_code == STATUS_ACCEPTED ||
        status_code == STATUS_REJECTED ||
        status_code == STATUS_CHALLENGED
}

public fun is_valid_resolution_status(status_code: u8): bool {
    status_code == STATUS_ACCEPTED || status_code == STATUS_REJECTED
}

public fun is_valid_proof_scheme(scheme_code: u8): bool {
    scheme_code == SCHEME_GROTH16 ||
        scheme_code == SCHEME_PLONK ||
        scheme_code == SCHEME_STARK
}

public fun is_valid_proof_hash_len(len: u64): bool {
    // Keep hash payload bounded for storage/gas predictability.
    len >= 32 && len <= 128
}

public fun is_valid_threshold(threshold: u8, signer_count: u64): bool {
    threshold > 0 && (threshold as u64) <= signer_count
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
    !verification.finalized &&
        now > verification.challenge_deadline_at &&
        approval_quorum(verification) &&
        !has_open_challenge(verification)
}

public fun status_code(verification: &ZkVerification): u8 {
    verification.status_code
}

public fun finalized(verification: &ZkVerification): bool {
    verification.finalized
}

public fun approval_quorum(verification: &ZkVerification): bool {
    vector::length(&verification.approvals) >= (verification.required_approvals as u64)
}

public fun has_open_challenge(verification: &ZkVerification): bool {
    verification.status_code == STATUS_CHALLENGED && !verification.challenge_resolved
}

public fun can_challenge(
    finalized: bool,
    now: u64,
    challenge_deadline_at: u64,
    evidence_hash_len: u64,
): bool {
    !finalized &&
        now <= challenge_deadline_at &&
        is_valid_proof_hash_len(evidence_hash_len)
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

public entry fun init_verifier_policy(
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
    let policy = ZkVerifierPolicy {
        id: object::new(ctx),
        signers,
        threshold,
    };
    transfer::share_object(policy);
}

public entry fun update_verifier_policy(
    config: &GlobalConfig,
    cap: &AdminCap,
    policy: &mut ZkVerifierPolicy,
    signers: vector<address>,
    threshold: u8,
    ctx: &TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    if (!is_valid_threshold(threshold, vector::length(&signers))) {
        abort errors::out_of_bounds()
    };
    assert_unique_addresses(&signers);
    policy.signers = signers;
    policy.threshold = threshold;
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
    if (!is_valid_resolution_status(status_code)) {
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
    create_verification(
        market_id,
        ctx.sender(),
        proof_hash,
        // Legacy path: treat as Groth16-compatible payload hash.
        SCHEME_GROTH16,
        vector[],
        status_code,
        1,
        clock,
        ctx,
    );
}

/// Verify using signer policy quorum (recommended path for Phase 3.1).
public entry fun verify_proof_with_policy(
    policy: &ZkVerifierPolicy,
    pool: &MarketPool,
    ticket: ZkProofTicket,
    status_code: u8,
    proof_scheme_code: u8,
    public_inputs_hash: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    if (!contains_address(&policy.signers, ctx.sender())) {
        abort errors::not_admin()
    };
    if (!is_valid_resolution_status(status_code)) {
        abort errors::out_of_bounds()
    };
    if (!is_valid_proof_scheme(proof_scheme_code)) {
        abort errors::out_of_bounds()
    };
    if (!is_valid_proof_hash_len(vector::length(&public_inputs_hash))) {
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

    create_verification(
        market_id,
        ctx.sender(),
        proof_hash,
        proof_scheme_code,
        public_inputs_hash,
        status_code,
        policy.threshold,
        clock,
        ctx,
    );
}

fun create_verification(
    market_id: ID,
    verifier: address,
    proof_hash: vector<u8>,
    proof_scheme_code: u8,
    public_inputs_hash: vector<u8>,
    status_code: u8,
    required_approvals: u8,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let now = clock::timestamp_ms(clock) / 1000;
    let verification = ZkVerification {
        id: object::new(ctx),
        market_id,
        verifier,
        proof_hash,
        proof_scheme_code,
        public_inputs_hash,
        required_approvals,
        approvals: vector[verifier],
        status_code,
        verified_at: now,
        challenge_deadline_at: now + CHALLENGE_WINDOW_SECS,
        challenge_evidence_hash: vector[],
        challenge_resolved: true,
        finalized: false,
    };
    transfer::share_object(verification);
}

public entry fun attest_verification(
    policy: &ZkVerifierPolicy,
    verification: &mut ZkVerification,
    ctx: &TxContext,
) {
    let signer = ctx.sender();
    if (!contains_address(&policy.signers, signer)) {
        abort errors::not_admin()
    };
    if (verification.required_approvals != policy.threshold) {
        abort errors::out_of_bounds()
    };
    if (contains_address(&verification.approvals, signer)) {
        abort errors::out_of_bounds()
    };
    vector::push_back(&mut verification.approvals, signer);
}

/// Challenge a verification within the challenge window.
public entry fun challenge_verification(
    pool: &MarketPool,
    verification: &mut ZkVerification,
    evidence_hash: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    if (verification.market_id != market_pool::pool_id(pool)) {
        abort errors::lp_market_mismatch()
    };
    if (ctx.sender() == verification.verifier) {
        abort errors::out_of_bounds()
    };
    let now = clock::timestamp_ms(clock) / 1000;
    if (!can_challenge(
        verification.finalized,
        now,
        verification.challenge_deadline_at,
        vector::length(&evidence_hash),
    )) {
        abort errors::out_of_bounds()
    };
    if (has_open_challenge(verification)) {
        abort errors::out_of_bounds()
    };
    verification.status_code = STATUS_CHALLENGED;
    verification.challenge_evidence_hash = evidence_hash;
    verification.challenge_resolved = false;
}

/// Resolve challenge with accepted/rejected status.
public entry fun resolve_challenge(
    config: &GlobalConfig,
    cap: &AdminCap,
    verification: &mut ZkVerification,
    resolved_status_code: u8,
    ctx: &TxContext,
) {
    config::assert_admin(config, cap, ctx.sender());
    if (!has_open_challenge(verification)) {
        abort errors::out_of_bounds()
    };
    if (!is_valid_resolution_status(resolved_status_code)) {
        abort errors::out_of_bounds()
    };
    verification.status_code = resolved_status_code;
    verification.challenge_resolved = true;
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
