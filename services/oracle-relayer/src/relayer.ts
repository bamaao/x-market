import http from "node:http";
import { sendWebhookAlert } from "../../shared/alert.js";
import { withRpcFallback } from "../../shared/rpc.js";
import { loadConfig } from "./config.js";
import {
  classifyFeed,
  lookupFeedByMarket,
  readFeedSnapshot,
  resolveFeedRegistryId,
  type FeedReminderKind,
} from "./feeds.js";

interface ReminderRow {
  poolId: string;
  feedId: string;
  kind: FeedReminderKind;
  eventTs: number;
  at: string;
}

let lastTickAt: string | null = null;
let lastReminders: ReminderRow[] = [];
let lastError: string | null = null;

function startHealth(port: number) {
  const host = process.env.HOST ?? "0.0.0.0";
  const server = http.createServer((req, res) => {
    if (req.method !== "GET" || req.url !== "/health") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    const body = {
      ok: !lastError,
      service: "x-market-oracle-relayer",
      lastTickAt,
      reminders: lastReminders.length,
      error: lastError,
    };
    res.writeHead(body.ok ? 200 : 503, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  });
  server.listen(port, host, () => {
    console.log(JSON.stringify({ event: "oracle_relayer_health", host, port }));
  });
  return server;
}

async function tick(config: ReturnType<typeof loadConfig>) {
  lastError = null;
  const reminders: ReminderRow[] = [];

  await withRpcFallback(async (client) => {
    const registryId = await resolveFeedRegistryId(
      client,
      config.oracleConfigId,
    );
    if (!registryId) throw new Error("FeedRegistry not found on OracleConfig");

    for (const poolId of config.poolIds) {
      const feedId = await lookupFeedByMarket(
        client,
        config.packageId,
        registryId,
        poolId,
      );
      if (!feedId) continue;
      const snap = await readFeedSnapshot(client, feedId, poolId);
      if (!snap) continue;
      const kind = classifyFeed(snap, config.nullifyHours);
      if (!kind) continue;
      const row: ReminderRow = {
        poolId,
        feedId,
        kind,
        eventTs: snap.eventTs,
        at: new Date().toISOString(),
      };
      reminders.push(row);
      console.log(JSON.stringify({ event: "oracle_relay_reminder", ...row }));
      await sendWebhookAlert(config.alertWebhookUrl, {
        alert: "oracle_relay_reminder",
        ...row,
      });
    }
  });

  lastReminders = reminders;
  lastTickAt = new Date().toISOString();
}

async function main() {
  const config = loadConfig();
  startHealth(config.healthPort);
  await tick(config);
  setInterval(() => {
    tick(config).catch((e) => {
      lastError = e instanceof Error ? e.message : String(e);
      console.error(
        JSON.stringify({ event: "oracle_relayer_tick_error", error: lastError }),
      );
    });
  }, config.pollMs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
