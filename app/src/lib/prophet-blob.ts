import { INDEXER_URL } from "./indexer";
import { ipfsCidToGatewayUrl, parseIpfsCid } from "./ipfs";

export function parseIdxBlobFilename(blobId: string): string | null {
  if (!blobId.startsWith("idx:")) return null;
  const filename = blobId.slice("idx:".length).trim();
  if (!/^[a-f0-9-]+\.bin$/i.test(filename)) return null;
  return filename;
}

export function isProphecyBlobId(blobId: string): boolean {
  if (!blobId.length || blobId.startsWith("testnet:local:")) return false;
  return blobId.startsWith("idx:") || parseIpfsCid(blobId) !== null;
}

async function readIdxBlob(blobId: string): Promise<Uint8Array> {
  if (!INDEXER_URL) {
    throw new Error("Indexer 未配置，无法读取 idx: blob");
  }
  const filename = parseIdxBlobFilename(blobId);
  if (!filename) {
    throw new Error("无效的 idx: blob_id");
  }
  const url = `${INDEXER_URL}/v1/prophecies/blobs/${encodeURIComponent(filename)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Indexer blob 读取失败 (${res.status})`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function readIpfsBlob(blobId: string): Promise<Uint8Array> {
  const cid = parseIpfsCid(blobId);
  if (!cid) {
    throw new Error("无效的 ipfs: blob_id");
  }
  const url = ipfsCidToGatewayUrl(cid);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`IPFS 读取失败 (${res.status})`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/** Read prophecy body bytes (Seal ciphertext or public JSON). */
export async function readProphecyBlob(blobId: string): Promise<Uint8Array> {
  if (blobId.startsWith("idx:")) {
    return readIdxBlob(blobId);
  }
  if (parseIpfsCid(blobId)) {
    return readIpfsBlob(blobId);
  }
  throw new Error(`不支持的 blob_id（需 idx: 或 ipfs: 前缀）: ${blobId.slice(0, 32)}…`);
}
