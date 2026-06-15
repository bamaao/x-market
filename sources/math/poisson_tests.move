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
module x_market::math_poisson_tests;

use x_market::math_fixed_point as fp;
use x_market::math_poisson;

#[test]
fun pmf_lambda_2_5_k_3() {
    let lambda = fp::from_tenths(25);
    let p = math_poisson::poisson_pmf(lambda, 3);
    assert!(p > 917000000u128 && p < 919000000u128, 0);
}

#[test]
fun interval_lambda_2_5_a_2_b_3() {
    let lambda = fp::from_tenths(25);
    let p = math_poisson::poisson_interval(lambda, 2, 3);
    assert!(p > 2019000000u128 && p < 2021000000u128, 0);
}
