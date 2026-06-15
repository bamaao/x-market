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

/// Phase 2 LP guard: dynamic fee, virtual liquidity, and time windows.
module x_market::lp_guard;

use x_market::errors;

/// Effective fee bps after multiplier: base * (10_000 + mult) / 10_000.
public fun effective_fee_bps(base_fee_bps: u16, fee_multiplier_bps: u16): u16 {
    (((base_fee_bps as u64) * (10_000 + (fee_multiplier_bps as u64))) / 10_000) as u16
}

/// Convert stake into effective stake after fee.
public fun net_stake_after_fee(stake: u64, effective_fee_bps: u16): u64 {
    if (stake == 0) {
        abort errors::out_of_bounds()
    };
    let keep = 10_000u64 - (effective_fee_bps as u64);
    let net = ((stake as u128) * (keep as u128)) / 10_000;
    if (net == 0) {
        abort errors::out_of_bounds()
    };
    net as u64
}

/// Resolution window: block buys if remaining time <= window.
public fun assert_buy_window_open(now_ts: u64, maturity_ts: u64, resolution_window_ts: u64) {
    if (resolution_window_ts == 0) {
        return
    };
    if (maturity_ts <= now_ts || maturity_ts - now_ts <= resolution_window_ts) {
        abort errors::buy_window_closed()
    };
}

/// Deposit cutoff in bps of lifecycle (0..5000 recommended).
/// Example: cutoff_bps=1000 means close deposits in last 10% time.
public fun assert_deposit_window_open(
    now_ts: u64,
    created_ts: u64,
    maturity_ts: u64,
    cutoff_bps: u16,
) {
    if (cutoff_bps == 0 || created_ts == 0) {
        return
    };
    if (maturity_ts <= now_ts || maturity_ts <= created_ts || now_ts <= created_ts) {
        abort errors::deposit_window_closed()
    };
    let duration = maturity_ts - created_ts;
    let elapsed = now_ts - created_ts;
    let elapsed_bps = ((elapsed as u128) * 10_000) / (duration as u128);
    let close_from = 10_000 - (cutoff_bps as u128);
    if (elapsed_bps >= close_from) {
        abort errors::deposit_window_closed()
    };
}

/// Dirichlet virtual concentration adjusted probability.
public fun dirichlet_prob_with_virtual(
    alpha_i: u32,
    alpha_sum: u64,
    len: u8,
    concentration_virtual: u32,
): u128 {
    let v = concentration_virtual as u128;
    let num = ((alpha_i as u128) + v) << 32;
    let den = (alpha_sum as u128) + ((len as u128) * v);
    if (den == 0) {
        abort errors::div_by_zero()
    };
    num / den
}
