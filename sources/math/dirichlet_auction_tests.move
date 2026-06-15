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
module x_market::math_dirichlet_auction_tests;

use x_market::math_dirichlet;

#[test]
fun alphas_from_equal_buckets() {
    let buckets = vector[100u64, 100, 100];
    let alphas = math_dirichlet::alphas_from_auction_buckets(&buckets);
    assert!(alphas[0] == 40 && alphas[1] == 40 && alphas[2] == 40, 0);
}

#[test]
fun alphas_skew_home_win() {
    let buckets = vector[200u64, 50, 50];
    let alphas = math_dirichlet::alphas_from_auction_buckets(&buckets);
    assert!(alphas[0] > alphas[1], 0);
    assert!(alphas[0] > alphas[2], 1);
}
