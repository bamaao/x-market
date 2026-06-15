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

import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromBase64 } from "@mysten/sui/utils";
import { createRpcClient as createSharedRpc } from "../../shared/rpc.js";
import type { AuditKeeperConfig } from "./types.js";

export function createRpcClient(config: AuditKeeperConfig) {
  const network = process.env.SUI_NETWORK === "mainnet" ? "mainnet" : "testnet";
  return createSharedRpc(network, config.rpcUrl);
}

export function loadKeeperKeypair(secretKey: string): Ed25519Keypair {
  const trimmed = secretKey.trim();
  if (trimmed.startsWith("suiprivkey")) {
    const { secretKey: bytes } = decodeSuiPrivateKey(trimmed);
    return Ed25519Keypair.fromSecretKey(bytes);
  }
  return Ed25519Keypair.fromSecretKey(fromBase64(trimmed));
}
