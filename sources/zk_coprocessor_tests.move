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
