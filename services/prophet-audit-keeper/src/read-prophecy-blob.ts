import type { AuditKeeperConfig } from "./types.js";
import { readProphecyBlobBytes } from "./prophecy-blob.js";

export async function readProphecyBlob(
  config: AuditKeeperConfig,
  blobId: string,
): Promise<Uint8Array | null> {
  return readProphecyBlobBytes(blobId, {
    indexerUrl: config.indexerUrl,
    ipfsGatewayUrl: config.ipfsGatewayUrl,
  });
}
