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

import { getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { NETWORK } from "./markets";

export type AppNetwork = "mainnet" | "testnet";

export function appNetwork(): AppNetwork {
  return NETWORK === "mainnet" ? "mainnet" : "testnet";
}

/** Primary → fallback → Mysten default fullnode. */
export function getRpcUrls(network: AppNetwork = appNetwork()): string[] {
  const primary = process.env.NEXT_PUBLIC_SUI_RPC_URL?.trim();
  const fallback = process.env.NEXT_PUBLIC_SUI_RPC_URL_FALLBACK?.trim();
  const defaults = [getJsonRpcFullnodeUrl(network)];
  return [...new Set([primary, fallback, ...defaults].filter(Boolean) as string[])];
}

export function primaryRpcUrl(network: AppNetwork = appNetwork()): string {
  return getRpcUrls(network)[0];
}
