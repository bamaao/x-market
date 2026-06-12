import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { blake2b } from "@noble/hashes/blake2b";
import type { AuditKeeperConfig, ProphecySnapshot } from "./types.js";
import { decryptProphecyPlaintext } from "./seal.js";

function isWalrusBlobId(blobId: string): boolean {
  return blobId.length > 0 && !blobId.startsWith("testnet:local:");
}

async function readWalrusBlob(
  config: AuditKeeperConfig,
  blobId: string,
): Promise<Uint8Array | null> {
  const url = `${config.walrusAggregatorUrl}/v1/blobs/${encodeURIComponent(blobId)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
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
    const json = JSON.stringify({
      market_id: payload.market_id,
      predicted_value: Number(payload.predicted_value ?? 0),
      analysis_content: String(payload.analysis_content ?? ""),
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

  if (!isWalrusBlobId(prophecy.blobId)) {
    return null;
  }

  const isPublic =
    prophecy.unlockPrice === 0n || prophecy.isPublic;
  if (isPublic && !prophecy.sealIdHex) {
    const raw = await readWalrusBlob(config, prophecy.blobId);
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

  const encrypted = await readWalrusBlob(config, prophecy.blobId);
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
