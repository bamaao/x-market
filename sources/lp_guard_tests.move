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
module x_market::lp_guard_tests;

use x_market::lp_guard;

#[test]
fun effective_fee_grows_with_multiplier() {
    let fee = lp_guard::effective_fee_bps(30, 2000);
    assert!(fee == 36, 0);
}

#[test]
fun net_stake_after_fee_is_positive() {
    let stake = lp_guard::net_stake_after_fee(1_000_000, 50);
    assert!(stake == 995_000, 0);
}

#[test]
fun dirichlet_virtual_concentration_pushes_prob_to_center() {
    let p_no_virtual = lp_guard::dirichlet_prob_with_virtual(80, 100, 3, 0);
    let p_with_virtual = lp_guard::dirichlet_prob_with_virtual(80, 100, 3, 20);
    assert!(p_with_virtual < p_no_virtual, 0);
}
