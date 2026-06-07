import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { IndexerConfig } from "../config.js";
import { query } from "../db.js";
import { parseMoveFields, parseObjectId, bytesToText } from "../chain/parse.js";

export async function seedEventRootsFromDeploy(config: IndexerConfig): Promise<void> {
  const roots = config.seedDeploy?.eventRoots;
  if (!roots) return;
  for (const entry of Object.values(roots)) {
    await query(
      config.databaseUrl,
      `INSERT INTO event_roots (
        event_root_id, pool_id, feed_id, event_id, lock_time, oracle_feed_id, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,NOW())
      ON CONFLICT (event_root_id) DO UPDATE SET
        pool_id = EXCLUDED.pool_id, feed_id = EXCLUDED.feed_id,
        event_id = EXCLUDED.event_id, lock_time = EXCLUDED.lock_time,
        oracle_feed_id = EXCLUDED.oracle_feed_id, updated_at = NOW()`,
      [
        entry.eventRootId,
        entry.poolId,
        entry.feedId ?? null,
        entry.eventId,
        Number(entry.lockTime ?? 0),
        entry.feedId ?? null,
      ],
    );
  }
}

export async function refreshEventRoots(
  client: SuiJsonRpcClient,
  config: IndexerConfig,
): Promise<number> {
  const res = await query<{ event_root_id: string }>(
    config.databaseUrl,
    "SELECT event_root_id FROM event_roots",
  );
  let updated = 0;
  for (const row of res.rows) {
    const obj = await client.getObject({
      id: row.event_root_id,
      options: { showContent: true },
    });
    const fields = parseMoveFields(obj.data?.content);
    if (!fields) continue;

    let poolId: string | null = null;
    let prophetRegistryId: string | null = null;
    try {
      const amm = await client.getDynamicFieldObject({
        parentId: row.event_root_id,
        name: { type: "vector<u8>", value: "amm" },
      });
      const ammFields = parseMoveFields(amm.data?.content);
      if (ammFields) poolId = parseObjectId(ammFields.pool_id);
    } catch {
      /* optional */
    }
    try {
      const pr = await client.getDynamicFieldObject({
        parentId: row.event_root_id,
        name: { type: "vector<u8>", value: "prophet_registry" },
      });
      const prFields = parseMoveFields(pr.data?.content);
      if (prFields) prophetRegistryId = parseObjectId(prFields.registry_id);
    } catch {
      /* optional */
    }

    await query(
      config.databaseUrl,
      `UPDATE event_roots SET
        pool_id = COALESCE($2, pool_id),
        event_id = $3,
        lock_time = $4,
        status = $5,
        oracle_feed_id = $6,
        prophet_registry_id = $7,
        updated_at = NOW()
       WHERE event_root_id = $1`,
      [
        row.event_root_id,
        poolId,
        bytesToText(fields.event_id),
        Number(fields.lock_time ?? 0),
        Number(fields.status ?? 0),
        parseObjectId(fields.oracle_feed_id),
        prophetRegistryId,
      ],
    );
    updated++;
  }
  return updated;
}
