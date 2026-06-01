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
