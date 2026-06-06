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
