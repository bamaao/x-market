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

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { AuditKeeperConfig, ProphecySnapshot } from "./types.js";
import { decryptProphecyPlaintext } from "./seal.js";
import { readProphecyBlob } from "./read-prophecy-blob.js";
import {
  buildAuditPlaintextBytes,
  hashPlaintextBytes,
  type PaidProphecyPayload,
} from "./paid-plain.js";

function isReadableBlobId(blobId: string): boolean {
  return blobId.length > 0 && !blobId.startsWith("testnet:local:");
}

function isValidProphecyPayload(payload: PaidProphecyPayload): boolean {
  return (
    typeof payload.market_id === "string" &&
    typeof payload.predicted_value === "number" &&
    typeof payload.analysis_content === "string"
  );
}

function payloadFromIndexerJson(
  raw: Record<string, unknown>,
): PaidProphecyPayload | null {
  if (typeof raw.market_id !== "string") return null;
  const payload: PaidProphecyPayload = {
    market_id: raw.market_id,
    predicted_value: Number(raw.predicted_value ?? 0),
    analysis_content: String(raw.analysis_content ?? ""),
  };
  if (raw.predicted_low != null && raw.predicted_high != null) {
    payload.predicted_low = Number(raw.predicted_low);
    payload.predicted_high = Number(raw.predicted_high);
  }
  return isValidProphecyPayload(payload) ? payload : null;
}

function hashMatches(bytes: Uint8Array, prophecy: ProphecySnapshot): boolean {
  return hashPlaintextBytes(bytes) === prophecy.plaintextHashHex;
}

async function fetchIndexerPlaintextBytes(
  config: AuditKeeperConfig,
  prophecy: ProphecySnapshot,
): Promise<Uint8Array | null> {
  if (!config.indexerUrl) return null;
  try {
    const res = await fetch(
      `${config.indexerUrl}/v1/prophecies/${encodeURIComponent(prophecy.id)}/plaintext`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      cache?: { plaintext_json?: Record<string, unknown> };
    };
    const payload = data.cache?.plaintext_json
      ? payloadFromIndexerJson(data.cache.plaintext_json)
      : null;
    if (!payload) return null;
    const bytes = buildAuditPlaintextBytes(
      prophecy.marketId,
      prophecy.unlockPrice,
      payload,
    );
    return hashMatches(bytes, prophecy) ? bytes : null;
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
): Promise<Uint8Array | null> {
  const fromIndexer = await fetchIndexerPlaintextBytes(config, prophecy);
  if (fromIndexer) {
    return fromIndexer;
  }

  if (!isReadableBlobId(prophecy.blobId)) {
    return null;
  }

  const isPublic = prophecy.unlockPrice === 0n || prophecy.isPublic;
  if (isPublic && !prophecy.sealIdHex) {
    const raw = await readProphecyBlob(config, prophecy.blobId);
    if (!raw?.length) return null;
    if (!hashMatches(raw, prophecy)) {
      return null;
    }
    return raw;
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
    const plain = await decryptProphecyPlaintext(config, keypair, {
      prophecyId: prophecy.id,
      sealIdHex: prophecy.sealIdHex,
      encrypted,
    });
    if (!hashMatches(plain, prophecy)) {
      return null;
    }
    return plain;
  } catch {
    return null;
  }
}
