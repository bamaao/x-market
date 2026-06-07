import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromBase64 } from "@mysten/sui/utils";

export function loadRelayerKeypair(secretKey: string): Ed25519Keypair {
  const trimmed = secretKey.trim();
  if (trimmed.startsWith("suiprivkey")) {
    const { secretKey: bytes } = decodeSuiPrivateKey(trimmed);
    return Ed25519Keypair.fromSecretKey(bytes);
  }
  return Ed25519Keypair.fromSecretKey(fromBase64(trimmed));
}
