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
    return { ok: false, error: "Indexer 未配置（NEXT_PUBLIC_INDEXER_URL）" };
  }
  if (file.size > MAX_COVER_BYTES) {
    return { ok: false, error: "封面超过 2MB 限制" };
  }
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_COVER_TYPES.has(contentType)) {
    return { ok: false, error: "仅支持 PNG / JPEG / WebP / SVG" };
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
      return { ok: false, error: "Indexer 响应缺少 image_url" };
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
