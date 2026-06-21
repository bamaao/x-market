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

import { Transaction } from "@mysten/sui/transactions";
import type { XMarketRpc } from "./rpc";
import {
  fetchTransactionObjectChanges,
  parseCreatedObjectIdByTypeSuffix,
  parseCreatedObjectIdFromChanges,
} from "./tx-effects";
import { PACKAGE_ID, GLOBAL_CONFIG_ID, SEED_MARKETS, type MarketKind } from "./markets";
import { SUI_CLOCK_ID } from "./trade";

type TxCoin = ReturnType<Transaction["splitCoins"]>[number];

export { GLOBAL_CONFIG_ID };

export const ORACLE_CONFIG_ID =
  process.env.NEXT_PUBLIC_ORACLE_CONFIG_ID ?? "";

export const ORACLE_ARBITRATOR_ID =
  process.env.NEXT_PUBLIC_ORACLE_ARBITRATOR_ID ?? "";

/** Verdict types — must match `oracle_arbitrator.move` constants. */
export const VERDICT_PROPOSER_WINS = 1;
export const VERDICT_DISPUTER_WINS = 2;
export const VERDICT_UNRESOLVED = 3;

export const ADAPTER_BUILTIN = 0;
export const ADAPTER_UMA_DVM = 1;

const DATA_FEED_TYPE = `${PACKAGE_ID}::macro_oracle::DataFeed`;
const ARBITRATION_CASE_TYPE = `${PACKAGE_ID}::oracle_arbitrator::ArbitrationCase`;
const ARBITRATION_CASE_OPENED_EVENT = `${PACKAGE_ID}::oracle_arbitrator::ArbitrationCaseOpened`;

export type OracleWorkflowStep =
  | "register_feed"
  | "propose"
  | "liveness"
  | "finalize_or_dispute"
  | "arbitration"
  | "settled"
  | "idle";

export const ORACLE_WORKFLOW_STEPS: { id: OracleWorkflowStep; label: string }[] = [
  { id: "propose", label: "1. Propose" },
  { id: "liveness", label: "2. Liveness" },
  { id: "finalize_or_dispute", label: "3. Settle" },
  { id: "arbitration", label: "3. Arbitration" },
  { id: "settled", label: "4. Claim" },
];

export interface OracleMarketRef {
  id: string;
  title: string;
  poolId: string;
  kind: MarketKind;
}

/** Markets with configured pool IDs — feeds discovered on-chain by `market_id`. */
export const ORACLE_MARKETS: OracleMarketRef[] = SEED_MARKETS.map((m) => ({
  id: m.id,
  title: m.title,
  poolId: String(m.params.poolId ?? ""),
  kind: m.kind,
}));

/** Normalize pasted Pool / object ID (0x + 64 hex). */
export function normalizePoolObjectId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(withPrefix)) return null;
  return withPrefix.toLowerCase();
}

export function marketKindFromPoolFields(
  fields: Record<string, unknown> | undefined,
): MarketKind | undefined {
  if (!fields) return undefined;
  switch (Number(fields.kind ?? -1)) {
    case 0:
      return "poisson";
    case 1:
      return "dirichlet";
    case 2:
      return "normal";
    case 3:
      return "beta";
    default:
      return undefined;
  }
}

function parseMoveFields(content: unknown): Record<string, unknown> | undefined {
  if (!content || typeof content !== "object") return undefined;
  const c = content as { dataType?: string; fields?: Record<string, unknown> };
  if (c.dataType === "moveObject" && c.fields) return c.fields;
  return undefined;
}

function parseObjectId(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    return String((value as { id: string }).id);
  }
  return "";
}

/** Resolve FeedRegistry id from OracleConfig (auto-created with config). */
export async function resolveFeedRegistryId(
  client: XMarketRpc,
  oracleConfigId: string,
): Promise<string | null> {
  if (!oracleConfigId) return null;
  const obj = await client.getObject({
    id: oracleConfigId,
    options: { showContent: true },
  });
  const fields = parseMoveFields(obj.data?.content);
  return parseObjectId(fields?.feed_registry_id) || null;
}

