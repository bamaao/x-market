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
