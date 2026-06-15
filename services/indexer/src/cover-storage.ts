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

import type { IndexerConfig } from "./config.js";
import { coverExtension, saveMarketCover } from "./covers.js";
import { pinMarketCoverToIpfs } from "./ipfs-pin.js";

export type CoverStorageResult = {
  imageUrl: string;
  storage: "local" | "ipfs";
  filename?: string;
  cid?: string;
};

const MAX_COVER_BYTES = 2 * 1024 * 1024;

export function assertValidCover(contentType: string, data: Buffer): void {
  if (data.length === 0) {
    throw new Error("empty cover payload");
  }
  if (data.length > MAX_COVER_BYTES) {
    throw new Error("cover exceeds 2MB limit");
  }
  if (!coverExtension(contentType)) {
    throw new Error("unsupported cover content type");
  }
}

export async function storeMarketCover(
  config: IndexerConfig,
  slug: string,
  contentType: string,
  data: Buffer,
): Promise<CoverStorageResult> {
  assertValidCover(contentType, data);

  if (config.coverStorage === "ipfs") {
    const pinned = await pinMarketCoverToIpfs(config, slug, contentType, data);
    return {
      imageUrl: pinned.imageUrl,
      storage: "ipfs",
      cid: pinned.cid,
    };
  }

  const saved = await saveMarketCover(config.coversDir, slug, contentType, data);
  return {
    imageUrl: saved.imageUrl,
    storage: "local",
    filename: saved.filename,
  };
}
