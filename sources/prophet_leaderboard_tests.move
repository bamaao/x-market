#[test_only]
module x_market::prophet_leaderboard_tests;

use x_market::prophet_leaderboard;

#[test]
fun accuracy_and_score() {
    assert!(prophet_leaderboard::accuracy_bps(7, 3) == 7000, 0);
    assert!(prophet_leaderboard::accuracy_bps(0, 0) == 0, 1);
    let score = prophet_leaderboard::prophet_score_bps(8, 2, 10, 5_000_000);
    assert!(score > 0, 2);
}

#[test]
fun experience_cap() {
    assert!(prophet_leaderboard::experience_bps(50) == 5000, 0);
    assert!(prophet_leaderboard::experience_bps(100) == 10000, 1);
    assert!(prophet_leaderboard::experience_bps(200) == 10000, 2);
}

#[test]
fun audit_updates_streak() {
    let mut stats = prophet_leaderboard::new_stats(@0x1);
    prophet_leaderboard::record_audit_win(&mut stats, 1_000_000);
    assert!(prophet_leaderboard::wins(&stats) == 1, 0);
    assert!(prophet_leaderboard::score_bps(&stats) > 0, 1);
    prophet_leaderboard::record_audit_loss(&mut stats, 0);
    assert!(prophet_leaderboard::losses(&stats) == 1, 2);
    prophet_leaderboard::record_cheat(&mut stats);
}
