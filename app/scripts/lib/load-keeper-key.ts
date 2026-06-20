/**
 * Load deployer/keeper key for CLI scripts (lp-guard-keeper env).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const ENV_CANDIDATES: { path: string; key: string }[] = [
  {
    path: "services/lp-guard-keeper/.env.local",
    key: "LP_GUARD_KEEPER_SECRET_KEY",
  },
  {
    path: "services/prophet-audit-keeper/.env.local",
    key: "PROPHET_AUDIT_KEEPER_SECRET_KEY",
  },
];

function readEnvValue(relPath: string, envKey: string): string | null {
  const full = join(repoRoot, relPath);
  if (!existsSync(full)) return null;
  const line = readFileSync(full, "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${envKey}=`));
  if (!line) return null;
  return line.split("=").slice(1).join("=").trim() || null;
}

export async function loadKeeperKeypair() {
  const { decodeSuiPrivateKey } = await import("@mysten/sui/cryptography");
  const { Ed25519Keypair } = await import("@mysten/sui/keypairs/ed25519");

  for (const { path, key } of ENV_CANDIDATES) {
    const raw = readEnvValue(path, key);
    if (!raw) continue;
    const { secretKey } = decodeSuiPrivateKey(raw);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }

  throw new Error(
    "Keeper key not found — run .\\scripts\\bootstrap-services-env.ps1 (lp-guard-keeper/.env.local)",
  );
}
