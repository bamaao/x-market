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
import type { AuditKeeperConfig, PoolSnapshot, ProphecySnapshot } from "./types.js";
import { bytesToHex, parseMoveFields, parseObjectId } from "./parse.js";

const PROPHECY_STATUS_OPEN = 0;

export async function fetchPoolSnapshot(
  client: SuiJsonRpcClient,
  poolId: string,
): Promise<PoolSnapshot> {
  const obj = await client.getObject({
    id: poolId,
    options: { showContent: true },
  });
  const fields = parseMoveFields(obj.data?.content) ?? {};
  return {
    poolId,
    resolved: Boolean(fields.resolved),
    resolvedValue:
      fields.resolved_value != null ? Number(fields.resolved_value) : null,
  };
}

export async function fetchProphecySnapshot(
  client: SuiJsonRpcClient,
  prophecyId: string,
): Promise<ProphecySnapshot | null> {
  const obj = await client.getObject({
    id: prophecyId,
    options: { showContent: true },
  });
  const fields = parseMoveFields(obj.data?.content);
  if (!fields) return null;
  return {
    id: prophecyId,
    prophet: String(fields.prophet ?? ""),
    marketId: parseObjectId(fields.market_id),
    blobId: String(fields.blob_id ?? ""),
    sealIdHex: bytesToHex(fields.seal_id),
    plaintextHashHex: bytesToHex(fields.plaintext_hash),
    predictedValue: Number(fields.predicted_value ?? 0),
    unlockPrice: BigInt(String(fields.unlock_price ?? "0")),
    lockTime: Number(fields.lock_time ?? 0),
    status: Number(fields.status ?? 0),
    isPublic: Boolean(fields.is_public),
  };
}

export function isAuditable(
  prophecy: ProphecySnapshot,
  pool: PoolSnapshot,
  nowSec: number,
): boolean {
  return (
    prophecy.status === PROPHECY_STATUS_OPEN &&
    pool.resolved &&
    nowSec >= prophecy.lockTime
  );
}

export async function discoverProphecyIds(
  client: SuiJsonRpcClient,
  config: AuditKeeperConfig,
  poolId: string,
): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | null = null;
  do {
    const page = await client.queryEvents({
      query: {
        MoveEventType: `${config.packageId}::prophet_registry::ProphecyCommitted`,
      },
      cursor: cursor as never,
      limit: 50,
    });
    cursor = page.hasNextPage ? String(page.nextCursor ?? "") || null : null;
    for (const ev of page.data) {
      const p = ev.parsedJson as {
        prophecy_id?: string;
        market_id?: string;
      } | null;
      if (p?.market_id === poolId && p.prophecy_id) {
        out.push(p.prophecy_id);
      }
    }
  } while (cursor);
  return [...new Set(out)];
}
