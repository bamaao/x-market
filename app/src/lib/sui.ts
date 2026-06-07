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
