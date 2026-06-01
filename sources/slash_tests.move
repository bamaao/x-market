#[test_only]
module x_market::slash_tests;

use x_market::slash;

#[test]
fun can_slash_within_collateral() {
    assert!(slash::can_slash(1, 1), 0);
    assert!(slash::can_slash(500_000, 1_000_000), 1);
    assert!(slash::can_slash(1_000_000, 1_000_000), 2);
}

#[test]
fun cannot_slash_zero_or_excess() {
    assert!(!slash::can_slash(0, 1_000_000), 0);
    assert!(!slash::can_slash(1_000_001, 1_000_000), 1);
    assert!(!slash::can_slash(10, 0), 2);
}

#[test]
fun bps_limit_checks() {
    assert!(slash::within_bps_limit(300, 1_000, slash::slash_max_single_bps()), 0);
    assert!(!slash::within_bps_limit(301, 1_000, slash::slash_max_single_bps()), 1);
    assert!(slash::within_bps_limit(500, 1_000, slash::slash_max_cycle_bps()), 2);
    assert!(!slash::within_bps_limit(501, 1_000, slash::slash_max_cycle_bps()), 3);
    assert!(!slash::within_bps_limit(1, 0, slash::slash_max_single_bps()), 4);
}

#[test]
fun threshold_validation_checks() {
    assert!(slash::is_valid_threshold(1, 1), 0);
    assert!(slash::is_valid_threshold(2, 3), 1);
    assert!(!slash::is_valid_threshold(0, 3), 2);
    assert!(!slash::is_valid_threshold(4, 3), 3);
}

#[test]
fun quorum_reached_checks() {
    assert!(slash::quorum_reached(2, 2), 0);
    assert!(slash::quorum_reached(3, 2), 1);
    assert!(!slash::quorum_reached(1, 2), 2);
}

#[test]
fun request_lifecycle_guards() {
    assert!(slash::request_is_live(false, 100, 100), 0);
    assert!(slash::request_is_live(false, 100, 101), 1);
    assert!(!slash::request_is_live(false, 102, 101), 2);
    assert!(!slash::request_is_live(true, 100, 101), 3);
}

#[test]
fun approve_request_guards() {
    assert!(slash::can_approve_request(false, 100, 101, false), 0);
    assert!(!slash::can_approve_request(false, 102, 101, false), 1);
    assert!(!slash::can_approve_request(true, 100, 101, false), 2);
    assert!(!slash::can_approve_request(false, 100, 101, true), 3);
}

#[test]
fun execute_request_guards() {
    assert!(slash::can_execute_request(2, 2, false, 100, 101), 0);
    assert!(slash::can_execute_request(3, 2, false, 100, 101), 1);
    assert!(!slash::can_execute_request(1, 2, false, 100, 101), 2);
    assert!(!slash::can_execute_request(2, 2, true, 100, 101), 3);
    assert!(!slash::can_execute_request(2, 2, false, 102, 101), 4);
}
