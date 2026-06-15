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

import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { appNetwork, getRpcUrls, primaryRpcUrl } from "./rpc-urls";

const network = appNetwork();

export const suiClient = new SuiJsonRpcClient({
  url: primaryRpcUrl(network),
  network,
});

/** Read-only RPC with primary → fallback retry (server actions / scripts). */
export async function withRpcFallback<T>(
  fn: (client: SuiJsonRpcClient) => Promise<T>,
): Promise<T> {
  const urls = getRpcUrls(network);
  let lastErr: unknown;
  for (const url of urls) {
    try {
      return await fn(new SuiJsonRpcClient({ url, network }));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
