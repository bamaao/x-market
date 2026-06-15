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

export type SuiNetwork = "mainnet" | "testnet";

export function resolveNetwork(): SuiNetwork {
  return process.env.SUI_NETWORK === "mainnet" ? "mainnet" : "testnet";
}

/** Primary → fallback → Mysten fullnode defaults (deduped). */
export function parseRpcUrls(network: SuiNetwork = resolveNetwork()): string[] {
  const primary = process.env.SUI_RPC_URL?.trim();
  const fallback = process.env.SUI_RPC_URL_FALLBACK?.trim();
  const defaults = [getJsonRpcFullnodeUrl(network)];
  return [...new Set([primary, fallback, ...defaults].filter(Boolean) as string[])];
}

export function createRpcClient(
  network: SuiNetwork = resolveNetwork(),
  rpcUrl?: string,
): SuiJsonRpcClient {
  const url = rpcUrl ?? parseRpcUrls(network)[0];
  return new SuiJsonRpcClient({ url, network });
}

export async function withRpcFallback<T>(
  fn: (client: SuiJsonRpcClient) => Promise<T>,
  network: SuiNetwork = resolveNetwork(),
): Promise<T> {
  const urls = parseRpcUrls(network);
  let lastErr: unknown;
  for (const url of urls) {
    try {
      return await fn(createRpcClient(network, url));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
