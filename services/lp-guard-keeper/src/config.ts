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

import type { KeeperConfig } from "./types.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env: ${name}`);
  }
  return v;
}

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid numeric env ${name}: ${raw}`);
  }
  return n;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

export function loadConfig(): KeeperConfig {
  const poolIds = (process.env.LP_GUARD_POOL_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (poolIds.length === 0) {
    throw new Error("LP_GUARD_POOL_IDS must list at least one pool object id");
  }

  return {
    rpcUrl: process.env.SUI_RPC_URL ?? "https://fullnode.testnet.sui.io:443",
    packageId: requireEnv("X_MARKET_PACKAGE_ID"),
    poolIds,
    pollMs: numEnv("LP_GUARD_POLL_MS", 30_000),
    windowSamples: numEnv("LP_GUARD_WINDOW_SAMPLES", 10),
    maxEffectiveFeeBps: numEnv("LP_GUARD_MAX_EFFECTIVE_FEE_BPS", 800),
    maxFeeMultiplierBps: numEnv("LP_GUARD_MAX_FEE_MULTIPLIER_BPS", 30_000),
    maxSigmaVirtualTenths: numEnv("LP_GUARD_MAX_SIGMA_VIRTUAL_TENTHS", 20),
    maxConcentrationVirtual: numEnv("LP_GUARD_MAX_CONCENTRATION_VIRTUAL", 50),
    decayFactor: numEnv("LP_GUARD_DECAY_FACTOR", 0.85),
    updateThresholdBps: numEnv("LP_GUARD_UPDATE_THRESHOLD_BPS", 200),
    dryRun: boolEnv("LP_GUARD_DRY_RUN", true),
    healthPort: numEnv("LP_GUARD_HEALTH_PORT", 8788),
    secretKey: requireEnv("LP_GUARD_KEEPER_SECRET_KEY"),
  };
}
