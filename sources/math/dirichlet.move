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

module x_market::math_dirichlet;

use x_market::errors;

/// Stake (USDC base units) → α increment (MVP 1:1000 to keep u32 headroom).
const STAKE_TO_ALPHA: u64 = 1000;

public fun dirichlet_prob(alphas: &vector<u128>, i: u64): u128 {
    let len = vector::length(alphas);
    if (len == 0 || i >= len) {
        abort errors::out_of_bounds()
    };
    let mut sum = 0u128;
    let mut j = 0;
    while (j < len) {
        sum = sum + *vector::borrow(alphas, j);
        j = j + 1;
    };
    if (sum == 0) {
        abort errors::div_by_zero()
    };
    let num = *vector::borrow(alphas, i) << 32;
    num / sum
}

public fun scale_dirichlet_alphas(
    alphas: &mut vector<u32>,
    len: u8,
    vault_before: u64,
    vault_after: u64,
) {
    if (vault_before == 0) {
        abort errors::out_of_bounds()
    };
    let mut i = 0u64;
    while (i < (len as u64)) {
        let a = (*vector::borrow(alphas, i) as u128) * (vault_after as u128) / (vault_before as u128);
        *vector::borrow_mut(alphas, i) = (a as u32);
        i = i + 1;
    };
}

public fun update_dirichlet_buy(alphas: &mut vector<u128>, i: u64, stake_fp: u128) {
    if (i >= vector::length(alphas)) {
        abort errors::out_of_bounds()
    };
    let cur = *vector::borrow(alphas, i);
    let next = cur + stake_fp;
    if (next < cur) {
        abort errors::math_overflow()
    };
    *vector::borrow_mut(alphas, i) = next;
}

public fun dirichlet_prob_u32(alphas: &vector<u32>, i: u64): u128 {
    let len = vector::length(alphas);
    if (len == 0 || i >= len) {
        abort errors::out_of_bounds()
    };
    let mut sum = 0u128;
    let mut j = 0;
    while (j < len) {
        sum = sum + (*vector::borrow(alphas, j) as u128);
        j = j + 1;
    };
    if (sum == 0) {
        abort errors::div_by_zero()
    };
    let num = (*vector::borrow(alphas, i) as u128) << 32;
    num / sum
}

public fun update_dirichlet_buy_u32(alphas: &mut vector<u32>, i: u64, stake_usdc: u64) {
    if (i >= vector::length(alphas)) {
        abort errors::out_of_bounds()
    };
    let delta = stake_usdc / STAKE_TO_ALPHA;
    if (delta == 0) {
        abort errors::out_of_bounds()
    };
    let cur = *vector::borrow(alphas, i);
    let next = (cur as u128) + (delta as u128);
    if (next > 4294967295) {
        abort errors::math_overflow()
    };
    *vector::borrow_mut(alphas, i) = (next as u32);
}

/// Opening Auction: bucket USDC → Dirichlet prior α₀ (probabilities unchanged in shape).
public fun alphas_from_auction_buckets(buckets: &vector<u64>): vector<u32> {
    let total = buckets[0] + buckets[1] + buckets[2];
    if (total == 0) {
        abort errors::out_of_bounds()
    };
    let a0 = 10u32 + (((buckets[0] as u128) * 90) / (total as u128) as u32);
    let a1 = 10u32 + (((buckets[1] as u128) * 90) / (total as u128) as u32);
    let a2 = 10u32 + (((buckets[2] as u128) * 90) / (total as u128) as u32);
    vector[a0, a1, a2]
}
