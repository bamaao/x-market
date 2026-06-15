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

import { createHash } from "node:crypto";
import type { AuditPublicInputs, AuditResult } from "./audit.js";

export interface ProverOutput {
  proofHash: Uint8Array;
  publicInputsHash: Uint8Array;
  proofSchemeCode: number;
  statusCode: number;
  brevisRequestId?: string;
}

const SCHEME_GROTH16 = 1;
const STATUS_ACCEPTED = 1;
const STATUS_REJECTED = 2;

export function hashPayload(payload: unknown): Uint8Array {
  const digest = createHash("sha256").update(JSON.stringify(payload)).digest();
  return Uint8Array.from(digest);
}

export function localProve(audit: AuditResult): ProverOutput {
  const publicInputsHash = hashPayload(audit.publicInputs);
  const proofHash = hashPayload({
    engine: "x-market-local-audit-v1",
    ok: audit.ok,
    violations: audit.violations,
    publicInputsHash: Buffer.from(publicInputsHash).toString("hex"),
  });
  return {
    proofHash,
    publicInputsHash,
    proofSchemeCode: SCHEME_GROTH16,
    statusCode: audit.ok ? STATUS_ACCEPTED : STATUS_REJECTED,
  };
}

export async function brevisProve(
  audit: AuditResult,
  options: {
    rpcUrl: string;
    partnerKey: string;
    srcChainId: number;
  },
): Promise<ProverOutput | null> {
  if (!options.rpcUrl) return null;
  const body = {
    srcChainId: options.srcChainId,
    query: {
      type: "x_market_pool_audit_v1",
      publicInputs: audit.publicInputs,
    },
    partnerKey: options.partnerKey || undefined,
  };
  try {
    const res = await fetch(`${options.rpcUrl.replace(/\/$/, "")}/v1/prove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      console.log(
        JSON.stringify({
          event: "brevis_prove_http_error",
          status: res.status,
          statusText: res.statusText,
        }),
      );
      return null;
    }
    const json = (await res.json()) as {
      proofHash?: string;
      publicInputsHash?: string;
      requestId?: string;
      valid?: boolean;
    };
    if (!json.proofHash || !json.publicInputsHash) return null;
    const proofHash = hexToBytes32(json.proofHash);
    const publicInputsHash = hexToBytes32(json.publicInputsHash);
    return {
      proofHash,
      publicInputsHash,
      proofSchemeCode: SCHEME_GROTH16,
      statusCode: json.valid === false ? STATUS_REJECTED : STATUS_ACCEPTED,
      brevisRequestId: json.requestId,
    };
  } catch (e) {
    console.log(
      JSON.stringify({
        event: "brevis_prove_error",
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    return null;
  }
}

function hexToBytes32(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length < 64) {
    throw new Error(`proof hash too short: ${hex}`);
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
