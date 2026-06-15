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

import { SealClient, SessionKey } from "@mysten/seal";
import { LocalizedError } from "@/i18n/core";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, NETWORK } from "./markets";
import { SUI_CLOCK_ID } from "./trade";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Mysten Testnet key servers (see https://seal-docs.wal.app/Pricing). */
const SEAL_KEY_SERVERS: Record<"testnet" | "mainnet", string[]> = {
  testnet: [
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
  ],
  mainnet: [],
};

export const SEAL_THRESHOLD = Number(
  process.env.NEXT_PUBLIC_SEAL_THRESHOLD ?? "1",
);

const SEAL_TTL_MIN = 30;

let sealClientSingleton: SealClient | null = null;
let sealSuiSingleton: SuiJsonRpcClient | null = null;

/** Dedicated JSON-RPC client for @mysten/seal (separate from dapp-kit instance). */
export function getSealSuiClient(): SuiJsonRpcClient {
  if (!sealSuiSingleton) {
    const network = NETWORK === "mainnet" ? "mainnet" : "testnet";
    sealSuiSingleton = new SuiJsonRpcClient({
      url: getJsonRpcFullnodeUrl(network),
      network,
    });
  }
  return sealSuiSingleton;
}

export function getSealClient(): SealClient {
  if (!sealClientSingleton) {
    const suiClient = getSealSuiClient();
    const network = NETWORK === "mainnet" ? "mainnet" : "testnet";
    const ids = SEAL_KEY_SERVERS[network];
    if (!ids.length) {
      throw new LocalizedError("errors.sealKeyServerNotConfigured", { network });
    }
    sealClientSingleton = new SealClient({
      suiClient,
      serverConfigs: ids.map((objectId) => ({ objectId, weight: 1 })),
      verifyKeyServers: false,
      timeout: 30_000,
    });
  }
  return sealClientSingleton;
}

export function generateSealId(): Uint8Array {
  const id = new Uint8Array(32);
  crypto.getRandomValues(id);
  return id;
}

export function sealIdHex(sealId: Uint8Array): string {
  return bytesToHex(sealId);
}

export async function encryptProphecyPayload(
  sealId: Uint8Array,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const client = getSealClient();
  const { encryptedObject } = await client.encrypt({
    threshold: SEAL_THRESHOLD,
    packageId: PACKAGE_ID,
    id: sealIdHex(sealId),
    data: plaintext,
  });
  return encryptedObject;
}

export async function createProphetSessionKey(
  address: string,
  signPersonalMessage: (message: Uint8Array) => Promise<string>,
): Promise<SessionKey> {
  const suiClient = getSealSuiClient();
  const sessionKey = await SessionKey.create({
    address,
    packageId: PACKAGE_ID,
    ttlMin: SEAL_TTL_MIN,
    suiClient,
  });
  const signature = await signPersonalMessage(sessionKey.getPersonalMessage());
  await sessionKey.setPersonalMessageSignature(signature);
  return sessionKey;
}

export async function buildSealApproveTxBytes(
  sealId: Uint8Array,
  prophecyId: string,
  sender: string,
): Promise<Uint8Array> {
  const suiClient = getSealSuiClient();
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: `${PACKAGE_ID}::prophet_registry::seal_approve_prophecy`,
    arguments: [
      tx.pure.vector("u8", Array.from(sealId)),
      tx.object(prophecyId),
      tx.object(SUI_CLOCK_ID),
    ],
  });
  return await tx.build({
    client: suiClient,
    onlyTransactionKind: true,
  });
}

export async function decryptProphecyPayload(
  encrypted: Uint8Array,
  sealId: Uint8Array,
  prophecyId: string,
  sessionKey: SessionKey,
  sender: string,
): Promise<Uint8Array> {
  const client = getSealClient();
  const txBytes = await buildSealApproveTxBytes(sealId, prophecyId, sender);
  return await client.decrypt({
    data: encrypted,
    sessionKey,
    txBytes,
  });
}
