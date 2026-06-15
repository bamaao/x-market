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
module x_market::math_normal_tests;

use x_market::math_fixed_point as fp;
use x_market::math_normal;

#[test]
fun one_sigma_interval() {
    let p = math_normal::normal_interval(5000, 1000, 4000, false, 6000, false);
    let lo = 2900000000u128;
    let hi = 2960000000u128;
    assert!(p >= lo && p <= hi, 0);
}

#[test]
fun cpi_narrow_band() {
    let p = math_normal::normal_interval_tenths(25, 4, 25, false, 27, false);
    let lo = 800000000u128;
    let hi = 850000000u128;
    assert!(p >= lo && p <= hi, 0);
}

#[test]
fun symmetric_interval_tenths() {
    let p = math_normal::normal_interval_tenths(0, 10, 10, true, 10, false);
    let lo = 2900000000u128;
    let hi = 2960000000u128;
    assert!(p >= lo && p <= hi, 0);
}

#[test]
fun tail_tenths_positive() {
    let p = math_normal::normal_tail_tenths(25, 4, 30, false);
    assert!(p > 0 && p < fp::one(), 0);
}
