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
