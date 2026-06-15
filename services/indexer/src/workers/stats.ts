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

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { IndexerConfig } from "../config.js";
import { query } from "../db.js";
import { parseMoveFields, paidUnlockEligible } from "../chain/parse.js";

export async function runStatsWorker(
  client: SuiJsonRpcClient,
  config: IndexerConfig,
): Promise<number> {
  const prophetsRes = await query<{ prophet: string }>(
    config.databaseUrl,
    "SELECT DISTINCT prophet FROM prophecies",
  );
  const prophets = prophetsRes.rows.map((r) => r.prophet);
  if (!prophets.length) return 0;

  const statsRows: {
    prophet: string;
    wins: number;
    losses: number;
    cheats: number;
    currentStreak: number;
    maxStreak: number;
    totalAudited: number;
    totalUnlockRevenue: bigint;
    scoreBps: number;
  }[] = [];

  for (const prophet of prophets) {
    try {
      const df = await client.getDynamicFieldObject({
        parentId: config.prophetRegistryId,
        name: { type: "address", value: prophet },
      });
      const fields = parseMoveFields(df.data?.content);
      if (!fields) continue;
      statsRows.push({
        prophet,
        wins: Number(fields.wins ?? 0),
        losses: Number(fields.losses ?? 0),
        cheats: Number(fields.cheats ?? 0),
        currentStreak: Number(fields.current_streak ?? 0),
        maxStreak: Number(fields.max_streak ?? 0),
        totalAudited: Number(fields.total_audited ?? 0),
        totalUnlockRevenue: BigInt(String(fields.total_unlock_revenue ?? "0")),
        scoreBps: Number(fields.score_bps ?? 0),
      });
    } catch {
      // prophet has no stats DF yet
    }
  }

  statsRows.sort((a, b) => b.scoreBps - a.scoreBps || b.wins - a.wins);

  for (let i = 0; i < statsRows.length; i++) {
    const s = statsRows[i];
    const rank = i + 1;
    const eligible = paidUnlockEligible(s);
    await query(
      config.databaseUrl,
      `INSERT INTO prophet_stats (
        prophet, wins, losses, cheats, current_streak, max_streak, total_audited,
        total_unlock_revenue, score_bps, rank, paid_unlock_eligible, refreshed_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
      ON CONFLICT (prophet) DO UPDATE SET
        wins = EXCLUDED.wins, losses = EXCLUDED.losses, cheats = EXCLUDED.cheats,
        current_streak = EXCLUDED.current_streak, max_streak = EXCLUDED.max_streak,
        total_audited = EXCLUDED.total_audited, total_unlock_revenue = EXCLUDED.total_unlock_revenue,
        score_bps = EXCLUDED.score_bps, rank = EXCLUDED.rank,
        paid_unlock_eligible = EXCLUDED.paid_unlock_eligible, refreshed_at = NOW()`,
      [
        s.prophet,
        s.wins,
        s.losses,
        s.cheats,
        s.currentStreak,
        s.maxStreak,
        s.totalAudited,
        s.totalUnlockRevenue.toString(),
        s.scoreBps,
        rank,
        eligible,
      ],
    );
    await query(
      config.databaseUrl,
      `INSERT INTO prophet_stats_history (prophet, score_bps, rank, wins, losses, snapshot_at)
       VALUES ($1,$2,$3,$4,$5,NOW())`,
      [s.prophet, s.scoreBps, rank, s.wins, s.losses],
    );
  }
  return statsRows.length;
}
