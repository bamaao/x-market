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
module x_market::risk_tests;

use x_market::risk;

#[test]
fun slot_validation_bounds() {
    assert!(risk::is_valid_slot(0), 0);
    assert!(risk::is_valid_slot(14), 1);
    assert!(!risk::is_valid_slot(15), 2);
    assert!(!risk::is_valid_slot(255), 3);
    assert!(!risk::is_valid_slot(256), 4);
}
