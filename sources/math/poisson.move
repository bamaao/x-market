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

module x_market::math_poisson;

use x_market::errors;
use x_market::math_exp_neg_lut;
use x_market::math_fixed_point::{Self as fp, one};

const K_MAX: u8 = 14;

fun lambda_pow_div_factorial(lambda_fp: u128, k: u8): u128 {
    if (lambda_fp > fp::lambda_max_fp()) {
        abort errors::out_of_bounds()
    };
    if (k == 0) {
        return one()
    };
    let mut term = one();
    let mut n: u8 = 1;
    while (n <= k) {
        term = fp::mul(term, lambda_fp);
        term = fp::div(term, fp::from_u64(n as u64));
        n = n + 1;
    };
    term
}

public fun poisson_pmf(lambda_fp: u128, k: u8): u128 {
    if (k > K_MAX) {
        abort errors::out_of_bounds()
    };
    let core = lambda_pow_div_factorial(lambda_fp, k);
    let exp = math_exp_neg_lut::exp_neg_lut(lambda_fp);
    fp::clamp_prob(fp::mul(core, exp))
}

public fun poisson_interval(lambda_fp: u128, a: u8, b: u8): u128 {
    if (a > b || b > K_MAX) {
        abort errors::out_of_bounds()
    };
    let mut sum = 0u128;
    let mut k = a;
    while (k <= b) {
        sum = sum + poisson_pmf(lambda_fp, k);
        k = k + 1;
    };
    fp::clamp_prob(sum)
}

public fun delta_prob_from_stake(stake: u64, vault_mist: u64): u128 {
    let denom = vault_mist + stake;
    let d = if (denom == 0) 1 else denom;
    fp::div(fp::from_u64(stake), fp::from_u64(d))
}

public fun update_lambda_buy(
    lambda_tenths: u16,
    a: u8,
    b: u8,
    delta_prob_fp: u128,
): u16 {
    let lambda_fp = fp::from_tenths(lambda_tenths as u64);
    let current = poisson_interval(lambda_fp, a, b);
    let target = fp::clamp_prob(current + delta_prob_fp);
    binary_search_lambda_tenths(a, b, target)
}

fun binary_search_lambda_tenths(a: u8, b: u8, target_fp: u128): u16 {
    let mut lo: u16 = 0;
    let mut hi: u16 = 80;
    while (lo < hi) {
        let mid = lo + ((hi - lo) / 2);
        let lambda_fp = fp::from_tenths(mid as u64);
        let p = poisson_interval(lambda_fp, a, b);
        if (p >= target_fp) {
            hi = mid;
        } else {
            lo = mid + 1;
        };
    };
    if (lo > 80) 80 else lo
}

public fun lambda_tenths_from_auction_buckets(buckets: &vector<u64>): u16 {
    let total = buckets[0] + buckets[1] + buckets[2];
    if (total == 0) {
        abort errors::out_of_bounds()
    };
    let weighted = buckets[0] * 15 + buckets[1] * 25 + buckets[2] * 50;
    let t = (weighted / total) as u16;
    if (t > 80) 80 else t
}

public fun poisson_tail(lambda_fp: u128, k_min: u8): u128 {
    if (k_min == 0) {
        return one()
    };
    let left = poisson_interval(lambda_fp, 0, k_min - 1);
    one() - left
}
