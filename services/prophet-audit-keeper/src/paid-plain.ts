// Copyright (c) 2026 zouyc zouyccq@gmail.com.
// BCS plaintext for paid prophecies — must match sources/prophet_plain.move
import { bcs, fromHex } from "@mysten/bcs";
import { blake2b } from "@noble/hashes/blake2b";
import { normalizeSuiObjectId, SUI_ADDRESS_LENGTH } from "@mysten/sui/utils";

const poolIdBcs = bcs.bytes(SUI_ADDRESS_LENGTH);

const PaidProphecyPlain = bcs.struct("PaidProphecyPlain", {
  pool_id: poolIdBcs,
  predicted_value: bcs.u64(),
  predicted_low: bcs.u64(),
  predicted_high: bcs.u64(),
  analysis: bcs.vector(bcs.u8()),
});

export interface PaidProphecyPayload {
  market_id: string;
  predicted_value: number;
  predicted_low?: number;
  predicted_high?: number;
  analysis_content: string;
}

export function encodePaidProphecyPlain(
  poolId: string,
  payload: PaidProphecyPayload,
): Uint8Array {
  const lo =
    payload.predicted_low !== undefined
      ? payload.predicted_low
      : payload.predicted_value;
  const hi =
    payload.predicted_high !== undefined
      ? payload.predicted_high
      : payload.predicted_value;
  return PaidProphecyPlain.serialize({
    pool_id: fromHex(normalizeSuiObjectId(poolId).replace(/^0x/i, "")),
    predicted_value: BigInt(payload.predicted_value),
    predicted_low: BigInt(lo),
    predicted_high: BigInt(hi),
    analysis: Array.from(new TextEncoder().encode(payload.analysis_content)),
  }).toBytes();
}

function canonicalProphecyJson(payload: PaidProphecyPayload): string {
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

export function buildAuditPlaintextBytes(
  poolId: string,
  unlockPrice: bigint,
  payload: PaidProphecyPayload,
): Uint8Array {
  if (unlockPrice > 0n) {
    return encodePaidProphecyPlain(poolId, payload);
  }
  return new TextEncoder().encode(canonicalProphecyJson(payload));
}

export function hashPlaintextBytes(bytes: Uint8Array): string {
  const digest = blake2b(bytes, { dkLen: 32 });
  return Array.from(digest)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
