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
