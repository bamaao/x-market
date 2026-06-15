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

/// Prophet Score and stats (PRD §11.3.5).
module x_market::prophet_leaderboard;

const W1_BPS: u64 = 6000;
const W2_BPS: u64 = 2000;
const W3_BPS: u64 = 2000;
const MAX_EXPERIENCE_GAMES: u64 = 100;
const REVENUE_SCALE_USDC: u64 = 1_000_000;
/// Minimum audited games before paid unlock (PRD §11.3.7).
const MIN_AUDITED_FOR_PAID: u64 = 3;
/// Minimum Prophet Score (bps) before paid unlock — 40.0 / 100.
const MIN_SCORE_BPS_FOR_PAID: u64 = 4000;
/// Max Normal interval width (tenths) for precision scoring — 20.0 pp.
const NORMAL_MAX_INTERVAL_WIDTH: u64 = 200;

public struct ProphetStats has store, copy, drop {
    prophet: address,
    wins: u64,
    losses: u64,
    cheats: u64,
    current_streak: u64,
    max_streak: u64,
    total_audited: u64,
    total_unlock_revenue: u64,
    /// Sum of per-audit precision contributions (0–10000 each); accuracy = points / audited.
    accuracy_points: u64,
    score_bps: u64,
}

public fun new_stats(prophet: address): ProphetStats {
    ProphetStats {
        prophet,
        wins: 0,
        losses: 0,
        cheats: 0,
        current_streak: 0,
        max_streak: 0,
        total_audited: 0,
        total_unlock_revenue: 0,
        accuracy_points: 0,
        score_bps: 0,
    }
}

/// Legacy win-rate helper (tests / off-chain mirrors).
public fun accuracy_bps(wins: u64, losses: u64): u64 {
    let total = wins + losses;
    if (total == 0) {
        0
    } else {
        wins * 10000 / total
    }
}

/// Normal interval win: narrower hit → higher contribution (0–10000).
public fun interval_precision_bps(width: u64): u64 {
    if (width == 0) {
        10000
    } else if (width >= NORMAL_MAX_INTERVAL_WIDTH) {
        0
    } else {
        (NORMAL_MAX_INTERVAL_WIDTH - width) * 10000 / NORMAL_MAX_INTERVAL_WIDTH
    }
}

public fun normal_max_interval_width(): u64 { NORMAL_MAX_INTERVAL_WIDTH }

public fun accuracy_bps_from_points(points: u64, audited: u64): u64 {
    if (audited == 0) {
        0
    } else {
        points / audited
    }
}

/// Log-like experience term capped at 100 effective games (PRD w2 · log(N)).
public fun experience_bps(audited: u64): u64 {
    if (audited >= MAX_EXPERIENCE_GAMES) {
        10000
    } else {
        audited * 100
    }
}

/// Revenue proxy in bps (1 USDC unlock revenue ≈ 1 score unit before cap).
public fun revenue_bps(total_revenue: u64): u64 {
    let scaled = total_revenue / REVENUE_SCALE_USDC;
    if (scaled > 10000) {
        10000
    } else {
        scaled
    }
}

public fun prophet_score_bps(
    wins: u64,
    losses: u64,
    audited: u64,
    total_revenue: u64,
): u64 {
    let a = accuracy_bps(wins, losses);
    let e = experience_bps(audited);
    let r = revenue_bps(total_revenue);
    (W1_BPS * a + W2_BPS * e + W3_BPS * r) / 10000
}

public fun prophet_score_from_stats(stats: &ProphetStats): u64 {
    let a = accuracy_bps_from_points(stats.accuracy_points, stats.total_audited);
    let e = experience_bps(stats.total_audited);
    let r = revenue_bps(stats.total_unlock_revenue);
    (W1_BPS * a + W2_BPS * e + W3_BPS * r) / 10000
}

public fun refresh_score(stats: &mut ProphetStats) {
    stats.score_bps = prophet_score_from_stats(stats);
}

public fun record_unlock_revenue(stats: &mut ProphetStats, amount: u64) {
    stats.total_unlock_revenue = stats.total_unlock_revenue + amount;
    refresh_score(stats);
}

public fun record_cheat(stats: &mut ProphetStats) {
    stats.cheats = stats.cheats + 1;
    stats.current_streak = 0;
    refresh_score(stats);
}

public fun record_audit_win(stats: &mut ProphetStats, escrow_revenue: u64, interval_width: u64) {
    stats.wins = stats.wins + 1;
    stats.total_audited = stats.total_audited + 1;
    stats.current_streak = stats.current_streak + 1;
    if (stats.current_streak > stats.max_streak) {
        stats.max_streak = stats.current_streak;
    };
    stats.accuracy_points = stats.accuracy_points + interval_precision_bps(interval_width);
    stats.total_unlock_revenue = stats.total_unlock_revenue + escrow_revenue;
    refresh_score(stats);
}

public fun record_audit_loss(stats: &mut ProphetStats, escrow_revenue: u64) {
    stats.losses = stats.losses + 1;
    stats.total_audited = stats.total_audited + 1;
    stats.current_streak = 0;
    stats.total_unlock_revenue = stats.total_unlock_revenue + escrow_revenue;
    refresh_score(stats);
}

/// PRD §11.3.7: paid unlock requires track record; free commits always allowed.
public fun paid_unlock_eligible(stats: &ProphetStats): bool {
    stats.cheats == 0 &&
        stats.total_audited >= MIN_AUDITED_FOR_PAID &&
        stats.score_bps >= MIN_SCORE_BPS_FOR_PAID
}

public fun min_audited_for_paid(): u64 { MIN_AUDITED_FOR_PAID }
public fun min_score_bps_for_paid(): u64 { MIN_SCORE_BPS_FOR_PAID }

public fun wins(stats: &ProphetStats): u64 { stats.wins }
public fun losses(stats: &ProphetStats): u64 { stats.losses }
public fun score_bps(stats: &ProphetStats): u64 { stats.score_bps }
public fun accuracy_points(stats: &ProphetStats): u64 { stats.accuracy_points }
public fun prophet(stats: &ProphetStats): address { stats.prophet }
