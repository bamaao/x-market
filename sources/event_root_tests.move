#[test_only]
module x_market::event_root_tests;

use x_market::event_root;

#[test]
fun status_constants() {
    assert!(event_root::status_open() == 0, 0);
    assert!(event_root::status_settled() == 3, 1);
}
