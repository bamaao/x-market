// Copyright (c) 2026 zouyc zouyccq@gmail.com.
// BCS plaintext for paid prophecies — must match sources/prophet_plain.move
import { bcs, fromHex } from "@mysten/bcs";
import { blake2b } from "@noble/hashes/blake2b";
import { normalizeSuiObjectId, SUI_ADDRESS_LENGTH } from "@mysten/sui/utils";
import type { ProphecyPayload } from "./prophet";

const poolIdBcs = bcs.bytes(SUI_ADDRESS_LENGTH);

const PaidProphecyPlain = bcs.struct("PaidProphecyPlain", {
  pool_id: poolIdBcs,
  predicted_value: bcs.u64(),
  predicted_low: bcs.u64(),
  predicted_high: bcs.u64(),
  analysis: bcs.vector(bcs.u8()),
});

export function encodePaidProphecyPlain(
  poolId: string,
  payload: ProphecyPayload,
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

export function hashPaidProphecyPlain(
  poolId: string,
  payload: ProphecyPayload,
): Uint8Array {
  const bytes = encodePaidProphecyPlain(poolId, payload);
  return blake2b(bytes, { dkLen: 32 });
}

export function decodePaidProphecyPlain(bytes: Uint8Array): ProphecyPayload {
  const decoded = PaidProphecyPlain.parse(bytes);
  const lo = Number(decoded.predicted_low);
  const hi = Number(decoded.predicted_high);
  const pv = Number(decoded.predicted_value);
  const payload: ProphecyPayload = {
    market_id: String(decoded.pool_id),
    predicted_value: pv,
    analysis_content: new TextDecoder().decode(Uint8Array.from(decoded.analysis)),
  };
  if (lo !== hi || (lo !== pv && lo !== 0)) {
    payload.predicted_low = lo;
    payload.predicted_high = hi;
  }
  return payload;
}
