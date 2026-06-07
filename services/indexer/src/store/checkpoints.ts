import { query } from "../db.js";

export async function getCheckpoint(
  databaseUrl: string,
  stream: string,
): Promise<string | null> {
  const res = await query<{ cursor_json: string | null }>(
    databaseUrl,
    "SELECT cursor_json FROM indexer_checkpoints WHERE stream = $1",
    [stream],
  );
  return res.rows[0]?.cursor_json ?? null;
}

export async function setCheckpoint(
  databaseUrl: string,
  stream: string,
  cursor: string | null,
): Promise<void> {
  await query(
    databaseUrl,
    `INSERT INTO indexer_checkpoints (stream, cursor_json, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (stream) DO UPDATE SET cursor_json = EXCLUDED.cursor_json, updated_at = NOW()`,
    [stream, cursor],
  );
}