/** O(1) lookup via FeedRegistry dynamic field (preferred). */
export async function lookupFeedByMarket(
  client: XMarketRpc,
  registryId: string,
  poolId: string,
): Promise<string | null> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::macro_oracle::lookup_feed_entry`,
    arguments: [tx.object(registryId), tx.pure.id(poolId)],
  });
  const inspect = await client.devInspectTransactionBlock({
    sender:
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    transactionBlock: tx,
  });
  if (inspect.error) return null;
  const raw = inspect.results?.[0]?.returnValues?.[0];
  if (!raw) return null;
  const [bytes] = raw;
  if (!bytes?.length) return null;
  const tag = bytes[0];
  if (tag === 0) return null;
  const idBytes = bytes.slice(1);
  if (idBytes.length !== 32) return null;
  const hex = (idBytes as number[])
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}

/** Fallback: scan DataFeed objects and match `market_id` field. */
export async function discoverFeedByMarketScan(
  client: XMarketRpc,
  poolId: string,
): Promise<string | null> {
  if (!poolId || !client.queryObjects) return null;
  let cursor: string | null | undefined = null;
  for (;;) {
    const page = await client.queryObjects({
      filter: { StructType: DATA_FEED_TYPE },
      options: { showContent: true },
      cursor: cursor ?? undefined,
    });
    for (const item of page.data) {
      const fields = parseMoveFields(item.content);
      const marketId = parseObjectId(fields?.market_id);
      if (marketId === poolId) return item.objectId;
    }
    if (!page.hasNextPage) break;
    cursor = page.nextCursor;
  }
  return null;
}

/** Chain discovery: registry lookup → scan fallback. */
export async function discoverFeedForPool(
  client: XMarketRpc,
  poolId: string,
  oracleConfigId: string = ORACLE_CONFIG_ID,
): Promise<string | null> {
  if (!poolId) return null;
  const registryId = await resolveFeedRegistryId(client, oracleConfigId);
  if (registryId) {
    const feedId = await lookupFeedByMarket(client, registryId, poolId);
    if (feedId) return feedId;
  }
  return discoverFeedByMarketScan(client, poolId);
}

export function bytesIdentifier(label: string): number[] {
  return Array.from(new TextEncoder().encode(label));
}

export function decodeBytes(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return new TextDecoder().decode(new Uint8Array(value as number[]));
  }
  return "";
}

export function feedStatusLabel(code: number): string {
  switch (code) {
    case 0:
      return "Open";
    case 1:
      return "Finalized";
    case 2:
      return "Nullified";
    default:
      return `Unknown(${code})`;
  }
}

export function assertionStatusLabel(code: number): string {
  switch (code) {
    case 0:
      return "Proposed";
    case 1:
      return "In Arbitration";
    case 2:
      return "Finalized";
    case 3:
      return "Rejected";
    default:
      return `Unknown(${code})`;
  }
}

export function verdictLabel(code: number): string {
  switch (code) {
    case VERDICT_PROPOSER_WINS:
      return "Proposer wins";
    case VERDICT_DISPUTER_WINS:
      return "Disputer wins";
    case VERDICT_UNRESOLVED:
      return "Unresolved";
    default:
      return "Pending proposal";
  }
}

export function claimedValueHint(kind: MarketKind): string {
  switch (kind) {
    case "poisson":
      return "Total goals slot 0–14";
    case "dirichlet":
      return "Winning bucket 0=home 1=draw 2=away";
    case "normal":
      return "Macro value (tenths, e.g. CPI 2.8% → 28)";
    case "beta":
      return "Vote share integer percent 0–100 (e.g. 38% → 38)";
  }
}

export function formatUnixTs(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("en-US");
}

export function livenessRemainingSecs(livenessEndAt: number, nowSec: number): number {
  return Math.max(0, livenessEndAt - nowSec);
}

export function formatCountdown(secs: number): string {
  if (secs <= 0) return "Ended";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function parsePoolMaturityTs(
  poolFields: Record<string, unknown> | undefined,
): number {
  if (!poolFields) return 0;
  return Number(poolFields.maturity_ts ?? 0);
}

export function deriveOracleWorkflowStep(params: {
  hasFeed: boolean;
  poolResolved: boolean;
  feedStatus: number;
  assertionStatus: number;
  hasActiveAssertion: boolean;
  livenessRemain: number;
}): OracleWorkflowStep {
  if (params.poolResolved) return "settled";
  if (!params.hasFeed) return "register_feed";
  if (!params.hasActiveAssertion && params.feedStatus === 0) return "propose";
  if (params.assertionStatus === 0 && params.livenessRemain > 0) return "liveness";
  if (params.assertionStatus === 0 && params.livenessRemain <= 0) {
    return "finalize_or_dispute";
  }
  if (params.assertionStatus === 1) return "arbitration";
  return "idle";
}

export function workflowStepLabel(step: OracleWorkflowStep): string {
  switch (step) {
    case "register_feed":
      return "Register Feed";
    case "propose":
      return "Await proposal";
    case "liveness":
      return "Liveness window";
    case "finalize_or_dispute":
      return "Finalize or dispute";
    case "arbitration":
      return "Arbitration";
    case "settled":
      return "Settled · claim";
    case "idle":
      return "—";
  }
}

function parseCreatedObjectIdFromAnyChanges(
  objectChanges: readonly unknown[] | undefined,
  objectType: string,
): string | null {
  const exact = parseCreatedObjectIdFromChanges(objectChanges, objectType);
  if (exact) return exact;
  const suffixIdx = objectType.indexOf("::");
  if (suffixIdx >= 0) {
    return parseCreatedObjectIdByTypeSuffix(
      objectChanges,
      objectType.slice(suffixIdx),
    );
  }
  return null;
}

/** Parse a newly created object id from transaction effects. */
export async function extractCreatedObjectIdFromTx(
  client: XMarketRpc,
  digest: string,
  objectType: string,
  objectChanges?: readonly unknown[] | null,
): Promise<string | null> {
  const fromResult = parseCreatedObjectIdFromAnyChanges(
    objectChanges ?? undefined,
    objectType,
  );
  if (fromResult) return fromResult;

  const changes = await fetchTransactionObjectChanges(client, digest);
  return parseCreatedObjectIdFromAnyChanges(changes, objectType);
}

function normalizeId(value: unknown): string {
  if (typeof value === "string") return value;
  return "";
}

/** Event index → scan fallback for ArbitrationCase by assertion_id. */
export async function discoverArbitrationCaseForAssertion(
  client: XMarketRpc,
  assertionId: string,
): Promise<string | null> {
  if (!assertionId) return null;
  if (client.queryEvents) {
    try {
      let cursor: string | null | undefined = null;
      for (let page = 0; page < 5; page++) {
        const events = await client.queryEvents({
          query: { MoveEventType: ARBITRATION_CASE_OPENED_EVENT },
          order: "descending",
          limit: 50,
          cursor: cursor ?? undefined,
        });
        for (const ev of events.data) {
          const parsed = ev.parsedJson as Record<string, unknown> | null;
          const aid = normalizeId(parsed?.assertion_id);
          if (aid === assertionId) {
            const caseId = normalizeId(parsed?.case_id);
            if (caseId) return caseId;
          }
        }
        if (!events.hasNextPage) break;
        cursor = events.nextCursor;
      }
    } catch {
      // fall through to scan
    }
  }
  if (!client.queryObjects) return null;
  let cursor: string | null | undefined = null;
  for (;;) {
    const page = await client.queryObjects({
      filter: { StructType: ARBITRATION_CASE_TYPE },
      options: { showContent: true },
      cursor: cursor ?? undefined,
    });
    for (const item of page.data) {
      const fields = parseMoveFields(item.content);
      const aid = parseObjectId(fields?.assertion_id);
      if (aid === assertionId) return item.objectId;
    }
    if (!page.hasNextPage) break;
    cursor = page.nextCursor;
  }
  return null;
}

export function appendCreateOracleConfig(
  tx: Transaction,
  configId: string,
  adminCapId: string,
  minimumBond: bigint,
  defaultLivenessSecs: bigint,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::macro_oracle::create_oracle_config`,
    arguments: [
      tx.object(configId),
      tx.object(adminCapId),
      tx.pure.u64(minimumBond),
      tx.pure.u64(defaultLivenessSecs),
    ],
  });
}

