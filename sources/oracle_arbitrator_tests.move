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
module x_market::oracle_arbitrator_tests;

use x_market::oracle_arbitrator;

#[test]
fun threshold_validation() {
    assert!(oracle_arbitrator::is_valid_threshold(2, 3), 0);
    assert!(!oracle_arbitrator::is_valid_threshold(0, 3), 1);
    assert!(!oracle_arbitrator::is_valid_threshold(4, 3), 2);
}

#[test]
fun adapter_type_validation() {
    assert!(oracle_arbitrator::is_valid_adapter_type(oracle_arbitrator::adapter_builtin()), 0);
    assert!(oracle_arbitrator::is_valid_adapter_type(oracle_arbitrator::adapter_uma_dvm()), 1);
    assert!(!oracle_arbitrator::is_valid_adapter_type(2), 2);
}

#[test]
fun quorum_and_case_lifecycle() {
    assert!(oracle_arbitrator::quorum_reached(2, 2), 0);
    assert!(!oracle_arbitrator::quorum_reached(1, 2), 1);
    assert!(oracle_arbitrator::case_is_live(0, 100, 200), 2);
    assert!(!oracle_arbitrator::case_is_live(1, 100, 200), 3);
}

#[test]
fun verdict_propose_and_approve_guards() {
    assert!(
        oracle_arbitrator::can_propose_verdict(
            oracle_arbitrator::adapter_builtin(),
            0,
            100,
            200,
            oracle_arbitrator::verdict_proposer_wins(),
        ),
        0,
    );
    assert!(
        !oracle_arbitrator::can_propose_verdict(
            oracle_arbitrator::adapter_uma_dvm(),
            0,
            100,
            200,
            oracle_arbitrator::verdict_proposer_wins(),
        ),
        1,
    );
    assert!(
        oracle_arbitrator::can_approve_verdict(
            oracle_arbitrator::adapter_builtin(),
            0,
            100,
            200,
            oracle_arbitrator::verdict_disputer_wins(),
            oracle_arbitrator::verdict_disputer_wins(),
            28,
            28,
            false,
        ),
        2,
    );
    assert!(
        !oracle_arbitrator::can_approve_verdict(
            oracle_arbitrator::adapter_uma_dvm(),
            0,
            100,
            200,
            oracle_arbitrator::verdict_disputer_wins(),
            oracle_arbitrator::verdict_disputer_wins(),
            28,
            28,
            false,
        ),
        3,
    );
}

#[test]
fun execute_requires_quorum_and_verdict() {
    assert!(
        oracle_arbitrator::can_execute_arbitration(
            oracle_arbitrator::adapter_builtin(),
            0,
            100,
            200,
            2,
            2,
            oracle_arbitrator::verdict_unresolved(),
        ),
        0,
    );
    assert!(
        !oracle_arbitrator::can_execute_arbitration(
            oracle_arbitrator::adapter_uma_dvm(),
            0,
            100,
            200,
            2,
            2,
            oracle_arbitrator::verdict_unresolved(),
        ),
        1,
    );
    assert!(
        !oracle_arbitrator::can_execute_arbitration(
            oracle_arbitrator::adapter_builtin(),
            0,
            100,
            200,
            1,
            2,
            oracle_arbitrator::verdict_unresolved(),
        ),
        2,
    );
}

#[test]
fun uma_dvm_execute_guards() {
    assert!(
        oracle_arbitrator::can_execute_uma_dvm(
            oracle_arbitrator::adapter_uma_dvm(),
            0,
            100,
            200,
            oracle_arbitrator::verdict_disputer_wins(),
        ),
        0,
    );
    assert!(
        !oracle_arbitrator::can_execute_uma_dvm(
            oracle_arbitrator::adapter_builtin(),
            0,
            100,
            200,
            oracle_arbitrator::verdict_disputer_wins(),
        ),
        1,
    );
    assert!(
        !oracle_arbitrator::can_execute_uma_dvm(
            oracle_arbitrator::adapter_uma_dvm(),
            1,
            100,
            200,
            oracle_arbitrator::verdict_disputer_wins(),
        ),
        2,
    );
}
