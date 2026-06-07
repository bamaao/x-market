import type { IndexerConfig } from "../config.js";
import { query } from "../db.js";

export async function refreshProphetGmvDaily(config: IndexerConfig): Promise<number> {
  const unlockRows = await query<{ day: string; gmv: string; cnt: string }>(
    config.databaseUrl,
    `SELECT date_trunc('day', unlocked_at)::date AS day,
            COALESCE(SUM(unlock_price::bigint), 0)::text AS gmv,
            COUNT(*)::text AS cnt
     FROM prophecy_unlocks
     WHERE unlocked_at >= NOW() - INTERVAL '90 days'
     GROUP BY 1`,
  );

  const auditRows = await query<{ day: string; cnt: string }>(
    config.databaseUrl,
    `SELECT date_trunc('day', updated_at)::date AS day,
            COUNT(*)::text AS cnt
     FROM prophecies
     WHERE status <> 0 AND updated_at >= NOW() - INTERVAL '90 days'
     GROUP BY 1`,
  );

  const auditByDay = new Map(
    auditRows.rows.map((r) => [r.day, Number(r.cnt)]),
  );

  for (const row of unlockRows.rows) {
    await query(
      config.databaseUrl,
      `INSERT INTO prophet_gmv_daily (day, unlock_gmv, unlock_count, prophecies_audited, refreshed_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (day) DO UPDATE SET
         unlock_gmv = EXCLUDED.unlock_gmv,
         unlock_count = EXCLUDED.unlock_count,
         prophecies_audited = EXCLUDED.prophecies_audited,
         refreshed_at = NOW()`,
      [
        row.day,
        row.gmv,
        Number(row.cnt),
        auditByDay.get(row.day) ?? 0,
      ],
    );
  }

  for (const [day, audited] of auditByDay) {
    if (unlockRows.rows.some((r) => r.day === day)) continue;
    await query(
      config.databaseUrl,
      `INSERT INTO prophet_gmv_daily (day, unlock_gmv, unlock_count, prophecies_audited, refreshed_at)
       VALUES ($1,0,0,$2,NOW())
       ON CONFLICT (day) DO UPDATE SET
         prophecies_audited = EXCLUDED.prophecies_audited,
         refreshed_at = NOW()`,
      [day, audited],
    );
  }

  return unlockRows.rows.length;
}
