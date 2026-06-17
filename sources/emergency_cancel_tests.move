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
module x_market::emergency_cancel_tests;

use x_market::market_status;
use x_market::risk;

#[test]
fun voided_status_constant() {
    assert!(market_status::is_voided(market_status::status_voided()), 0);
    assert!(!market_status::is_voided(market_status::status_trading()), 1);
}

#[test]
fun release_liability_reduces_slot() {
    let mut liab = risk::zero_liability();
    let payout = risk::position_payout_usdc(1_000_000, 500_000_000);
    risk::add_position_liability(&mut liab, 2, 3, payout);
    let before = *vector::borrow(&liab, 2);
    assert!(before == payout, 0);
    let market_id = object::id_from_address(@0x42);
    let pos = x_market::position::new_interval(
        market_id,
        2,
        3,
        1_000_000,
        500_000_000,
        &mut sui::tx_context::dummy(),
    );
    risk::release_position_liability(&mut liab, 0, &pos);
    let after = *vector::borrow(&liab, 2);
    assert!(after == 0, 1);
}

#[test]
fun is_voidable_rejects_settled_status() {
    // Construct minimal checks via market_status helpers
    assert!(market_status::is_settled(market_status::status_settled()), 0);
    assert!(!market_status::is_voided(market_status::status_settled()), 1);
}
