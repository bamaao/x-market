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

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { sendWebhookAlert } from "../../shared/alert.js";
import { withRpcFallback } from "../../shared/rpc.js";
import { loadProverKeypair } from "./client.js";
import { loadConfig } from "./config.js";
import { startHealth } from "./health.js";
import {
  fetchPoolAuditSnapshot,
  snapshotFingerprint,
} from "./pool-reader.js";
import { provePoolSnapshot } from "./prover/index.js";
import { submitZkVerification } from "./tx.js";

const lastFingerprint = new Map<string, string>();
const lastProofAt = new Map<string, number>();
let lastTickAt: string | null = null;
let lastError: string | null = null;
let proofsSubmitted = 0;

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function processPool(
  client: SuiJsonRpcClient,
  config: ReturnType<typeof loadConfig>,
  keypair: ReturnType<typeof loadProverKeypair>,
  poolId: string,
): Promise<void> {
  const snapshot = await fetchPoolAuditSnapshot(client, poolId);
  const fingerprint = snapshotFingerprint(snapshot);
  if (lastFingerprint.get(poolId) === fingerprint) {
    return;
  }

  if (config.mode === "mock") {
    await sleep(config.mockDelayMs);
  }

  const output = await provePoolSnapshot(config, snapshot);
  if (config.dryRun || !config.verifierPolicyId) {
    console.log(
      JSON.stringify({
        event: "zk_prover_dry_run",
        poolId,
        statusCode: output.statusCode,
        brevisRequestId: output.brevisRequestId ?? null,
        fingerprint,
      }),
    );
    lastFingerprint.set(poolId, fingerprint);
    return;
  }

  const { submitDigest, verifyDigest } = await submitZkVerification(
    client,
    keypair,
    config,
    poolId,
    output,
  );
  lastFingerprint.set(poolId, fingerprint);
  lastProofAt.set(poolId, Date.now());
  proofsSubmitted += 1;
  console.log(
    JSON.stringify({
      event: "zk_prover_submitted",
      poolId,
      mode: config.mode,
      statusCode: output.statusCode,
      submitDigest,
      verifyDigest,
      brevisRequestId: output.brevisRequestId ?? null,
    }),
  );
  await sendWebhookAlert(config.alertWebhookUrl, {
    alert: "zk_prover_submitted",
    poolId,
    submitDigest,
    verifyDigest,
    statusCode: output.statusCode,
  });
}

async function tick(config: ReturnType<typeof loadConfig>) {
  lastError = null;
  const keypair = loadProverKeypair(config.proverSecretKey);
  await withRpcFallback(async (client) => {
    for (const poolId of config.poolIds) {
      try {
        await processPool(client, config, keypair, poolId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(
          JSON.stringify({
            event: "zk_prover_pool_error",
            poolId,
            error: msg,
          }),
        );
      }
    }
  });
  lastTickAt = new Date().toISOString();
}

async function main() {
  const config = loadConfig();
  startHealth(config.healthPort, () => ({
    ok: !lastError,
    service: "x-market-brevis-zk-prover",
    mode: config.mode,
    dryRun: config.dryRun,
    pools: config.poolIds.length,
    proofsSubmitted,
    lastTickAt,
    lastProofAt: Object.fromEntries(lastProofAt),
    error: lastError,
  }));

  await tick(config);
  setInterval(() => {
    tick(config).catch((e) => {
      lastError = e instanceof Error ? e.message : String(e);
      console.error(
        JSON.stringify({ event: "brevis_zk_prover_tick_error", error: lastError }),
      );
    });
  }, config.pollMs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
