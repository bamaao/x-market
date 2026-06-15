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

import { INDEXER_URL } from "./indexer";

const MAX_PROPHET_BLOB_BYTES = 512 * 1024;

export async function uploadProphecyBlob(
  poolId: string,
  data: Uint8Array,
): Promise<
  | { ok: true; blobId: string; storage?: string; cid?: string | null }
  | { ok: false; error: string }
> {
  if (!INDEXER_URL) {
    return { ok: false, error: "errors.indexerNotConfigured" };
  }
  if (data.length === 0) {
    return { ok: false, error: "errors.emptyBlob" };
  }
  if (data.length > MAX_PROPHET_BLOB_BYTES) {
    return { ok: false, error: "errors.blobTooLarge" };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
  };
  const secret = process.env.NEXT_PUBLIC_MARKET_REGISTER_SECRET?.trim();
  if (secret) headers["X-Market-Register-Secret"] = secret;

  try {
    const res = await fetch(
      `${INDEXER_URL}/v1/prophecies/blob?pool_id=${encodeURIComponent(poolId)}`,
      {
        method: "POST",
        headers,
        body: data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ) as ArrayBuffer,
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    const body = (await res.json()) as {
      blob_id?: string;
      storage?: string;
      cid?: string | null;
    };
    if (!body.blob_id) {
      return { ok: false, error: "errors.missingBlobId" };
    }
    return {
      ok: true,
      blobId: body.blob_id,
      storage: body.storage,
      cid: body.cid,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
