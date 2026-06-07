import type { IndexerConfig } from "../config.js";
import { query } from "../db.js";

const WALRUS_AGGREGATOR =
  process.env.WALRUS_AGGREGATOR_URL ??
  "https://aggregator.walrus-testnet.walrus.space";

function isWalrusBlobId(blobId: string): boolean {
  return blobId.length > 0 && !blobId.startsWith("testnet:local:");
}

async function readWalrusBlob(blobId: string): Promise<Uint8Array | null> {
  const url = `${WALRUS_AGGREGATOR}/v1/blobs/${encodeURIComponent(blobId)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function runSealCacheWorker(config: IndexerConfig): Promise<number> {
  const nowSec = Math.floor(Date.now() / 1000);
  const candidates = await query<{
    prophecy_id: string;
    pool_id: string;
    blob_id: string;
    lock_time: string;
    is_public: boolean;
  }>(
    config.databaseUrl,
    `SELECT p.prophecy_id, p.pool_id, p.blob_id, p.lock_time, p.is_public
     FROM prophecies p
     LEFT JOIN seal_plaintext_cache c ON c.prophecy_id = p.prophecy_id
     WHERE c.prophecy_id IS NULL
       AND p.blob_id IS NOT NULL AND p.blob_id <> ''
       AND (p.is_public = true OR p.lock_time::bigint <= $1)
     LIMIT 20`,
    [nowSec],
  );

  let cached = 0;
  for (const row of candidates.rows) {
    const blobId = row.blob_id;
    if (!isWalrusBlobId(blobId)) continue;
    const bytes = await readWalrusBlob(blobId);
    if (!bytes?.length) continue;
    let plaintextJson: Record<string, unknown>;
    try {
      plaintextJson = JSON.parse(new TextDecoder().decode(bytes)) as Record<
        string,
        unknown
      >;
      if (typeof plaintextJson.market_id !== "string") {
        continue;
      }
    } catch {
      continue;
    }
    await query(
      config.databaseUrl,
      `INSERT INTO seal_plaintext_cache (
        prophecy_id, pool_id, blob_id, plaintext_json, lock_time, source, cached_at
      ) VALUES ($1,$2,$3,$4,$5,'walrus',NOW())
      ON CONFLICT (prophecy_id) DO NOTHING`,
      [
        row.prophecy_id,
        row.pool_id,
        blobId,
        JSON.stringify(plaintextJson),
        Number(row.lock_time),
      ],
    );
    cached++;
  }
  return cached;
}
