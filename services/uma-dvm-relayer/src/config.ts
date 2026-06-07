function requireEnv(name: string): string {
  const v = process.env[name];
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

export type UmaDvmMode = "mock" | "live";

export interface UmaDvmRelayerConfig {
  network: string;
  rpcUrl: string;
  rpcUrlFallback: string;
  packageId: string;
  oracleConfigId: string;
  arbitratorId: string;
  relayerSecretKey: string;
  pollMs: number;
  healthPort: number;
  mode: UmaDvmMode;
  mockDelayMs: number;
  mockVerdict: number;
  mockResolvedValue: bigint;
  umaApiUrl: string;
  alertWebhookUrl: string;
}

export function loadConfig(): UmaDvmRelayerConfig {
  const mode = (process.env.UMA_DVM_MODE ?? "mock") as UmaDvmMode;
  if (mode !== "mock" && mode !== "live") {
    throw new Error(`UMA_DVM_MODE must be mock or live, got ${mode}`);
  }
  return {
    network: process.env.SUI_NETWORK ?? "testnet",
    rpcUrl: requireEnv("SUI_RPC_URL"),
    rpcUrlFallback: process.env.SUI_RPC_URL_FALLBACK ?? "",
    packageId: requireEnv("X_MARKET_PACKAGE_ID"),
    oracleConfigId: requireEnv("ORACLE_CONFIG_ID"),
    arbitratorId: requireEnv("ORACLE_ARBITRATOR_ID"),
    relayerSecretKey: requireEnv("UMA_DVM_RELAYER_SECRET_KEY"),
    pollMs: numEnv("UMA_DVM_POLL_MS", 60_000),
    healthPort: numEnv("UMA_DVM_HEALTH_PORT", 8793),
    mode,
    mockDelayMs: numEnv("UMA_DVM_MOCK_DELAY_MS", 5_000),
    mockVerdict: numEnv("UMA_DVM_MOCK_VERDICT", 2),
    mockResolvedValue: BigInt(process.env.UMA_DVM_MOCK_RESOLVED_VALUE ?? "0"),
    umaApiUrl: process.env.UMA_API_URL ?? "",
    alertWebhookUrl: process.env.ALERT_WEBHOOK_URL ?? "",
  };
}
