#[test_only]
module x_market::zk_coprocessor_tests;

use x_market::zk_coprocessor;

#[test]
fun valid_status_codes() {
    assert!(zk_coprocessor::is_valid_status_code(1), 0);
    assert!(zk_coprocessor::is_valid_status_code(2), 1);
    assert!(zk_coprocessor::is_valid_status_code(3), 2);
}

#[test]
fun invalid_status_codes() {
    assert!(!zk_coprocessor::is_valid_status_code(0), 0);
    assert!(!zk_coprocessor::is_valid_status_code(4), 1);
    assert!(!zk_coprocessor::is_valid_status_code(255), 2);
}
