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
module x_market::math_normal_auction_tests;

use x_market::math_normal;

#[test]
fun mu_sigma_from_equal_buckets() {
    let buckets = vector[100u64, 100, 100];
    let (mu, sigma) = math_normal::mu_sigma_tenths_from_auction_buckets(&buckets);
    assert!(mu == 25, 0);
    assert!(sigma == 4, 1);
}

#[test]
fun mu_sigma_skew_high_expectation() {
    let buckets = vector[50u64, 50, 200];
    let (mu, sigma) = math_normal::mu_sigma_tenths_from_auction_buckets(&buckets);
    assert!(mu > 25, 0);
    assert!(sigma > 4, 1);
}
