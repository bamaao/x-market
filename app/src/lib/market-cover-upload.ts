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

const MAX_COVER_BYTES = 2 * 1024 * 1024;

const ALLOWED_COVER_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export async function uploadMarketCover(
  file: File,
  slug: string,
): Promise<
  | { ok: true; imageUrl: string; storage?: string; cid?: string | null }
  | { ok: false; error: string }
> {
  if (!INDEXER_URL) {
    return { ok: false, error: "errors.indexerNotConfigured" };
  }
  if (file.size > MAX_COVER_BYTES) {
    return { ok: false, error: "errors.coverTooLarge" };
  }
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_COVER_TYPES.has(contentType)) {
    return { ok: false, error: "errors.coverMime" };
  }

  const headers: Record<string, string> = {
    "Content-Type": contentType,
  };
  const secret = process.env.NEXT_PUBLIC_MARKET_REGISTER_SECRET?.trim();
  if (secret) headers["X-Market-Register-Secret"] = secret;

  try {
    const res = await fetch(
      `${INDEXER_URL}/v1/markets/cover?slug=${encodeURIComponent(slug)}`,
      {
        method: "POST",
        headers,
        body: file,
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    const body = (await res.json()) as {
      image_url?: string;
      storage?: string;
      cid?: string | null;
    };
    if (!body.image_url) {
      return { ok: false, error: "errors.missingImageUrl" };
    }
    return {
      ok: true,
      imageUrl: body.image_url,
      storage: body.storage,
      cid: body.cid,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
