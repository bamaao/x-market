/**
 * Walrus Testnet HTTP publisher / aggregator (PRD §11, docs.wal.app).
 * Encrypted Seal ciphertext is stored as opaque bytes.
 */

export const WALRUS_PUBLISHER_URL =
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL ??
  "https://publisher.walrus-testnet.walrus.space";

export const WALRUS_AGGREGATOR_URL =
  process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL ??
  "https://aggregator.walrus-testnet.walrus.space";

export const WALRUS_STORAGE_EPOCHS = Number(
  process.env.NEXT_PUBLIC_WALRUS_EPOCHS ?? "2",
);

export function isWalrusBlobId(blobId: string): boolean {
  return blobId.length > 0 && !blobId.startsWith("testnet:local:");
}

type WalrusStoreResponse = {
  newlyCreated?: {
    blobObject?: { blobId?: string };
  };
  alreadyCertified?: { blobId?: string };
};

export async function uploadBlobToWalrus(
  data: Uint8Array,
  epochs: number = WALRUS_STORAGE_EPOCHS,
): Promise<string> {
  const url = `${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=${epochs}&deletable=true`;
  const body = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
  const res = await fetch(url, {
    method: "PUT",
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Walrus 上传失败 (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as WalrusStoreResponse;
  const blobId =
    json.newlyCreated?.blobObject?.blobId ?? json.alreadyCertified?.blobId;
  if (!blobId) {
    throw new Error("Walrus 响应缺少 blobId");
  }
  return blobId;
}

export async function readBlobFromWalrus(blobId: string): Promise<Uint8Array> {
  const url = `${WALRUS_AGGREGATOR_URL}/v1/blobs/${encodeURIComponent(blobId)}`;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      return new Uint8Array(await res.arrayBuffer());
    }
    lastErr = new Error(`Walrus 读取失败 (${res.status})`);
    if (res.status === 404 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    break;
  }
  throw lastErr ?? new Error("Walrus 读取失败");
}
