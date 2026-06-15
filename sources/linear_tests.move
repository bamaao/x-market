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

#[test_only]
module x_market::linear_tests;

use x_market::position;
use x_market::risk;

#[test]
fun call_payout_positive_above_strike() {
    let payout = risk::linear_payout_usdc(position::linear_call_kind(), 5, 9, 1_000_000);
    // diff=4, divisor=10 => 400_000
    assert!(payout == 400_000, 0);
}

#[test]
fun put_payout_positive_below_strike() {
    let payout = risk::linear_payout_usdc(position::linear_put_kind(), 8, 3, 2_000_000);
    // diff=5, divisor=10 => 1_000_000
    assert!(payout == 1_000_000, 0);
}

#[test]
fun straddle_payout_is_symmetric() {
    let up = risk::linear_payout_usdc(position::straddle_kind(), 7, 10, 1_500_000);
    let down = risk::linear_payout_usdc(position::straddle_kind(), 7, 4, 1_500_000);
    assert!(up == down, 0);
}

#[test]
fun variance_swap_payout_grows_quadratically() {
    let near = risk::linear_payout_usdc(position::variance_swap_kind(), 5, 7, 1_000_000);
    let far = risk::linear_payout_usdc(position::variance_swap_kind(), 5, 11, 1_000_000);
    // (2^2)/10 vs (6^2)/10
    assert!(near == 400_000, 0);
    assert!(far == 3_600_000, 0);
    assert!(far > near, 0);
}

#[test]
fun structured_note_payout_is_capped() {
    // Strike=5, Cap=9 => max diff is 4.
    let below = risk::derivative_payout_usdc(position::structured_note_kind(), 5, 9, 4, 1_000_000);
    let mid = risk::derivative_payout_usdc(position::structured_note_kind(), 5, 9, 7, 1_000_000);
    let above = risk::derivative_payout_usdc(position::structured_note_kind(), 5, 9, 12, 1_000_000);
    assert!(below == 0, 0);
    assert!(mid == 200_000, 1);
    assert!(above == 400_000, 2);
}

#[test]
fun range_note_payout_only_inside_band() {
    // Range [4, 8], full coupon when inside.
    let low = risk::derivative_payout_usdc(position::range_note_kind(), 4, 8, 3, 1_000_000);
    let mid = risk::derivative_payout_usdc(position::range_note_kind(), 4, 8, 6, 1_000_000);
    let high = risk::derivative_payout_usdc(position::range_note_kind(), 4, 8, 10, 1_000_000);
    assert!(low == 0, 0);
    assert!(mid == 1_000_000, 1);
    assert!(high == 0, 2);
}

#[test]
fun barrier_note_payout_only_above_barrier() {
    let below = risk::derivative_payout_usdc(position::barrier_note_kind(), 6, 6, 4, 1_000_000);
    let at = risk::derivative_payout_usdc(position::barrier_note_kind(), 6, 6, 6, 1_000_000);
    let above = risk::derivative_payout_usdc(position::barrier_note_kind(), 6, 6, 12, 1_000_000);
    assert!(below == 0, 0);
    assert!(at == 1_000_000, 1);
    assert!(above == 1_000_000, 2);
}
