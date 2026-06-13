import type { AuditKeeperConfig } from "./types.js";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Invalid numeric env ${name}: ${raw}`);
  return n;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

export function loadConfig(): AuditKeeperConfig {
  const poolIds = (process.env.PROPHET_AUDIT_POOL_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!poolIds.length) {
    throw new Error("PROPHET_AUDIT_POOL_IDS must list at least one pool id");
  }

  return {
    rpcUrl: process.env.SUI_RPC_URL ?? "https://fullnode.testnet.sui.io:443",
    packageId: requireEnv("X_MARKET_PACKAGE_ID"),
    registryId: requireEnv("PROPHET_REGISTRY_ID"),
    poolIds,
    pollMs: numEnv("PROPHET_AUDIT_POLL_MS", 120_000),
    dryRun: boolEnv("PROPHET_AUDIT_DRY_RUN", true),
    healthPort: numEnv("PROPHET_AUDIT_HEALTH_PORT", 8792),
    secretKey: requireEnv("PROPHET_AUDIT_KEEPER_SECRET_KEY"),
    indexerUrl: (process.env.INDEXER_URL ?? "").replace(/\/$/, ""),
    ipfsGatewayUrl: (process.env.IPFS_GATEWAY_URL ?? "https://w3s.link").replace(
      /\/$/,
      "",
    ),
    sealThreshold: numEnv("SEAL_THRESHOLD", 1),
  };
}
