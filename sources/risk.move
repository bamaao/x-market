/// Max-Loss bounded checking (PRD §4.5).
module x_market::risk;

use x_market::errors;

const OUTCOME_SLOTS: u64 = 15;
const LINEAR_PAYOUT_DIVISOR: u64 = 10;
const LINEAR_CALL_KIND: u8 = 2;
const LINEAR_PUT_KIND: u8 = 3;
const STRADDLE_KIND: u8 = 4;

public fun outcome_slots(): u64 {
    OUTCOME_SLOTS
}

public fun position_payout_usdc(stake: u64, entry_prob_ppb: u64): u64 {
    if (entry_prob_ppb == 0) {
        abort errors::out_of_bounds()
    };
    let payout = ((stake as u128) * 1_000_000_000) / (entry_prob_ppb as u128);
    if (payout > 18446744073709551615) {
        abort errors::math_overflow()
    };
    payout as u64
}

public fun max_liability_after_buy(
    liability_by_k: &vector<u64>,
    interval_a: u8,
    interval_b: u8,
    payout: u64,
): u64 {
    let mut max_liab = 0u64;
    let mut k = interval_a;
    while (k <= interval_b) {
        let idx = k as u64;
        if (idx < vector::length(liability_by_k)) {
            let total = *vector::borrow(liability_by_k, idx) + payout;
            if (total > max_liab) {
                max_liab = total;
            };
        };
        k = k + 1;
    };
    max_liab
}

public fun assert_max_loss_bounded(
    liability_by_k: &vector<u64>,
    interval_a: u8,
    interval_b: u8,
    stake_usdc: u64,
    entry_prob_ppb: u64,
    vault_usdc: u64,
) {
    let payout = position_payout_usdc(stake_usdc, entry_prob_ppb);
    let max_liab = max_liability_after_buy(liability_by_k, interval_a, interval_b, payout);
    let vault_after = vault_usdc + stake_usdc;
    if (max_liab > vault_after) {
        abort errors::max_loss_exceeded()
    };
}

/// Dirichlet / digital single-outcome: liability only on bucket `outcome`.
public fun assert_dirichlet_max_loss_bounded(
    liability_by_k: &vector<u64>,
    outcome: u8,
    stake_usdc: u64,
    entry_prob_ppb: u64,
    vault_usdc: u64,
) {
    let payout = position_payout_usdc(stake_usdc, entry_prob_ppb);
    let idx = outcome as u64;
    let cur = if (idx < vector::length(liability_by_k)) {
        *vector::borrow(liability_by_k, idx)
    } else {
        0
    };
    let max_liab = cur + payout;
    let vault_after = vault_usdc + stake_usdc;
    if (max_liab > vault_after) {
        abort errors::max_loss_exceeded()
    };
}

public fun add_dirichlet_liability(
    liability_by_k: &mut vector<u64>,
    outcome: u8,
    payout: u64,
) {
    let idx = outcome as u64;
    if (idx < vector::length(liability_by_k)) {
        let slot = vector::borrow_mut(liability_by_k, idx);
        *slot = *slot + payout;
    };
}

public fun add_position_liability(
    liability_by_k: &mut vector<u64>,
    interval_a: u8,
    interval_b: u8,
    payout: u64,
) {
    let mut k = interval_a;
    while (k <= interval_b) {
        let idx = k as u64;
        if (idx < vector::length(liability_by_k)) {
            let slot = vector::borrow_mut(liability_by_k, idx);
            *slot = *slot + payout;
        };
        k = k + 1;
    };
}

public fun zero_liability(): vector<u64> {
    let mut v = vector::empty<u64>();
    let mut i = 0u64;
    while (i < OUTCOME_SLOTS) {
        vector::push_back(&mut v, 0);
        i = i + 1;
    };
    v
}

public fun linear_payout_usdc(
    contract_kind: u8,
    strike_slot: u8,
    resolved_slot: u8,
    stake_usdc: u64,
): u64 {
    let diff = if (contract_kind == LINEAR_CALL_KIND) {
        if (resolved_slot > strike_slot) {
            (resolved_slot - strike_slot) as u64
        } else {
            0
        }
    } else if (contract_kind == LINEAR_PUT_KIND) {
        if (resolved_slot < strike_slot) {
            (strike_slot - resolved_slot) as u64
        } else {
            0
        }
    } else if (contract_kind == STRADDLE_KIND) {
        if (resolved_slot >= strike_slot) {
            (resolved_slot - strike_slot) as u64
        } else {
            (strike_slot - resolved_slot) as u64
        }
    } else {
        0
    };
    ((stake_usdc as u128) * (diff as u128) / (LINEAR_PAYOUT_DIVISOR as u128)) as u64
}

public fun add_linear_liability(
    liability_by_k: &mut vector<u64>,
    contract_kind: u8,
    strike_slot: u8,
    stake_usdc: u64,
) {
    let mut k = 0u8;
    while ((k as u64) < vector::length(liability_by_k)) {
        let add = linear_payout_usdc(contract_kind, strike_slot, k, stake_usdc);
        if (add > 0) {
            let slot = vector::borrow_mut(liability_by_k, k as u64);
            *slot = *slot + add;
        };
        k = k + 1;
    };
}

public fun assert_linear_max_loss_bounded(
    liability_by_k: &vector<u64>,
    contract_kind: u8,
    strike_slot: u8,
    stake_usdc: u64,
    vault_usdc: u64,
) {
    let mut max_liab = 0u64;
    let mut k = 0u8;
    while ((k as u64) < vector::length(liability_by_k)) {
        let cur = *vector::borrow(liability_by_k, k as u64);
        let add = linear_payout_usdc(contract_kind, strike_slot, k, stake_usdc);
        let total = cur + add;
        if (total > max_liab) {
            max_liab = total;
        };
        k = k + 1;
    };
    if (max_liab > (vault_usdc + stake_usdc)) {
        abort errors::max_loss_exceeded()
    };
}
