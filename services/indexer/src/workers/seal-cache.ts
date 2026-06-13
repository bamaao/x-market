import type { IndexerConfig } from "../config.js";
import { query } from "../db.js";
import { parseIdxBlobFilename, readProphecyBlobLocal } from "../prophecy-blobs.js";

const IPFS_GATEWAY = (process.env.IPFS_GATEWAY_URL ?? "https://w3s.link").replace(
  /\/$/,
  "",
);

function parseIpfsCid(ref: string): string | null {
  const trimmed = ref.trim();
  if (trimmed.startsWith("ipfs://")) {
    return trimmed.slice("ipfs://".length).split("/")[0]?.trim() || null;
  }
  if (trimmed.startsWith("ipfs:")) {
    return trimmed.slice("ipfs:".length).split("/")[0]?.trim() || null;
  }
  return null;
}

function isProphecyBlobId(blobId: string): boolean {
  return (
    blobId.length > 0 &&
    !blobId.startsWith("testnet:local:") &&
    (blobId.startsWith("idx:") || parseIpfsCid(blobId) !== null)
  );
}

async function readProphecyBlob(
  config: IndexerConfig,
  blobId: string,
): Promise<Uint8Array | null> {
  const idxFilename = parseIdxBlobFilename(blobId);
  if (idxFilename) {
    const data = await readProphecyBlobLocal(config.prophetBlobsDir, idxFilename);
    return data ? new Uint8Array(data) : null;
  }

  const cid = parseIpfsCid(blobId);
  if (cid) {
    try {
      const res = await fetch(`${IPFS_GATEWAY}/ipfs/${encodeURIComponent(cid)}`);
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  return null;
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
    if (!isProphecyBlobId(blobId)) continue;
    const bytes = await readProphecyBlob(config, blobId);
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
      ) VALUES ($1,$2,$3,$4,$5,'indexer',NOW())
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
