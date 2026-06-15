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

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.toLowerCase() === "true" || raw === "1";
}

export type ZkProverMode = "mock" | "live";

export interface ZkProverConfig {
  network: string;
  rpcUrl: string;
  rpcUrlFallback: string;
  packageId: string;
  poolIds: string[];
  verifierPolicyId: string;
  proverSecretKey: string;
  pollMs: number;
  healthPort: number;
  mode: ZkProverMode;
  dryRun: boolean;
  mockDelayMs: number;
  brevisRpcUrl: string;
  brevisPartnerKey: string;
  brevisSrcChainId: number;
  alertWebhookUrl: string;
}

export function loadConfig(): ZkProverConfig {
  const mode = (process.env.ZK_PROVER_MODE ?? "mock") as ZkProverMode;
  if (mode !== "mock" && mode !== "live") {
    throw new Error(`ZK_PROVER_MODE must be mock or live, got ${mode}`);
  }
  const dryRun = boolEnv("ZK_PROVER_DRY_RUN", true);
  const policyId = process.env.ZK_VERIFIER_POLICY_ID?.trim() ?? "";
  if (!policyId && !dryRun) {
    throw new Error(
      "Missing env: ZK_VERIFIER_POLICY_ID (run scripts/init-zk-verifier-policy.ps1)",
    );
  }
  return {
    network: process.env.SUI_NETWORK ?? "testnet",
    rpcUrl: requireEnv("SUI_RPC_URL"),
    rpcUrlFallback: process.env.SUI_RPC_URL_FALLBACK ?? "",
    packageId: requireEnv("X_MARKET_PACKAGE_ID"),
    poolIds: requireEnv("ZK_PROVER_POOL_IDS")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    verifierPolicyId: policyId,
    proverSecretKey: requireEnv("ZK_PROVER_SECRET_KEY"),
    pollMs: numEnv("ZK_PROVER_POLL_MS", 120_000),
    healthPort: numEnv("ZK_PROVER_HEALTH_PORT", 8794),
    mode,
    dryRun,
    mockDelayMs: numEnv("ZK_PROVER_MOCK_DELAY_MS", 3_000),
    brevisRpcUrl: process.env.BREVIS_RPC_URL ?? "",
    brevisPartnerKey: process.env.BREVIS_PARTNER_KEY ?? "",
    brevisSrcChainId: numEnv("BREVIS_SRC_CHAIN_ID", 101),
    alertWebhookUrl: process.env.ALERT_WEBHOOK_URL ?? "",
  };
}