export function appendSetOracleArbitrator(
  tx: Transaction,
  configId: string,
  adminCapId: string,
  oracleConfigId: string,
  arbitratorId: string,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::macro_oracle::set_oracle_arbitrator`,
    arguments: [
      tx.object(configId),
      tx.object(adminCapId),
      tx.object(oracleConfigId),
      tx.pure.id(arbitratorId),
    ],
  });
}

export function appendRegisterDataFeedForPool(
  tx: Transaction,
  oracleConfigId: string,
  registryId: string,
  poolId: string,
  identifier: number[],
  eventTs: bigint,
  livenessSecs: bigint,
  bondRequired: bigint,
  ancillaryData: number[],
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::macro_oracle::register_data_feed_for_pool`,
    arguments: [
      tx.object(oracleConfigId),
      tx.object(registryId),
      tx.object(poolId),
      tx.pure.vector("u8", identifier),
      tx.pure.u64(eventTs),
      tx.pure.u64(livenessSecs),
      tx.pure.u64(bondRequired),
      tx.pure.vector("u8", ancillaryData),
    ],
  });
}

export function appendCreatePoissonPoolWithFeed(
  tx: Transaction,
  oracleConfigId: string,
  registryId: string,
  lambdaTenths: number,
  maturityTs: bigint,
  feeBps: number,
  identifier: number[],
  ancillaryData: number[],
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::pool::create_poisson_pool_with_feed`,
    arguments: [
      tx.object(oracleConfigId),
      tx.object(registryId),
      tx.pure.u16(lambdaTenths),
      tx.pure.u64(maturityTs),
      tx.pure.u16(feeBps),
      tx.pure.vector("u8", identifier),
      tx.pure.vector("u8", ancillaryData),
    ],
  });
}

export function appendProposeData(
  tx: Transaction,
  feedId: string,
  poolId: string,
  bondCoin: TxCoin,
  claimedValue: bigint,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::macro_oracle::propose_data`,
    arguments: [
      tx.object(feedId),
      tx.object(poolId),
      bondCoin,
      tx.pure.u64(claimedValue),
      tx.object(SUI_CLOCK_ID),
    ],
  });
}

