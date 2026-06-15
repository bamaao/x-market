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
module x_market::cross_margin_tests;

use x_market::cross_margin;

#[test]
fun max_liability_from_slots_works() {
    let slots = vector[100u64, 220, 180, 90];
    let max_v = cross_margin::max_liability_from_slots(&slots);
    assert!(max_v == 220, 0);
}
