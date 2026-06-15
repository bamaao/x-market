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

import { createHash, randomUUID } from "node:crypto";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import { isValidSuiAddress, normalizeSuiAddress } from "./follows.js";
import { query } from "./db.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const COMMENT_BODY_MAX = 500;
export const COMMENT_BODY_MIN = 1;
export const COMMENT_POOL_COOLDOWN_SEC = 30;
export const COMMENT_HOURLY_LIMIT = 20;

export function normalizePoolId(poolId: string): string {
  const trimmed = poolId.trim().toLowerCase();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

export function isValidPoolId(poolId: string): boolean {
  return /^0x[a-f0-9]{1,64}$/.test(normalizePoolId(poolId));
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function buildCommentSignMessage(params: {
  poolId: string;
  author: string;
  nonce: string;
  body: string;
}): string {
  return [
    "x-market-sui/comment/v1",
    `pool_id: ${normalizePoolId(params.poolId)}`,
    `author: ${normalizeSuiAddress(params.author)}`,
    `nonce: ${params.nonce}`,
    `body_sha256: ${sha256Hex(params.body)}`,
  ].join("\n");
}

export function buildCommentDeleteSignMessage(params: {
  poolId: string;
  commentId: number;
  author: string;
  nonce: string;
}): string {
  return [
    "x-market-sui/comment-delete/v1",
    `pool_id: ${normalizePoolId(params.poolId)}`,
    `comment_id: ${params.commentId}`,
    `author: ${normalizeSuiAddress(params.author)}`,
    `nonce: ${params.nonce}`,
  ].join("\n");
}

function parseBodyText(raw: unknown): string | { error: string } {
  if (typeof raw !== "string") return { error: "body must be a string" };
  const body = raw.trim();
  if (body.length < COMMENT_BODY_MIN) return { error: "body too short" };
  if (body.length > COMMENT_BODY_MAX) return { error: "body too long" };
  return body;
}

function parseNonce(raw: unknown): string | { error: string } {
  if (typeof raw !== "string") return { error: "nonce required" };
  const nonce = raw.trim();
  if (!UUID_RE.test(nonce)) return { error: "invalid nonce" };
  return nonce;
}

export async function verifySignedMessage(
  message: string,
  signature: unknown,
  author: string,
): Promise<{ ok: true } | { error: string }> {
  if (typeof signature !== "string" || !signature.trim()) {
    return { error: "signature required" };
  }
  if (!isValidSuiAddress(author)) return { error: "invalid author address" };
  try {
    await verifyPersonalMessageSignature(
      new TextEncoder().encode(message),
      signature,
      { address: normalizeSuiAddress(author) },
    );
    return { ok: true };
  } catch {
    return { error: "invalid signature" };
  }
}

export async function checkCommentRateLimits(
  databaseUrl: string,
  poolId: string,
  author: string,
): Promise<{ ok: true } | { error: string }> {
  const recent = await query(
    databaseUrl,
    `SELECT 1 FROM market_comments
     WHERE pool_id = $1 AND author = $2 AND deleted_at IS NULL
       AND created_at > NOW() - INTERVAL '${COMMENT_POOL_COOLDOWN_SEC} seconds'
     LIMIT 1`,
    [poolId, author],
  );
  if (recent.rowCount) {
    return { error: `rate limit: wait ${COMMENT_POOL_COOLDOWN_SEC}s between comments on this market` };
  }

  const hourly = await query<{ c: number }>(
    databaseUrl,
    `SELECT COUNT(*)::int AS c FROM market_comments
     WHERE author = $1 AND deleted_at IS NULL
       AND created_at > NOW() - INTERVAL '1 hour'`,
    [author],
  );
  if ((hourly.rows[0]?.c ?? 0) >= COMMENT_HOURLY_LIMIT) {
    return { error: `rate limit: max ${COMMENT_HOURLY_LIMIT} comments per hour` };
  }
  return { ok: true };
}

export function parseCreateCommentBody(
  poolId: string,
  body: Record<string, unknown>,
): {
  poolId: string;
  author: string;
  body: string;
  nonce: string;
  signature: string;
  signMessage: string;
} | { error: string } {
  if (!isValidPoolId(poolId)) return { error: "invalid pool_id" };
  const normalizedPoolId = normalizePoolId(poolId);
  const author = normalizeSuiAddress(String(body.author ?? ""));
  if (!isValidSuiAddress(author)) return { error: "invalid author address" };

  const parsedBody = parseBodyText(body.body);
  if (typeof parsedBody === "object") return parsedBody;

  const nonce = parseNonce(body.nonce);
  if (typeof nonce === "object") return nonce;

  const signature = String(body.signature ?? "").trim();
  if (!signature) return { error: "signature required" };

  const signMessage = buildCommentSignMessage({
    poolId: normalizedPoolId,
    author,
    nonce,
    body: parsedBody,
  });

  return {
    poolId: normalizedPoolId,
    author,
    body: parsedBody,
    nonce,
    signature,
    signMessage,
  };
}

export function parseDeleteCommentBody(
  poolId: string,
  commentIdRaw: string,
  body: Record<string, unknown>,
): {
  poolId: string;
  commentId: number;
  author: string;
  nonce: string;
  signature: string;
  signMessage: string;
} | { error: string } {
  if (!isValidPoolId(poolId)) return { error: "invalid pool_id" };
  const commentId = Number(commentIdRaw);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return { error: "invalid comment id" };
  }

  const normalizedPoolId = normalizePoolId(poolId);
  const author = normalizeSuiAddress(String(body.author ?? ""));
  if (!isValidSuiAddress(author)) return { error: "invalid author address" };

  const nonce = parseNonce(body.nonce);
  if (typeof nonce === "object") return nonce;

  const signature = String(body.signature ?? "").trim();
  if (!signature) return { error: "signature required" };

  const signMessage = buildCommentDeleteSignMessage({
    poolId: normalizedPoolId,
    commentId,
    author,
    nonce,
  });

  return {
    poolId: normalizedPoolId,
    commentId,
    author,
    nonce,
    signature,
    signMessage,
  };
}

export function newCommentNonce(): string {
  return randomUUID();
}
