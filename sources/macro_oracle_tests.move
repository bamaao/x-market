#[test_only]
module x_market::macro_oracle_tests;

use x_market::macro_oracle;

#[test]
fun propose_guards() {
    assert!(macro_oracle::can_propose(0, false, false, 200, 100), 0);
    assert!(!macro_oracle::can_propose(1, false, false, 200, 100), 1);
    assert!(!macro_oracle::can_propose(0, true, false, 200, 100), 2);
    assert!(!macro_oracle::can_propose(0, false, true, 200, 100), 3);
    assert!(!macro_oracle::can_propose(0, false, false, 50, 100), 4);
}

#[test]
fun dispute_and_finalize_guards() {
    assert!(macro_oracle::can_dispute(0, 100, 200, false), 0);
    assert!(!macro_oracle::can_dispute(0, 201, 200, false), 1);
    assert!(!macro_oracle::can_dispute(1, 100, 200, false), 2);
    assert!(macro_oracle::can_finalize_assertion(0, 201, 200), 3);
    assert!(!macro_oracle::can_finalize_assertion(0, 200, 200), 4);
    assert!(!macro_oracle::can_finalize_assertion(1, 300, 200), 5);
}

#[test]
fun nullify_guard() {
    let event = 1000;
    let after = event + macro_oracle::nullify_after_event_secs();
    assert!(!macro_oracle::can_nullify_feed(0, false, after - 1, event), 0);
    assert!(macro_oracle::can_nullify_feed(0, false, after, event), 1);
    assert!(!macro_oracle::can_nullify_feed(0, true, after, event), 2);
}

#[test]
fun identifier_bounds() {
    assert!(macro_oracle::is_valid_identifier_len(1), 0);
    assert!(macro_oracle::is_valid_identifier_len(64), 1);
    assert!(!macro_oracle::is_valid_identifier_len(0), 2);
    assert!(!macro_oracle::is_valid_identifier_len(65), 3);
}

#[test]
fun assertion_status_constants() {
    assert!(macro_oracle::assertion_proposed() == 0, 0);
    assert!(macro_oracle::assertion_disputed() == 1, 1);
    assert!(macro_oracle::assertion_finalized() == 2, 2);
    assert!(macro_oracle::assertion_rejected() == 3, 3);
}

#[test]
fun feed_status_constants() {
    assert!(macro_oracle::feed_open() == 0, 0);
    assert!(macro_oracle::feed_finalized() == 1, 1);
    assert!(macro_oracle::feed_nullified() == 2, 2);
}
