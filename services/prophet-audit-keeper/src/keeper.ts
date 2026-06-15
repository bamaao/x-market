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

import { createRpcClient, loadKeeperKeypair } from "./client.js";
import { loadConfig } from "./config.js";
import { collectHealth, startHealthServer } from "./health.js";
import {
  discoverProphecyIds,
  fetchPoolSnapshot,
  fetchProphecySnapshot,
  isAuditable,
} from "./prophecy.js";
import { resolveAuditPlaintext } from "./plaintext.js";
import { submitAuditProphecy } from "./tx.js";

async function tickPool(
  client: ReturnType<typeof createRpcClient>,
  keypair: ReturnType<typeof loadKeeperKeypair>,
  config: ReturnType<typeof loadConfig>,
  poolId: string,
): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const pool = await fetchPoolSnapshot(client, poolId);
  if (!pool.resolved) {
    console.log(
      JSON.stringify({ event: "prophet_audit_skip_pool", poolId, reason: "not_resolved" }),
    );
    return;
  }

  const prophecyIds = await discoverProphecyIds(client, config, poolId);
  for (const prophecyId of prophecyIds) {
    const prophecy = await fetchProphecySnapshot(client, prophecyId);
    if (!prophecy || !isAuditable(prophecy, pool, nowSec)) continue;

    const plaintext = await resolveAuditPlaintext(
      client,
      config,
      keypair,
      prophecy,
      nowSec,
    );
    if (!plaintext) {
      console.log(
        JSON.stringify({
          event: "prophet_audit_skip",
          prophecyId,
          reason: "no_plaintext",
        }),
      );
      continue;
    }

    if (config.dryRun) {
      console.log(
        JSON.stringify({
          event: "prophet_audit_dry_run",
          prophecyId,
          poolId,
          prophet: prophecy.prophet,
        }),
      );
      continue;
    }

    try {
      const digest = await submitAuditProphecy(client, keypair, config, {
        prophecyId,
        poolId,
        plaintext,
      });
      console.log(
        JSON.stringify({
          event: "prophet_audit_submitted",
          prophecyId,
          poolId,
          digest,
        }),
      );
    } catch (e) {
      console.error(
        JSON.stringify({
          event: "prophet_audit_error",
          prophecyId,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const client = createRpcClient(config);
  const keypair = loadKeeperKeypair(config.secretKey);

  startHealthServer(config.healthPort, () => collectHealth(client, keypair, config));

  const run = async () => {
    for (const poolId of config.poolIds) {
      await tickPool(client, keypair, config, poolId);
    }
  };

  await run();
  setInterval(() => {
    run().catch((e) =>
      console.error(
        JSON.stringify({
          event: "prophet_audit_tick_error",
          error: e instanceof Error ? e.message : String(e),
        }),
      ),
    );
  }, config.pollMs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
