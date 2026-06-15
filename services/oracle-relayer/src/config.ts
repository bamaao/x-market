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

export interface RelayerConfig {
  packageId: string;
  oracleConfigId: string;
  poolIds: string[];
  pollMs: number;
  healthPort: number;
  nullifyHours: number;
  alertWebhookUrl: string;
}

export function loadConfig(): RelayerConfig {
  return {
    packageId: requireEnv("X_MARKET_PACKAGE_ID"),
    oracleConfigId: requireEnv("ORACLE_CONFIG_ID"),
    poolIds: (process.env.ORACLE_POOL_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    pollMs: numEnv("ORACLE_RELAYER_POLL_MS", 120_000),
    healthPort: numEnv("ORACLE_RELAYER_HEALTH_PORT", 8790),
    nullifyHours: numEnv("ORACLE_NULLIFY_HOURS", 72),
    alertWebhookUrl: process.env.ALERT_WEBHOOK_URL?.trim() ?? "",
  };
}
