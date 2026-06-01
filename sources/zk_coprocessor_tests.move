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

#[test]
fun valid_proof_hash_length_bounds() {
    assert!(!zk_coprocessor::is_valid_proof_hash_len(0), 0);
    assert!(!zk_coprocessor::is_valid_proof_hash_len(31), 1);
    assert!(zk_coprocessor::is_valid_proof_hash_len(32), 2);
    assert!(zk_coprocessor::is_valid_proof_hash_len(64), 3);
    assert!(zk_coprocessor::is_valid_proof_hash_len(128), 4);
    assert!(!zk_coprocessor::is_valid_proof_hash_len(129), 5);
}

#[test]
fun challenge_window_logic() {
    let w = zk_coprocessor::challenge_window_secs();
    assert!(zk_coprocessor::is_challenge_window_open(1000, 1000), 0);
    assert!(zk_coprocessor::is_challenge_window_open(1000, 1000 + w), 1);
    assert!(!zk_coprocessor::is_challenge_window_open(1000, 1001 + w), 2);
    assert!(!zk_coprocessor::is_challenge_window_open(1000, 999), 3);
}

#[test]
fun proof_scheme_validation() {
    assert!(zk_coprocessor::is_valid_proof_scheme(1), 0);
    assert!(zk_coprocessor::is_valid_proof_scheme(2), 1);
    assert!(zk_coprocessor::is_valid_proof_scheme(3), 2);
    assert!(!zk_coprocessor::is_valid_proof_scheme(0), 3);
    assert!(!zk_coprocessor::is_valid_proof_scheme(4), 4);
}

#[test]
fun threshold_and_quorum_validation() {
    assert!(zk_coprocessor::is_valid_threshold(1, 1), 0);
    assert!(zk_coprocessor::is_valid_threshold(2, 3), 1);
    assert!(!zk_coprocessor::is_valid_threshold(0, 3), 2);
    assert!(!zk_coprocessor::is_valid_threshold(4, 3), 3);
}

#[test]
fun challenge_guard_logic() {
    assert!(zk_coprocessor::can_challenge(false, 100, 120, 32), 0);
    assert!(zk_coprocessor::can_challenge(false, 120, 120, 64), 1);
    assert!(!zk_coprocessor::can_challenge(false, 121, 120, 64), 2);
    assert!(!zk_coprocessor::can_challenge(true, 100, 120, 64), 3);
    assert!(!zk_coprocessor::can_challenge(false, 100, 120, 31), 4);
}

#[test]
fun resolution_status_validation() {
    assert!(zk_coprocessor::is_valid_resolution_status(1), 0);
    assert!(zk_coprocessor::is_valid_resolution_status(2), 1);
    assert!(!zk_coprocessor::is_valid_resolution_status(3), 2);
    assert!(!zk_coprocessor::is_valid_resolution_status(0), 3);
}
