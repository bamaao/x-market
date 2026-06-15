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

import { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

export const GAS_STATION_URL =
  process.env.NEXT_PUBLIC_GAS_STATION_URL ?? "http://localhost:8787";

export interface SponsorApiResponse {
  transactionBytes: string;
  sponsorSignature: string;
  gasOwner: string;
}

export function isGasStationEnabled(): boolean {
  return Boolean(GAS_STATION_URL);
}

export async function requestSponsor(
  transactionKindBcs: Uint8Array,
  sender: string,
): Promise<SponsorApiResponse> {
  const res = await fetch(`${GAS_STATION_URL}/v1/sponsor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transactionKindBcs: toBase64(transactionKindBcs),
      sender,
    }),
  });
  const body = (await res.json()) as SponsorApiResponse & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `Gas Station HTTP ${res.status}`);
  }
  return body;
}

export async function buildTransactionKind(
  tx: Transaction,
  client: SuiJsonRpcClient,
  sender: string,
): Promise<Uint8Array> {
  tx.setSender(sender);
  return tx.build({ client, onlyTransactionKind: true });
}
