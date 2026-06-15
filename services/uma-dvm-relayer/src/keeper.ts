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
import { loadRelayerKeypair } from "./client.js";
import { loadConfig } from "./config.js";
import { startHealth } from "./health.js";
import { submitUmaDvmArbitration } from "./tx.js";

const CASE_OPEN = 0;
const ADAPTER_UMA_DVM = 1;
const VERDICT_DISPUTER_WINS = 2;

interface PendingCase {
  caseId: string;
  assertionId: string;
  feedId: string;
  poolId: string;
  claimedValue: bigint;
  seenAt: number;
}

function parseFields(content: unknown): Record<string, unknown> | undefined {
  if (!content || typeof content !== "object") return undefined;
  const c = content as { dataType?: string; fields?: Record<string, unknown> };
  if (c.dataType === "moveObject" && c.fields) return c.fields;
  return undefined;
}

function bytesToUtf8(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return new TextDecoder().decode(Uint8Array.from(value as number[]));
  }
  return "";
}

const pending = new Map<string, PendingCase>();
const executed = new Set<string>();
let lastTickAt: string | null = null;
let lastError: string | null = null;
let adapterType: number | null = null;

async function loadArbitratorAdapter(
  client: SuiJsonRpcClient,
  arbitratorId: string,
): Promise<number> {
  const obj = await client.getObject({
    id: arbitratorId,
    options: { showContent: true },
  });
  const fields = parseFields(obj.data?.content);
  return Number(fields?.adapter_type ?? 0);
}

async function pollUmaRequests(
  client: SuiJsonRpcClient,
  packageId: string,
): Promise<void> {
  const eventType = `${packageId}::oracle_arbitrator::UmaDvmArbitrationRequested`;
  let cursor: { txDigest: string; eventSeq: string } | null = null;
  for (;;) {
    const res = await client.queryEvents({
      query: { MoveEventType: eventType },
      cursor,
      limit: 50,
      order: "ascending",
    });
    for (const ev of res.data) {
      const parsed = ev.parsedJson as Record<string, unknown> | null;
      if (!parsed) continue;
      const caseId = String(parsed.case_id ?? "");
      if (!caseId || pending.has(caseId) || executed.has(caseId)) continue;
      pending.set(caseId, {
        caseId,
        assertionId: String(parsed.assertion_id ?? ""),
        feedId: String(parsed.feed_id ?? ""),
        poolId: String(parsed.pool_id ?? ""),
        claimedValue: BigInt(String(parsed.claimed_value ?? "0")),
        seenAt: Date.now(),
      });
      console.log(
        JSON.stringify({
          event: "uma_dvm_request_seen",
          caseId,
          dataIdentifier: bytesToUtf8(parsed.data_identifier),
        }),
      );
    }
    if (res.hasNextPage && res.nextCursor) {
      cursor = res.nextCursor;
    } else {
      break;
    }
  }
}

async function resolveMockVerdict(
  config: ReturnType<typeof loadConfig>,
  row: PendingCase,
): Promise<{ verdictType: number; resolvedValue: bigint }> {
  if (Date.now() - row.seenAt < config.mockDelayMs) {
    return { verdictType: 0, resolvedValue: 0n };
  }
  const verdictType = config.mockVerdict;
  let resolvedValue = config.mockResolvedValue;
  if (verdictType === VERDICT_DISPUTER_WINS && resolvedValue === 0n) {
    resolvedValue = row.claimedValue > 0n ? row.claimedValue : 1n;
  }
  return { verdictType, resolvedValue };
}

async function resolveLiveVerdict(
  config: ReturnType<typeof loadConfig>,
  row: PendingCase,
): Promise<{ verdictType: number; resolvedValue: bigint } | null> {
  if (!config.umaApiUrl) {
    console.log(
      JSON.stringify({
        event: "uma_dvm_live_skipped",
        caseId: row.caseId,
        reason: "UMA_API_URL not set",
      }),
    );
    return null;
  }
  // Placeholder for UMA Optimistic Oracle / DVM HTTP integration.
  console.log(
    JSON.stringify({
      event: "uma_dvm_live_poll",
      caseId: row.caseId,
      umaApiUrl: config.umaApiUrl,
    }),
  );
  return null;
}

async function tick(config: ReturnType<typeof loadConfig>) {
  lastError = null;
  const keypair = loadRelayerKeypair(config.relayerSecretKey);
  await withRpcFallback(async (client) => {
    if (adapterType == null) {
      adapterType = await loadArbitratorAdapter(client, config.arbitratorId);
      if (adapterType !== ADAPTER_UMA_DVM) {
        throw new Error(
          `ORACLE_ARBITRATOR_ID adapter_type=${adapterType}, expected UMA_DVM (${ADAPTER_UMA_DVM})`,
        );
      }
    }
    await pollUmaRequests(client, config.packageId);
    for (const [caseId, row] of [...pending.entries()]) {
      const caseObj = await client.getObject({
        id: caseId,
        options: { showContent: true },
      });
      const fields = parseFields(caseObj.data?.content);
      if (!fields || Number(fields.status ?? 0) !== CASE_OPEN) {
        pending.delete(caseId);
        executed.add(caseId);
        continue;
      }
      const resolution =
        config.mode === "mock"
          ? await resolveMockVerdict(config, row)
          : await resolveLiveVerdict(config, row);
      if (!resolution || resolution.verdictType === 0) continue;
      const digest = await submitUmaDvmArbitration(client, keypair, config, {
        caseId: row.caseId,
        feedId: row.feedId,
        poolId: row.poolId,
        assertionId: row.assertionId,
        verdictType: resolution.verdictType,
        resolvedValue: resolution.resolvedValue,
      });
      pending.delete(caseId);
      executed.add(caseId);
      console.log(
        JSON.stringify({
          event: "uma_dvm_executed",
          caseId,
          digest,
          verdictType: resolution.verdictType,
          resolvedValue: resolution.resolvedValue.toString(),
        }),
      );
      await sendWebhookAlert(config.alertWebhookUrl, {
        alert: "uma_dvm_executed",
        caseId,
        digest,
        verdictType: resolution.verdictType,
      });
    }
  });
  lastTickAt = new Date().toISOString();
}

async function main() {
  const config = loadConfig();
  startHealth(config.healthPort, () => ({
    ok: !lastError,
    service: "x-market-uma-dvm-relayer",
    mode: config.mode,
    adapterType,
    pending: pending.size,
    executed: executed.size,
    lastTickAt,
    error: lastError,
  }));
  await tick(config);
  setInterval(() => {
    tick(config).catch((e) => {
      lastError = e instanceof Error ? e.message : String(e);
      console.error(
        JSON.stringify({ event: "uma_dvm_relayer_tick_error", error: lastError }),
      );
    });
  }, config.pollMs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
