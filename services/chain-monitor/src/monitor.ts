import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { sendWebhookAlert } from "../../shared/alert.js";
import { parseRpcUrls, withRpcFallback } from "../../shared/rpc.js";
import { loadConfig } from "./config.js";
import { startHealthServer } from "./health.js";
import {
  emptyState,
  type MonitorAlert,
  type MonitorState,
} from "./state.js";

const MAX_ALERTS = 200;

function pushAlert(state: MonitorState, alert: Omit<MonitorAlert, "resolved">) {
  const existing = state.alerts.find((a) => a.id === alert.id && !a.resolved);
  if (existing) return;
  state.alerts.unshift({ ...alert, resolved: false });
  if (state.alerts.length > MAX_ALERTS) state.alerts.length = MAX_ALERTS;
}

function resolveAlert(state: MonitorState, id: string) {
  for (const a of state.alerts) {
    if (a.id === id) a.resolved = true;
  }
}

async function countEventsSince(
  client: SuiJsonRpcClient,
  eventType: string,
  sinceMs: number,
): Promise<number> {
  let count = 0;
  let cursor: Parameters<SuiJsonRpcClient["queryEvents"]>[0]["cursor"] = undefined;
  for (let page = 0; page < 20; page++) {
    const res = await client.queryEvents({
      query: { MoveEventType: eventType },
      cursor,
      limit: 50,
      order: "descending",
    });
    for (const ev of res.data) {
      if (Number(ev.timestampMs ?? 0) < sinceMs) return count;
      count++;
    }
    if (!res.hasNextPage) break;
    cursor = res.nextCursor ?? undefined;
  }
  return count;
}

async function pollPausedPools(
  client: SuiJsonRpcClient,
  poolIds: string[],
): Promise<string[]> {
  const paused: string[] = [];
  for (const poolId of poolIds) {
    const obj = await client.getObject({
      id: poolId,
      options: { showContent: true },
    });
    const fields = (obj.data?.content as { fields?: { paused?: boolean } } | undefined)
      ?.fields;
    if (fields?.paused) paused.push(poolId);
  }
  return paused;
}

/** JSON-RPC suix_queryObjects (not exposed on SuiJsonRpcClient v2). */
async function countObjectsByType(
  rpcUrl: string,
  structType: string,
): Promise<number> {
  let total = 0;
  let cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_queryObjects",
        params: [
          {
            filter: { StructType: structType },
            cursor,
            limit: 50,
          },
        ],
      }),
    });
    const json = (await res.json()) as {
      result?: {
        data?: unknown[];
        hasNextPage?: boolean;
        nextCursor?: string | null;
      };
    };
    const data = json.result?.data ?? [];
    total += data.length;
    if (!json.result?.hasNextPage || total >= 500) break;
    cursor = json.result?.nextCursor ?? null;
  }
  return total;
}

async function checkServiceHealth(
  url: string,
): Promise<{ ok: boolean; gasBalanceLow?: boolean }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return { ok: false };
  const json = (await res.json()) as {
    ok?: boolean;
    gasBalanceLow?: boolean;
  };
  return { ok: Boolean(json.ok), gasBalanceLow: json.gasBalanceLow };
}

