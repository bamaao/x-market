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

export interface GasStationConfig {
  host: string;
  port: number;
  network: "mainnet" | "testnet";
  rpcUrl: string;
  packageId: string;
  gasPayerPrivateKey: string;
  corsOrigin: string;
  rateLimitPerMin: number;
  minGasBalanceMist: bigint;
  production: boolean;
  alertWebhookUrl: string;
  balanceCheckMs: number;
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

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

export function loadConfig(): GasStationConfig {
  const production =
    process.env.NODE_ENV === "production" ||
    process.env.GAS_STATION_PRODUCTION === "true";

  const network =
    process.env.SUI_NETWORK === "mainnet" ? "mainnet" : "testnet";
  const rpcUrl =
    process.env.SUI_RPC_URL?.trim() ||
    (network === "mainnet"
      ? "https://fullnode.mainnet.sui.io:443"
      : "https://fullnode.testnet.sui.io:443");

  const packageId = process.env.PACKAGE_ID?.trim() ?? "";
  const gasPayerPrivateKey = process.env.GAS_PAYER_PRIVATE_KEY?.trim() ?? "";

  if (production) {
    requireEnv("GAS_PAYER_PRIVATE_KEY");
    requireEnv("PACKAGE_ID");
    if (process.env.CORS_ORIGIN === "*" || !process.env.CORS_ORIGIN) {
      throw new Error(
        "Production requires explicit CORS_ORIGIN (not wildcard)",
      );
    }
  }

  return {
    host: process.env.HOST ?? "0.0.0.0",
    port: numEnv("PORT", 8787),
    network,
    rpcUrl,
    packageId,
    gasPayerPrivateKey,
    corsOrigin: process.env.CORS_ORIGIN ?? "*",
    rateLimitPerMin: numEnv("SPONSOR_RATE_LIMIT_PER_MIN", 30),
    minGasBalanceMist: BigInt(
      process.env.GAS_MIN_BALANCE_MIST ?? "500000000",
    ),
    production,
    alertWebhookUrl: process.env.ALERT_WEBHOOK_URL?.trim() ?? "",
    balanceCheckMs: numEnv("GAS_BALANCE_CHECK_MS", 300_000),
  };
}
