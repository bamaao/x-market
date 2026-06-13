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
    return { ok: false, error: "Indexer 未配置（NEXT_PUBLIC_INDEXER_URL）" };
  }
  if (data.length === 0) {
    return { ok: false, error: "空 blob" };
  }
  if (data.length > MAX_PROPHET_BLOB_BYTES) {
    return { ok: false, error: "分析内容超过 512KB 限制" };
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
      return { ok: false, error: "Indexer 响应缺少 blob_id" };
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
