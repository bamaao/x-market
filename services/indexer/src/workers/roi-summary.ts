import type { IndexerConfig } from "../config.js";
import { query } from "../db.js";

export async function refreshBuyerRoiSummaries(config: IndexerConfig): Promise<number> {
  const buyers = await query<{ buyer: string }>(
    config.databaseUrl,
    "SELECT DISTINCT buyer FROM buyer_roi",
  );
  for (const { buyer } of buyers.rows) {
    const agg = await query<{
      total_unlock_cost: string;
      total_positions: string;
      wins: string;
      losses: string;
      cheats: string;
      pending: string;
      avg_roi: string | null;
    }>(
      config.databaseUrl,
      `SELECT
        COALESCE(SUM(unlock_cost), 0)::text AS total_unlock_cost,
        COUNT(*)::text AS total_positions,
        COUNT(*) FILTER (WHERE outcome = 'win')::text AS wins,
        COUNT(*) FILTER (WHERE outcome = 'loss')::text AS losses,
        COUNT(*) FILTER (WHERE outcome = 'cheat')::text AS cheats,
        COUNT(*) FILTER (WHERE outcome = 'pending')::text AS pending,
        AVG(roi_bps) FILTER (WHERE roi_bps IS NOT NULL)::text AS avg_roi
       FROM buyer_roi WHERE buyer = $1`,
      [buyer],
    );
    const row = agg.rows[0];
    if (!row) continue;
    await query(
      config.databaseUrl,
      `INSERT INTO buyer_roi_summary (
        buyer, total_unlock_cost, total_positions, wins, losses, cheats, pending,
        aggregate_roi_bps, refreshed_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      ON CONFLICT (buyer) DO UPDATE SET
        total_unlock_cost = EXCLUDED.total_unlock_cost,
        total_positions = EXCLUDED.total_positions,
        wins = EXCLUDED.wins, losses = EXCLUDED.losses, cheats = EXCLUDED.cheats,
        pending = EXCLUDED.pending, aggregate_roi_bps = EXCLUDED.aggregate_roi_bps,
        refreshed_at = NOW()`,
      [
        buyer,
        row.total_unlock_cost,
        Number(row.total_positions),
        Number(row.wins),
        Number(row.losses),
        Number(row.cheats),
        Number(row.pending),
        row.avg_roi != null ? Math.round(Number(row.avg_roi)) : null,
      ],
    );
  }
  return buyers.rows.length;
}
