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

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withRpcFallback } from "../../shared/rpc.js";
import { loadConfig } from "./config.js";
import { getPool } from "./db.js";
import { createApiServer } from "./api/server.js";
import { seedMarketsFromDeploy } from "./workers/seed.js";
import { runEventWorker } from "./workers/events.js";
import { runSnapshotWorker } from "./workers/snapshots.js";
import { runStatsWorker } from "./workers/stats.js";
import {
  refreshAllProphecies,
  refreshAllArbitrationCases,
} from "./workers/refresh.js";
import { refreshBuyerRoiSummaries } from "./workers/roi-summary.js";
import { runSealCacheWorker } from "./workers/seal-cache.js";
import {
  seedEventRootsFromDeploy,
  refreshEventRoots,
} from "./workers/event-roots.js";
import { refreshProphetGmvDaily } from "./workers/gmv.js";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function runMigrations(databaseUrl: string) {
  const pool = getPool(databaseUrl);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const applied = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE version = $1",
      [file],
    );
    if (applied.rowCount) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await pool.query(sql);
    await pool.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
    console.log(JSON.stringify({ event: "indexer_migration", file }));
  }
}

async function main() {
  const config = loadConfig();
  await runMigrations(config.databaseUrl);

  const state = { lastEventAt: null as string | null, lastSnapshotAt: null as string | null };
  createApiServer(config, state);

  await withRpcFallback(async (client) => {
    await seedMarketsFromDeploy(client, config);
    await seedEventRootsFromDeploy(config);
    const ev = await runEventWorker(client, config);
    const sn = await runSnapshotWorker(client, config);
    const st = await runStatsWorker(client, config);
    await refreshAllProphecies(client, config);
    await refreshAllArbitrationCases(client, config);
    await refreshBuyerRoiSummaries(config);
    await refreshEventRoots(client, config);
    await refreshProphetGmvDaily(config);
    await runSealCacheWorker(config);
    state.lastEventAt = new Date().toISOString();
    state.lastSnapshotAt = new Date().toISOString();
    console.log(
      JSON.stringify({
        event: "indexer_bootstrap_tick",
        events: ev,
        snapshots: sn,
        stats: st,
      }),
    );
  });

  setInterval(() => {
    withRpcFallback(async (client) => {
      const n = await runEventWorker(client, config);
      if (n > 0) await refreshAllProphecies(client, config);
      state.lastEventAt = new Date().toISOString();
      console.log(JSON.stringify({ event: "indexer_event_tick", indexed: n }));
    }).catch((e) =>
      console.error(JSON.stringify({ event: "indexer_event_error", error: String(e) })),
    );
  }, config.eventPollMs);

  setInterval(() => {
    withRpcFallback(async (client) => {
      const n = await runSnapshotWorker(client, config);
      state.lastSnapshotAt = new Date().toISOString();
      console.log(JSON.stringify({ event: "indexer_snapshot_tick", pools: n }));
    }).catch((e) =>
      console.error(JSON.stringify({ event: "indexer_snapshot_error", error: String(e) })),
    );
  }, config.snapshotPollMs);

  setInterval(() => {
    withRpcFallback(async (client) => {
      const n = await runStatsWorker(client, config);
      await refreshAllArbitrationCases(client, config);
      await refreshBuyerRoiSummaries(config);
      await refreshProphetGmvDaily(config);
      console.log(JSON.stringify({ event: "indexer_stats_tick", prophets: n }));
    }).catch((e) =>
      console.error(JSON.stringify({ event: "indexer_stats_error", error: String(e) })),
    );
  }, config.statsPollMs);

  setInterval(() => {
    withRpcFallback(async (client) => {
      const n = await refreshEventRoots(client, config);
      console.log(JSON.stringify({ event: "indexer_event_roots_tick", updated: n }));
    }).catch((e) =>
      console.error(JSON.stringify({ event: "indexer_event_roots_error", error: String(e) })),
    );
  }, 300_000);

  setInterval(() => {
    runSealCacheWorker(config)
      .then((n) => console.log(JSON.stringify({ event: "indexer_seal_cache_tick", cached: n })))
      .catch((e) =>
        console.error(JSON.stringify({ event: "indexer_seal_cache_error", error: String(e) })),
      );
  }, 120_000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
