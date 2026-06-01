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
