function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export interface MonitorConfig {
  packageId: string;
  poolIds: string[];
  pollMs: number;
  healthPort: number;
  lookbackSecs: number;
  alertWebhookUrl: string;
  gasStationHealthUrl: string;
  keeperHealthUrl: string;
}

export function loadConfig(): MonitorConfig {
  const poolIds = (process.env.MONITOR_POOL_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    packageId: requireEnv("X_MARKET_PACKAGE_ID"),
    poolIds,
    pollMs: numEnv("MONITOR_POLL_MS", 60_000),
    healthPort: numEnv("MONITOR_HEALTH_PORT", 8789),
    lookbackSecs: numEnv("MONITOR_LOOKBACK_SECS", 86_400),
    alertWebhookUrl: process.env.ALERT_WEBHOOK_URL?.trim() ?? "",
    gasStationHealthUrl:
      process.env.GAS_STATION_HEALTH_URL?.trim() ??
      "http://localhost:8787/health",
    keeperHealthUrl:
      process.env.KEEPER_HEALTH_URL?.trim() ?? "http://localhost:8788/health",
  };
}
