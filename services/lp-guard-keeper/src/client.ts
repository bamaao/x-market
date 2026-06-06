import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromBase64 } from "@mysten/sui/utils";
import type { KeeperConfig } from "./types.js";

export function createRpcClient(config: KeeperConfig): SuiJsonRpcClient {
  const network =
    process.env.SUI_NETWORK === "mainnet" ? "mainnet" : "testnet";
  return new SuiJsonRpcClient({
    url: config.rpcUrl || getJsonRpcFullnodeUrl(network),
    network,
  });
}

export function loadKeeperKeypair(secretKey: string): Ed25519Keypair {
  const trimmed = secretKey.trim();
  if (trimmed.startsWith("suiprivkey")) {
    const { secretKey: bytes } = decodeSuiPrivateKey(trimmed);
    return Ed25519Keypair.fromSecretKey(bytes);
  }
  return Ed25519Keypair.fromSecretKey(fromBase64(trimmed));
}