async function tick(state: MonitorState, config: ReturnType<typeof loadConfig>) {
  state.errors = [];
  const pkg = config.packageId;
  const sinceMs = Date.now() - config.lookbackSecs * 1000;
  const eventTypes = [
    `${pkg}::prophet_registry::ProphecyCommitted`,
    `${pkg}::oracle_arbitrator::ArbitrationCaseOpened`,
  ];

  await withRpcFallback(async (client) => {
    const events24h: Record<string, number> = {};
    for (const t of eventTypes) {
      const short = t.split("::").slice(-1)[0];
      events24h[short] = await countEventsSince(client, t, sinceMs);
    }
    state.metrics.events24h = events24h;

    const paused = await pollPausedPools(client, config.poolIds);
    state.metrics.poolsPaused = paused;
    for (const poolId of paused) {
      pushAlert(state, {
        id: `pool-paused:${poolId}`,
        severity: "warn",
        source: "market_pool",
        message: `Pool paused: ${poolId}`,
        at: new Date().toISOString(),
      });
    }
    for (const poolId of config.poolIds) {
      if (!paused.includes(poolId)) {
        resolveAlert(state, `pool-paused:${poolId}`);
      }
    }

    const rpcUrl = parseRpcUrls()[0];
    state.metrics.slashRecords = await countObjectsByType(
      rpcUrl,
      `${pkg}::slash::SlashRecord`,
    );
    state.metrics.zkVerificationsOpen = await countObjectsByType(
      rpcUrl,
      `${pkg}::zk_coprocessor::ZkVerification`,
    );

    if (events24h.ArbitrationCaseOpened && events24h.ArbitrationCaseOpened > 0) {
      pushAlert(state, {
        id: "arbitration-opened",
        severity: "warn",
        source: "oracle_arbitrator",
        message: `${events24h.ArbitrationCaseOpened} ArbitrationCaseOpened in lookback window`,
        at: new Date().toISOString(),
      });
    }
  });

  try {
    const gas = await checkServiceHealth(config.gasStationHealthUrl);
    state.metrics.gasStationOk = gas.ok;
    state.metrics.gasBalanceLow = gas.gasBalanceLow ?? null;
    if (!gas.ok) {
      pushAlert(state, {
        id: "gas-station-down",
        severity: "critical",
        source: "gas_station",
        message: "Gas Station health check failed",
        at: new Date().toISOString(),
      });
    } else {
      resolveAlert(state, "gas-station-down");
    }
    if (gas.gasBalanceLow) {
      pushAlert(state, {
        id: "gas-balance-low",
        severity: "critical",
        source: "gas_station",
        message: "Gas payer SUI balance below minimum",
        at: new Date().toISOString(),
      });
      await sendWebhookAlert(config.alertWebhookUrl, {
        alert: "gas_balance_low",
        service: "gas-station",
      });
    } else {
      resolveAlert(state, "gas-balance-low");
    }
  } catch (e) {
    state.errors.push(
      `gas station check: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  try {
    const keeper = await checkServiceHealth(config.keeperHealthUrl);
    state.metrics.keeperOk = keeper.ok;
    state.metrics.keeperBalanceLow = keeper.gasBalanceLow ?? null;
    if (!keeper.ok) {
      pushAlert(state, {
        id: "keeper-down",
        severity: "critical",
        source: "lp_guard_keeper",
        message: "LP Guard Keeper health check failed",
        at: new Date().toISOString(),
      });
    } else {
      resolveAlert(state, "keeper-down");
    }
    if (keeper.gasBalanceLow) {
      pushAlert(state, {
        id: "keeper-balance-low",
        severity: "warn",
        source: "lp_guard_keeper",
        message: "Keeper SUI balance below minimum",
        at: new Date().toISOString(),
      });
      await sendWebhookAlert(config.alertWebhookUrl, {
        alert: "keeper_balance_low",
        service: "lp-guard-keeper",
      });
    } else {
      resolveAlert(state, "keeper-balance-low");
    }
  } catch (e) {
    state.errors.push(
      `keeper check: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  state.lastPollAt = new Date().toISOString();
  console.log(
    JSON.stringify({
      event: "chain_monitor_tick",
      metrics: state.metrics,
      errors: state.errors,
      alertsOpen: state.alerts.filter((a) => !a.resolved).length,
    }),
  );
}

async function runTick(state: MonitorState, config: ReturnType<typeof loadConfig>) {
  try {
    await tick(state, config);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    state.errors.push(msg);
    console.error(JSON.stringify({ event: "chain_monitor_tick_error", error: msg }));
  }
}

async function main() {
  const config = loadConfig();
  const state = emptyState();
  startHealthServer(config.healthPort, () => state);

  await runTick(state, config);
  setInterval(() => {
    runTick(state, config);
  }, config.pollMs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
