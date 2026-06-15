// Copyright (c) 2026 zouyc zouyccq@gmail.com.
// All rights reserved.
//
// Licensed under the Business Source License 1.1 (BSL 1.1).
// You may not use this file except in compliance with the License.
//
// Change Date: 2031-01-01
// On the Change Date, or the fourth anniversary of the first publicly available
// distribution of the code under the BSL, whichever comes first, the code
// automatically becomes available under the Apache License 2.0.

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
    assert!(prophet_registry::is_valid_seal_id_len(32), 0);
    assert!(!prophet_registry::is_valid_seal_id_len(31), 1);
    assert!(prophet_registry::is_public_at_commit(0), 2);
    assert!(!prophet_registry::is_public_at_commit(1), 3);
    assert!(prophet_registry::is_valid_seal_id_for_commit(0, 0), 4);
    assert!(!prophet_registry::is_valid_seal_id_for_commit(0, 32), 5);
    assert!(prophet_registry::is_valid_seal_id_for_commit(100, 32), 6);
    assert!(!prophet_registry::is_valid_seal_id_for_commit(100, 0), 7);
}

#[test]
fun status_constants() {
    assert!(prophet_registry::prophecy_open() == 0, 0);
    assert!(prophet_registry::prophecy_audited_win() == 1, 1);
    assert!(prophet_registry::prophecy_audited_loss() == 2, 2);
    assert!(prophet_registry::prophecy_cheat() == 3, 3);
}
