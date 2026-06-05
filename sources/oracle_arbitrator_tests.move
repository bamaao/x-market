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
fun quorum_and_case_lifecycle() {
    assert!(oracle_arbitrator::quorum_reached(2, 2), 0);
    assert!(!oracle_arbitrator::quorum_reached(1, 2), 1);
    assert!(oracle_arbitrator::case_is_live(0, 100, 200), 2);
    assert!(!oracle_arbitrator::case_is_live(1, 100, 200), 3);
}

#[test]
fun verdict_propose_and_approve_guards() {
    assert!(
        oracle_arbitrator::can_propose_verdict(0, 100, 200, oracle_arbitrator::verdict_proposer_wins()),
        0,
    );
    assert!(
        !oracle_arbitrator::can_propose_verdict(0, 201, 200, oracle_arbitrator::verdict_proposer_wins()),
        1,
    );
    assert!(
        oracle_arbitrator::can_approve_verdict(
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
            0,
            100,
            200,
            oracle_arbitrator::verdict_disputer_wins(),
            oracle_arbitrator::verdict_disputer_wins(),
            28,
            30,
            false,
        ),
        3,
    );
}

#[test]
fun execute_requires_quorum_and_verdict() {
    assert!(
        oracle_arbitrator::can_execute_arbitration(
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
            0,
            100,
            200,
            1,
            2,
            oracle_arbitrator::verdict_unresolved(),
        ),
        1,
    );
    assert!(
        !oracle_arbitrator::can_execute_arbitration(
            0,
            100,
            200,
            2,
            2,
            oracle_arbitrator::verdict_none(),
        ),
        2,
    );
}
