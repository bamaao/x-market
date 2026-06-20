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
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import type { AuditKeeperConfig } from "./types.js";

const SUI_CLOCK_ID = "0x6";
const SEAL_KEY_SERVERS: Record<"testnet" | "mainnet", string[]> = {
  testnet: [
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
  ],
  mainnet: [],
};

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

let sealSuiSingleton: SuiJsonRpcClient | null = null;
let sealClientSingleton: SealClient | null = null;

function getSealSuiClient(): SuiJsonRpcClient {
  if (!sealSuiSingleton) {
    const network = process.env.SUI_NETWORK === "mainnet" ? "mainnet" : "testnet";
    sealSuiSingleton = new SuiJsonRpcClient({
      url: getJsonRpcFullnodeUrl(network),
      network,
    });
  }
  return sealSuiSingleton;
}

function getSealClient(): SealClient {
  if (!sealClientSingleton) {
    const network = process.env.SUI_NETWORK === "mainnet" ? "mainnet" : "testnet";
    const ids = SEAL_KEY_SERVERS[network];
    if (!ids.length) throw new Error(`No Seal key servers for ${network}`);
    sealClientSingleton = new SealClient({
      suiClient: getSealSuiClient() as never,
      serverConfigs: ids.map((objectId) => ({ objectId, weight: 1 })),
      verifyKeyServers: false,
      timeout: 30_000,
    });
  }
  return sealClientSingleton;
}

async function buildSealApproveTxBytes(
  packageId: string,
  sealId: Uint8Array,
  prophecyId: string,
  sender: string,
): Promise<Uint8Array> {
  const client = getSealSuiClient();
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: `${packageId}::prophet_registry::seal_approve_prophecy`,
    arguments: [
      tx.pure.vector("u8", Array.from(sealId)),
      tx.object(prophecyId),
      tx.object(SUI_CLOCK_ID),
    ],
  });
  return await tx.build({ client, onlyTransactionKind: true });
}

export async function decryptProphecyPlaintext(
  config: AuditKeeperConfig,
  keypair: Ed25519Keypair,
  args: {
    prophecyId: string;
    sealIdHex: string;
    encrypted: Uint8Array;
  },
): Promise<Uint8Array> {
  const sealClient = getSealClient();
  const suiClient = getSealSuiClient();
  const address = keypair.getPublicKey().toSuiAddress();
  const sessionKey = await SessionKey.create({
    address,
    packageId: config.packageId,
    ttlMin: 30,
    suiClient: suiClient as never,
  });
  const { signature } = await keypair.signPersonalMessage(
    sessionKey.getPersonalMessage(),
  );
  await sessionKey.setPersonalMessageSignature(signature);

  const sealId = hexToBytes(args.sealIdHex);
  const txBytes = await buildSealApproveTxBytes(
    config.packageId,
    sealId,
    args.prophecyId,
    address,
  );
  const plain = await sealClient.decrypt({
    data: args.encrypted,
    sessionKey,
    txBytes,
  });
  return plain;
}
