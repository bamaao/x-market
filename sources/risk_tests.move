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
