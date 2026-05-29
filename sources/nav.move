/// LP NAV (Phase 1.5): equity / shares, mint on deposit.
module x_market::nav;

use x_market::errors;

const NAV_SCALE: u128 = 1_000_000_000;

/// Phase 1.5 MTM: worst-case payout slot.
public fun max_liability_mtm(liability_by_k: &vector<u64>): u64 {
    let mut max_liab = 0u64;
    let mut i = 0u64;
    let len = vector::length(liability_by_k);
    while (i < len) {
        let v = *vector::borrow(liability_by_k, i);
        if (v > max_liab) {
            max_liab = v;
        };
        i = i + 1;
    };
    max_liab
}

/// Vault equity after reserving max liability.
public fun vault_equity(vault_usdc: u64, liability_by_k: &vector<u64>): u64 {
    let liab = max_liability_mtm(liability_by_k);
    if (vault_usdc <= liab) {
        0
    } else {
        vault_usdc - liab
    }
}

/// NAV per LP share in USDC base units (ppb-style integer: 1e9 = 1.0 USDC per share).
public fun nav_ppb(vault_usdc: u64, liability_by_k: &vector<u64>, lp_shares: u64): u64 {
    if (lp_shares == 0) {
        return (NAV_SCALE as u64)
    };
    let equity = vault_equity(vault_usdc, liability_by_k);
    if (equity == 0) {
        abort errors::insufficient_equity()
    };
    let nav = (equity as u128) * NAV_SCALE / (lp_shares as u128);
    if (nav > 18446744073709551615) {
        abort errors::math_overflow()
    };
    nav as u64
}

/// `mint_lp = deposit_usdc * NAV_SCALE / nav_ppb` (genesis: 1:1).
public fun mint_lp_shares(
    deposit_usdc: u64,
    vault_usdc: u64,
    liability_by_k: &vector<u64>,
    lp_shares: u64,
): u64 {
    if (deposit_usdc == 0) {
        abort errors::out_of_bounds()
    };
    if (lp_shares == 0) {
        return deposit_usdc
    };
    let nav = nav_ppb(vault_usdc, liability_by_k, lp_shares);
    let mint = (deposit_usdc as u128) * NAV_SCALE / (nav as u128);
    if (mint == 0) {
        abort errors::out_of_bounds()
    };
    if (mint > 18446744073709551615) {
        abort errors::math_overflow()
    };
    mint as u64
}

/// `payout = burn_shares * nav_ppb / NAV_SCALE`.
public fun redeem_usdc_amount(
    burn_shares: u64,
    vault_usdc: u64,
    liability_by_k: &vector<u64>,
    lp_shares: u64,
): u64 {
    if (burn_shares == 0 || lp_shares == 0 || burn_shares > lp_shares) {
        abort errors::out_of_bounds()
    };
    let nav = nav_ppb(vault_usdc, liability_by_k, lp_shares);
    let payout = (burn_shares as u128) * (nav as u128) / NAV_SCALE;
    if (payout == 0 || payout > 18446744073709551615) {
        abort errors::math_overflow()
    };
    payout as u64
}
