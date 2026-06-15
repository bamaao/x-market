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
import { pinBinaryToIpfs } from "./ipfs-pin.js";
import {
  assertProphecyBlobSize,
  saveProphecyBlobLocal,
} from "./prophecy-blobs.js";

export type ProphetBlobStorageResult = {
  blobId: string;
  storage: "local" | "ipfs";
  filename?: string;
  cid?: string;
};

export function assertProphecyBlobPayload(data: Buffer): void {
  assertProphecyBlobSize(data.length);
}

export async function storeProphecyBlob(
  config: IndexerConfig,
  poolId: string,
  data: Buffer,
): Promise<ProphetBlobStorageResult> {
  assertProphecyBlobPayload(data);

  if (config.prophetStorage === "ipfs") {
    const poolRef = poolId.trim().slice(0, 18) || "pool";
    const pinned = await pinBinaryToIpfs(
      config,
      data,
      `${poolRef}.bin`,
      `x-market-prophecy:${poolRef}`,
    );
    return {
      blobId: `ipfs:${pinned.cid}`,
      storage: "ipfs",
      cid: pinned.cid,
    };
  }

  const saved = await saveProphecyBlobLocal(config.prophetBlobsDir, poolId, data);
  return {
    blobId: saved.blobId,
    storage: "local",
    filename: saved.filename,
  };
}
