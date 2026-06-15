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
module x_market::math_dirichlet_tests;

use x_market::math_dirichlet;
use x_market::math_fixed_point as fp;

#[test]
fun equal_prior() {
    let s = fp::scale();
    let alphas = vector[10 * s, 10 * s, 10 * s];
    let p = math_dirichlet::dirichlet_prob(&alphas, 0);
    assert!(p == fp::one() / 3, 0);
}
