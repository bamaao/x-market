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
