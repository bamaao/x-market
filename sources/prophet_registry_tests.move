#[test_only]
module x_market::prophet_registry_tests;

use x_market::prophet_registry;

#[test]
fun commit_and_unlock_guards() {
    assert!(prophet_registry::can_commit(false, 100, 200), 0);
    assert!(!prophet_registry::can_commit(true, 100, 200), 1);
    assert!(!prophet_registry::can_commit(false, 250, 200), 2);
}

#[test]
fun unlock_cutoff_guard() {
    let lock = 1000;
    let cutoff = prophet_registry::unlock_cutoff_secs();
    assert!(prophet_registry::can_unlock(0, lock - cutoff - 1, lock, false), 0);
    assert!(!prophet_registry::can_unlock(0, lock - cutoff, lock, false), 1);
    assert!(!prophet_registry::can_unlock(0, 100, lock, true), 2);
}

#[test]
fun audit_guards() {
    assert!(!prophet_registry::can_audit(0, false, 1100, 1000), 0);
    assert!(!prophet_registry::can_audit(0, true, 900, 1000), 1);
    assert!(prophet_registry::can_audit(0, true, 1100, 1000), 2);
    assert!(!prophet_registry::can_audit(1, true, 1100, 1000), 3);
}

#[test]
fun blob_and_hash_bounds() {
    assert!(prophet_registry::is_valid_blob_id_len(1), 0);
    assert!(prophet_registry::is_valid_blob_id_len(128), 1);
    assert!(!prophet_registry::is_valid_blob_id_len(0), 2);
    assert!(prophet_registry::is_valid_plaintext_hash_len(32), 3);
    assert!(!prophet_registry::is_valid_plaintext_hash_len(31), 4);
}

#[test]
fun seal_access_policy() {
    // Documented OR: public > paid > lock_time (tested via pure helper inputs in future e2e).
    assert!(prophet_registry::is_valid_seal_id_len(32), 0);
    assert!(!prophet_registry::is_valid_seal_id_len(31), 1);
}

#[test]
fun status_constants() {
    assert!(prophet_registry::prophecy_open() == 0, 0);
    assert!(prophet_registry::prophecy_audited_win() == 1, 1);
    assert!(prophet_registry::prophecy_audited_loss() == 2, 2);
    assert!(prophet_registry::prophecy_cheat() == 3, 3);
}