export function appendDisputeAndRequestArbitration(
  tx: Transaction,
  oracleConfigId: string,
  feedId: string,
  poolId: string,
  assertionId: string,
  arbitratorId: string,
  bondCoin: TxCoin,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::oracle_arbitrator::dispute_and_request_arbitration`,
    arguments: [
      tx.object(oracleConfigId),
      tx.object(feedId),
      tx.object(poolId),
      tx.object(assertionId),
      tx.object(arbitratorId),
      bondCoin,
      tx.object(SUI_CLOCK_ID),
    ],
  });
}

export function appendFinalizeAssertion(
  tx: Transaction,
  feedId: string,
  poolId: string,
  assertionId: string,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::macro_oracle::finalize_assertion`,
    arguments: [
      tx.object(feedId),
      tx.object(poolId),
      tx.object(assertionId),
      tx.object(SUI_CLOCK_ID),
    ],
  });
}

export function appendProposeVerdict(
  tx: Transaction,
  arbitratorId: string,
  caseId: string,
  verdictType: number,
  resolvedValue: bigint,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::oracle_arbitrator::propose_verdict`,
    arguments: [
      tx.object(arbitratorId),
      tx.object(caseId),
      tx.pure.u8(verdictType),
      tx.pure.u64(resolvedValue),
      tx.object(SUI_CLOCK_ID),
    ],
  });
}

export function appendApproveVerdict(
  tx: Transaction,
  arbitratorId: string,
  caseId: string,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::oracle_arbitrator::approve_verdict`,
    arguments: [
      tx.object(arbitratorId),
      tx.object(caseId),
      tx.object(SUI_CLOCK_ID),
    ],
  });
}

export function appendExecuteArbitration(
  tx: Transaction,
  arbitratorId: string,
  oracleConfigId: string,
  caseId: string,
  feedId: string,
  poolId: string,
  assertionId: string,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::oracle_arbitrator::execute_arbitration`,
    arguments: [
      tx.object(arbitratorId),
      tx.object(oracleConfigId),
      tx.object(caseId),
      tx.object(feedId),
      tx.object(poolId),
      tx.object(assertionId),
      tx.object(SUI_CLOCK_ID),
    ],
  });
}

export function appendExecuteUmaDvmArbitration(
  tx: Transaction,
  arbitratorId: string,
  oracleConfigId: string,
  caseId: string,
  feedId: string,
  poolId: string,
  assertionId: string,
  verdictType: number,
  resolvedValue: bigint,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::oracle_arbitrator::execute_uma_dvm_arbitration`,
    arguments: [
      tx.object(arbitratorId),
      tx.object(oracleConfigId),
      tx.object(caseId),
      tx.object(feedId),
      tx.object(poolId),
      tx.object(assertionId),
      tx.pure.u8(verdictType),
      tx.pure.u64(resolvedValue),
      tx.object(SUI_CLOCK_ID),
    ],
  });
}

export async function fetchArbitratorAdapterType(
  client: XMarketRpc,
  arbitratorId: string,
): Promise<number> {
  if (!arbitratorId) return ADAPTER_BUILTIN;
  const obj = await client.getObject({
    id: arbitratorId,
    options: { showContent: true },
  });
  const fields = parseMoveFields(obj.data?.content);
  return Number(fields?.adapter_type ?? ADAPTER_BUILTIN);
}

export function appendNullifyFeed(tx: Transaction, feedId: string) {
  tx.moveCall({
    target: `${PACKAGE_ID}::macro_oracle::nullify_feed`,
    arguments: [tx.object(feedId), tx.object(SUI_CLOCK_ID)],
  });
}
