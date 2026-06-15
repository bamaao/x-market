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

import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromBase64 } from "@mysten/sui/utils";
import type { GasStationConfig } from "./config.js";

export interface HealthReport {
  ok: boolean;
  service: string;
  network: string;
  packageId: string | null;
  gasOwner: string | null;
  gasBalanceMist: string | null;
  gasBalanceLow: boolean;
  errors: string[];
}

function loadGasPayerAddress(privateKey: string): string | null {
  if (!privateKey) return null;
  try {
    if (privateKey.startsWith("suiprivkey")) {
      const { secretKey } = decodeSuiPrivateKey(privateKey);
      return Ed25519Keypair.fromSecretKey(secretKey)
        .getPublicKey()
        .toSuiAddress();
    }
    return Ed25519Keypair.fromSecretKey(fromBase64(privateKey))
      .getPublicKey()
      .toSuiAddress();
  } catch {
    return null;
  }
}

export async function collectHealth(
  config: GasStationConfig,
): Promise<HealthReport> {
  const errors: string[] = [];
  const gasOwner = loadGasPayerAddress(config.gasPayerPrivateKey);

  if (!config.gasPayerPrivateKey) {
    errors.push("GAS_PAYER_PRIVATE_KEY not set");
  } else if (!gasOwner) {
    errors.push("GAS_PAYER_PRIVATE_KEY invalid");
  }

  if (config.production && !config.packageId) {
    errors.push("PACKAGE_ID required in production");
  }

  let gasBalanceMist: string | null = null;
  let gasBalanceLow = false;

  if (gasOwner) {
    try {
      const client = new SuiJsonRpcClient({
        url:
          config.rpcUrl ||
          getJsonRpcFullnodeUrl(
            config.network === "mainnet" ? "mainnet" : "testnet",
          ),
        network: config.network,
      });
      const balance = await client.getBalance({
        owner: gasOwner,
        coinType: "0x2::sui::SUI",
      });
      gasBalanceMist = balance.totalBalance;
      gasBalanceLow = BigInt(balance.totalBalance) < config.minGasBalanceMist;
      if (gasBalanceLow) {
        errors.push(
          `Gas payer balance below minimum (${config.minGasBalanceMist} mist)`,
        );
      }
    } catch (e) {
      errors.push(
        `RPC balance check failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  const ok = errors.length === 0;

  return {
    ok,
    service: "x-market-gas-station",
    network: config.network,
    packageId: config.packageId || null,
    gasOwner,
    gasBalanceMist,
    gasBalanceLow,
    errors,
  };
}
