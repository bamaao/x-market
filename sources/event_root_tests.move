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
module x_market::event_root_tests;

use sui::test_scenario::{Self as ts, Scenario};
use x_market::event_root::{Self, EventRoot};

const ADMIN: address = @0xAD;

#[test]
fun status_constants() {
    assert!(event_root::status_open() == 0, 0);
    assert!(event_root::status_trading() == 1, 1);
    assert!(event_root::status_settled() == 3, 2);
}

#[test]
fun create_and_link_sets_trading() {
    let mut scenario: Scenario = ts::begin(ADMIN);
    ts::next_tx(&mut scenario, ADMIN);
    {
        event_root::create_and_link(
            b"POISSON_FEED",
            1_700_000_000,
            object::id_from_address(@0x11),
            object::id_from_address(@0x22),
            object::id_from_address(@0x33),
            ts::ctx(&mut scenario),
        );
    };
    ts::next_tx(&mut scenario, ADMIN);
    {
        let root = ts::take_shared<EventRoot>(&scenario);
        assert!(event_root::status(&root) == event_root::status_trading(), 0);
        assert!(event_root::lock_time(&root) == 1_700_000_000, 1);
        let pool = event_root::amm_pool_id(&root);
        assert!(option::is_some(&pool), 2);
        let reg = event_root::prophet_registry_id(&root);
        assert!(option::is_some(&reg), 3);
        ts::return_shared(root);
    };
    ts::end(scenario);
}
