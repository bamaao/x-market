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
import { Transaction } from "@mysten/sui/transactions";
import type { AuditKeeperConfig } from "./types.js";

const SUI_CLOCK_ID = "0x6";

export async function submitAuditProphecy(
  client: SuiJsonRpcClient,
  keypair: Ed25519Keypair,
  config: AuditKeeperConfig,
  args: {
    prophecyId: string;
    poolId: string;
    plaintext: Uint8Array;
  },
): Promise<string> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::prophet_registry::audit_prophecy`,
    arguments: [
      tx.object(config.registryId),
      tx.object(args.prophecyId),
      tx.object(args.poolId),
      tx.pure.vector("u8", Array.from(args.plaintext)),
      tx.object(SUI_CLOCK_ID),
    ],
  });
  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true },
  });
  await client.waitForTransaction({ digest: result.digest });
  if (result.effects?.status?.status !== "success") {
    throw new Error(result.effects?.status?.error ?? "audit_prophecy failed");
  }
  return result.digest;
}
