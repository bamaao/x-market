/**
 * Off-chain market comments (Indexer + wallet signature).
 */

import { INDEXER_URL, indexerEnabled } from "./indexer";
import { normalizeSuiAddress } from "./prophet";

export const COMMENT_BODY_MAX = 500;

export interface MarketComment {
  id: number;
  pool_id: string;
  author: string;
  body: string;
  created_at: string;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizePoolId(poolId: string): string {
  const trimmed = poolId.trim().toLowerCase();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

export async function buildCommentSignMessage(params: {
  poolId: string;
  author: string;
  nonce: string;
  body: string;
}): Promise<string> {
  const bodySha256 = await sha256Hex(params.body);
  return [
    "x-market-sui/comment/v1",
    `pool_id: ${normalizePoolId(params.poolId)}`,
    `author: ${normalizeSuiAddress(params.author)}`,
    `nonce: ${params.nonce}`,
    `body_sha256: ${bodySha256}`,
  ].join("\n");
}

export async function buildCommentDeleteSignMessage(params: {
  poolId: string;
  commentId: number;
  author: string;
  nonce: string;
}): Promise<string> {
  return [
    "x-market-sui/comment-delete/v1",
    `pool_id: ${normalizePoolId(params.poolId)}`,
    `comment_id: ${params.commentId}`,
    `author: ${normalizeSuiAddress(params.author)}`,
    `nonce: ${params.nonce}`,
  ].join("\n");
}

export function newCommentNonce(): string {
  return crypto.randomUUID();
}

export async function fetchMarketComments(
  poolId: string,
  limit = 50,
  offset = 0,
): Promise<MarketComment[]> {
  if (!indexerEnabled() || !poolId) return [];
  const q = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const res = await fetch(
    `${INDEXER_URL}/v1/markets/${encodeURIComponent(normalizePoolId(poolId))}/comments?${q}`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { comments?: MarketComment[] };
  return data.comments ?? [];
}

export async function postMarketComment(params: {
  poolId: string;
  author: string;
  body: string;
  nonce: string;
  signature: string;
}): Promise<MarketComment> {
  if (!INDEXER_URL) throw new Error("Indexer 未配置");
  const res = await fetch(
    `${INDEXER_URL}/v1/markets/${encodeURIComponent(normalizePoolId(params.poolId))}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author: normalizeSuiAddress(params.author),
        body: params.body.trim(),
        nonce: params.nonce,
        signature: params.signature,
      }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as MarketComment & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Indexer HTTP ${res.status}`);
  }
  return data;
}

export async function deleteMarketComment(params: {
  poolId: string;
  commentId: number;
  author: string;
  nonce: string;
  signature: string;
}): Promise<void> {
  if (!INDEXER_URL) throw new Error("Indexer 未配置");
  const res = await fetch(
    `${INDEXER_URL}/v1/markets/${encodeURIComponent(normalizePoolId(params.poolId))}/comments/${params.commentId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author: normalizeSuiAddress(params.author),
        nonce: params.nonce,
        signature: params.signature,
      }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Indexer HTTP ${res.status}`);
  }
}
