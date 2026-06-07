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
