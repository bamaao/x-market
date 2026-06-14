import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { blake2b } from "@noble/hashes/blake2b";
import type { AuditKeeperConfig, ProphecySnapshot } from "./types.js";
import { decryptProphecyPlaintext } from "./seal.js";
import { readProphecyBlob } from "./read-prophecy-blob.js";

function isReadableBlobId(blobId: string): boolean {
  return blobId.length > 0 && !blobId.startsWith("testnet:local:");
}

function canonicalProphecyJson(payload: Record<string, unknown>): string {
  const body: Record<string, unknown> = {
    market_id: payload.market_id,
    predicted_value: payload.predicted_value,
    analysis_content: payload.analysis_content,
  };
  if (payload.predicted_low != null && payload.predicted_high != null) {
    body.predicted_low = payload.predicted_low;
    body.predicted_high = payload.predicted_high;
  }
  return JSON.stringify(body);
}

function isValidProphecyJson(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return (
      typeof parsed.market_id === "string" &&
      typeof parsed.predicted_value === "number" &&
      typeof parsed.analysis_content === "string"
    );
  } catch {
    return false;
  }
}

function hashMatches(json: string, prophecy: ProphecySnapshot): boolean {
  const digest = blake2b(new TextEncoder().encode(json), { dkLen: 32 });
  const hex = Array.from(digest)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === prophecy.plaintextHashHex;
}

async function fetchIndexerPlaintext(
  config: AuditKeeperConfig,
  prophecyId: string,
): Promise<string | null> {
  if (!config.indexerUrl) return null;
  try {
    const res = await fetch(
      `${config.indexerUrl}/v1/prophecies/${encodeURIComponent(prophecyId)}/plaintext`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      cache?: { plaintext_json?: Record<string, unknown> };
    };
    const payload = data.cache?.plaintext_json;
    if (!payload || typeof payload.market_id !== "string") return null;
    const json = canonicalProphecyJson({
      market_id: payload.market_id,
      predicted_value: Number(payload.predicted_value ?? 0),
      analysis_content: String(payload.analysis_content ?? ""),
      ...(payload.predicted_low != null && payload.predicted_high != null
        ? {
            predicted_low: Number(payload.predicted_low),
            predicted_high: Number(payload.predicted_high),
          }
        : {}),
    });
    return isValidProphecyJson(json) ? json : null;
  } catch {
    return null;
  }
}

export async function resolveAuditPlaintext(
  client: SuiJsonRpcClient,
  config: AuditKeeperConfig,
  keypair: Ed25519Keypair,
  prophecy: ProphecySnapshot,
  nowSec: number,
): Promise<string | null> {
  const fromIndexer = await fetchIndexerPlaintext(config, prophecy.id);
  if (fromIndexer && hashMatches(fromIndexer, prophecy)) {
    return fromIndexer;
  }

  if (!isReadableBlobId(prophecy.blobId)) {
    return null;
  }

  const isPublic =
    prophecy.unlockPrice === 0n || prophecy.isPublic;
  if (isPublic && !prophecy.sealIdHex) {
    const raw = await readProphecyBlob(config, prophecy.blobId);
    if (!raw?.length) return null;
    try {
      const json = new TextDecoder().decode(raw);
      if (!isValidProphecyJson(json) || !hashMatches(json, prophecy)) {
        return null;
      }
      return json;
    } catch {
      return null;
    }
  }

  if (!prophecy.sealIdHex) {
    return null;
  }
  if (nowSec < prophecy.lockTime && !prophecy.isPublic) {
    return null;
  }

  const encrypted = await readProphecyBlob(config, prophecy.blobId);
  if (!encrypted?.length) return null;

  try {
    const json = await decryptProphecyPlaintext(config, keypair, {
      prophecyId: prophecy.id,
      sealIdHex: prophecy.sealIdHex,
      encrypted,
    });
    if (!isValidProphecyJson(json) || !hashMatches(json, prophecy)) {
      return null;
    }
    return json;
  } catch {
    return null;
  }
}
