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

import { LocalizedError } from "@/i18n/core";
import { blake2b } from "@noble/hashes/blake2b";
import { Transaction } from "@mysten/sui/transactions";
import type { XMarketRpc } from "./rpc";
import { PACKAGE_ID, SEED_MARKETS, type MarketKind } from "./markets";
import { prepareUsdcPayment, type CoinsClient } from "./usdc";
import { SUI_CLOCK_ID } from "./trade";

import {
  createProphetSessionKey,
  decryptProphecyPayload,
} from "./seal-prophet";
import { isProphecyBlobId, readProphecyBlob } from "./prophet-blob";

export const PROPHET_REGISTRY_ID =
  process.env.NEXT_PUBLIC_PROPHET_REGISTRY_ID ?? "";

/** Align with on-chain `prophet_leaderboard` (PRD §11.3.7). */
export const MIN_AUDITED_FOR_PAID = 3;
export const MIN_SCORE_BPS_FOR_PAID = 4000;
/** Align with on-chain `prophet_leaderboard::NORMAL_MAX_INTERVAL_WIDTH`. */
export const NORMAL_MAX_INTERVAL_WIDTH = 200;

export type ProphetWorkflowStep =
  | "commit"
  | "unlock"
  | "decrypt"
  | "audit"
  | "done";

export const PROPHET_FLOW_STEPS: { id: ProphetWorkflowStep; label: string }[] =
  [
    { id: "commit", label: "1. Seal → Indexer → Commit" },
    { id: "unlock", label: "2. Unlock" },
    { id: "decrypt", label: "3. Seal decrypt" },
    { id: "audit", label: "4. Audit → record → payout" },
  ];

export const PROPHECY_STATUS_OPEN = 0;
export const PROPHECY_STATUS_WIN = 1;
export const PROPHECY_STATUS_LOSS = 2;
export const PROPHECY_STATUS_CHEAT = 3;

export interface ProphetMarketRef {
  id: string;
  title: string;
  poolId: string;
  kind: MarketKind;
}

export const PROPHET_MARKETS: ProphetMarketRef[] = SEED_MARKETS.map((m) => ({
  id: m.id,
  title: m.title,
  poolId: String(m.params.poolId ?? ""),
  kind: m.kind,
}));

export interface ProphecyPayload {
  market_id: string;
  predicted_value: number;
  analysis_content: string;
  predicted_low?: number;
  predicted_high?: number;
}

export interface ProphecyView {
  id: string;
  prophet: string;
  marketId: string;
  blobId: string;
  sealIdHex: string;
  plaintextHashHex: string;
  predictedValue: number;
  predictedLow: number;
  predictedHigh: number;
  unlockPrice: bigint;
  lockTime: number;
  paidBuyers: string[];
  status: number;
  isPublic: boolean;
  unlockCount: number;
}

export interface ProphetRegistryView {
  protocolFeeBps: number;
  prophecyCount: number;
}

export interface ProphetStatsView {
  prophet: string;
  wins: number;
  losses: number;
  cheats: number;
  currentStreak: number;
  maxStreak: number;
  totalAudited: number;
  totalUnlockRevenue: bigint;
  scoreBps: number;
}

export interface EscrowSettlementPreview {
  escrowTotal: bigint;
  protocolFee: bigint;
  prophetPayout: bigint;
  protocolFeeBps: number;
}

export type AuditPreviewOutcome = "win" | "loss" | "cheat";

export interface NormalIntervalInput {
  low: number;
  high: number;
}

export function intervalPrecisionBps(width: number): number {
  if (width <= 0) return 10000;
  if (width >= NORMAL_MAX_INTERVAL_WIDTH) return 0;
  return Math.floor(
    ((NORMAL_MAX_INTERVAL_WIDTH - width) * 10000) / NORMAL_MAX_INTERVAL_WIDTH,
  );
}

export function isNormalIntervalProphecy(prophecy: ProphecyView): boolean {
  if (prophecy.predictedLow === 0 && prophecy.predictedHigh === 0) return false;
  return prophecy.predictedLow < prophecy.predictedHigh;
}

export function prophecyIntervalWidth(prophecy: ProphecyView): number {
  if (!isNormalIntervalProphecy(prophecy)) return 0;
  return prophecy.predictedHigh - prophecy.predictedLow;
}

export function prophecyResolvedWon(
  resolvedValue: number,
  prophecy: ProphecyView,
  poolKind?: MarketKind,
): boolean {
  if (poolKind === "normal" && isNormalIntervalProphecy(prophecy)) {
    return (
      resolvedValue >= prophecy.predictedLow &&
      resolvedValue <= prophecy.predictedHigh
    );
  }
  return resolvedValue === prophecy.predictedValue;
}

export function formatNormalTenths(v: number): string {
  return `${(v / 10).toFixed(1)}%`;
}

export function formatProphecyPrediction(
  prophecy: ProphecyView,
  poolKind?: MarketKind,
): string {
  if (poolKind === "normal" && isNormalIntervalProphecy(prophecy)) {
    return `[${formatNormalTenths(prophecy.predictedLow)}, ${formatNormalTenths(prophecy.predictedHigh)}]`;
  }
  if (poolKind === "normal") {
    return formatNormalTenths(prophecy.predictedValue);
  }
  return String(prophecy.predictedValue);
}

export function buildProphecyPayload(
  marketId: string,
  predictedValue: number,
  analysis: string,
  interval?: NormalIntervalInput,
): ProphecyPayload {
  const payload: ProphecyPayload = {
    market_id: marketId,
    predicted_value: predictedValue,
    analysis_content: analysis,
  };
  if (interval) {
    payload.predicted_low = interval.low;
    payload.predicted_high = interval.high;
  }
  return payload;
}

export function buildNormalIntervalPayload(
  marketId: string,
  low: number,
  high: number,
  analysis: string,
): ProphecyPayload {
  const lo = Math.min(low, high);
  const hi = Math.max(low, high);
  return buildProphecyPayload(
    marketId,
    Math.round((lo + hi) / 2),
    analysis,
    { low: lo, high: hi },
  );
}

export function canonicalProphecyJson(payload: ProphecyPayload): string {
  const body: Record<string, unknown> = {
    market_id: payload.market_id,
    predicted_value: payload.predicted_value,
    analysis_content: payload.analysis_content,
  };
  if (payload.predicted_low !== undefined && payload.predicted_high !== undefined) {
    body.predicted_low = payload.predicted_low;
    body.predicted_high = payload.predicted_high;
  }
  return JSON.stringify(body);
}

export function parseProphecyPayloadJson(
  plaintextJson: string,
): ProphecyPayload | null {
  try {
    const parsed = JSON.parse(plaintextJson) as Partial<ProphecyPayload>;
    if (!parsed.market_id || parsed.predicted_value === undefined) return null;
    const payload: ProphecyPayload = {
      market_id: String(parsed.market_id),
      predicted_value: Number(parsed.predicted_value),
      analysis_content: String(parsed.analysis_content ?? ""),
    };
    if (parsed.predicted_low !== undefined && parsed.predicted_high !== undefined) {
      payload.predicted_low = Number(parsed.predicted_low);
      payload.predicted_high = Number(parsed.predicted_high);
    }
    return payload;
  } catch {
    return null;
  }
}

/** Must match on-chain `hash::blake2b256`. */
export function hashProphecyPlaintext(payload: ProphecyPayload): Uint8Array {
  const bytes = new TextEncoder().encode(canonicalProphecyJson(payload));
  return blake2b(bytes, { dkLen: 32 });
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): number[] {
  const clean = hex.replace(/^0x/i, "");
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    out.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return out;
}

export function testnetBlobId(hashHex: string): string {
  return `testnet:local:${hashHex.slice(0, 16)}`;
}

/** Non-paid prophecies (unlock_price = 0) are public at commit; paid ones may become public after audit. */
export function isPublicProphecy(prophecy: ProphecyView): boolean {
  return prophecy.unlockPrice === 0n || prophecy.isPublic;
}

/** Whether the viewer may read prophecy content (public blob or Seal-gated private). */
export function canReadProphecyContent(
  prophecy: ProphecyView,
  viewer: string | undefined,
  nowSec: number,
): boolean {
  if (!isProphecyBlobId(prophecy.blobId)) return false;
  if (isPublicProphecy(prophecy)) return true;
  if (prophecy.sealIdHex.length !== 64) return false;
  if (prophecy.isPublic) return true;
  if (viewer && prophecy.paidBuyers.includes(viewer)) return true;
  return nowSec > prophecy.lockTime;
}

/** @deprecated Use canReadProphecyContent — kept for call-site compatibility. */
export function canSealDecryptProphecy(
  prophecy: ProphecyView,
  viewer: string | undefined,
  nowSec: number,
): boolean {
  return canReadProphecyContent(prophecy, viewer, nowSec);
}

export function deriveProphetWorkflowStep(params: {
  prophecy: ProphecyView | null;
  isPaid: boolean;
  canUnlock: boolean;
  canSealDecrypt: boolean;
  decrypted: boolean;
  poolResolved: boolean;
}): ProphetWorkflowStep {
  const { prophecy, isPaid, canUnlock, canSealDecrypt, decrypted, poolResolved } =
    params;
  if (!prophecy) return "commit";
  if (prophecy.status !== 0) return "done";
  if (canSealDecrypt && !decrypted) return "decrypt";
  if (canUnlock && !isPaid) return "unlock";
  if (decrypted && poolResolved) return "audit";
  if (decrypted) return "decrypt";
  if (poolResolved) return "audit";
  return "commit";
}

export function workflowStepLabel(step: ProphetWorkflowStep): string {
  switch (step) {
    case "commit":
      return "Await subscribe or publish";
    case "unlock":
      return "Paid unlock available";
    case "decrypt":
      return "Seal decrypt available";
    case "audit":
      return "Await Oracle audit";
    case "done":
      return "Audited and settled";
  }
}

export function prophecyStatusLabel(status: number): string {
  switch (status) {
    case PROPHECY_STATUS_OPEN:
      return "Open";
    case PROPHECY_STATUS_WIN:
      return "Audit · win";
    case PROPHECY_STATUS_LOSS:
      return "Audit · loss";
    case PROPHECY_STATUS_CHEAT:
      return "Cheat";
    default:
      return `Unknown(${status})`;
  }
}

/** Matches on-chain `can_audit`. */
export function canAuditProphecy(
  prophecy: ProphecyView,
  poolResolved: boolean,
  nowSec: number,
): boolean {
  return (
    prophecy.status === PROPHECY_STATUS_OPEN &&
    poolResolved &&
    nowSec >= prophecy.lockTime
  );
}

export function estimateEscrowTotal(prophecy: ProphecyView): bigint {
  return prophecy.unlockPrice * BigInt(prophecy.unlockCount);
}

export function computeEscrowSettlement(
  escrowTotal: bigint,
  protocolFeeBps: number,
): Pick<EscrowSettlementPreview, "protocolFee" | "prophetPayout"> {
  const protocolFee = (escrowTotal * BigInt(protocolFeeBps)) / 10000n;
  const prophetPayout = escrowTotal - protocolFee;
  return { protocolFee, prophetPayout };
}

export function computeBuyerRefundPerBuyer(
  escrowTotal: bigint,
  buyerCount: number,
): bigint {
  if (buyerCount <= 0) return 0n;
  return escrowTotal / BigInt(buyerCount);
}

export function buildSettlementPreview(
  prophecy: ProphecyView,
  protocolFeeBps: number,
): EscrowSettlementPreview {
  const escrowTotal = estimateEscrowTotal(prophecy);
  const { protocolFee, prophetPayout } = computeEscrowSettlement(
    escrowTotal,
    protocolFeeBps,
  );
  return { escrowTotal, protocolFee, prophetPayout, protocolFeeBps };
}

export function verifyProphecyPlaintextHash(
  plaintextJson: string,
  prophecy: ProphecyView,
): { ok: boolean; reasonKey?: string } {
  const payload = parseProphecyPayloadJson(plaintextJson);
  if (!payload) {
    return { ok: false, reasonKey: "prophet.hashMissingFields" };
  }
  const computed = bytesToHex(hashProphecyPlaintext(payload));
  if (computed !== prophecy.plaintextHashHex) {
    return { ok: false, reasonKey: "prophet.hashMismatch" };
  }
  return { ok: true };
}

export function previewAuditOutcome(
  prophecy: ProphecyView,
  resolvedValue: number | null,
  plaintextJson: string,
  poolKind?: MarketKind,
): {
  outcome: AuditPreviewOutcome;
  hashOk: boolean;
  reasonKey?: string;
  precisionBps?: number;
} {
  const hashCheck = verifyProphecyPlaintextHash(plaintextJson, prophecy);
  if (!hashCheck.ok) {
    return { outcome: "cheat", hashOk: false, reasonKey: hashCheck.reasonKey };
  }
  if (resolvedValue === null) {
    return { outcome: "loss", hashOk: true, reasonKey: "prophet.noResolvedValue" };
  }
  const won = prophecyResolvedWon(resolvedValue, prophecy, poolKind);
  const width = won ? prophecyIntervalWidth(prophecy) : 0;
  return {
    outcome: won ? "win" : "loss",
    hashOk: true,
    precisionBps: won ? intervalPrecisionBps(width) : 0,
  };
}

export function formatScorePercent(scoreBps: number): string {
  return `${(scoreBps / 100).toFixed(1)}`;
}

export function isPaidUnlockEligible(
  stats: ProphetStatsView | null | undefined,
): boolean {
  if (!stats) return false;
  return (
    stats.cheats === 0 &&
    stats.totalAudited >= MIN_AUDITED_FOR_PAID &&
    stats.scoreBps >= MIN_SCORE_BPS_FOR_PAID
  );
}

export function paidUnlockEligibilityHint(
  stats: ProphetStatsView | null | undefined,
): string {
  if (!stats) {
    return `New prophets must publish free predictions (unlock_price = 0), complete ≥${MIN_AUDITED_FOR_PAID} audits with Score ≥ ${MIN_SCORE_BPS_FOR_PAID / 100} before paid unlock`;
  }
  if (stats.cheats > 0) return "Cheat record — paid unlock unavailable";
  if (stats.totalAudited < MIN_AUDITED_FOR_PAID) {
    return `Audited ${stats.totalAudited}/${MIN_AUDITED_FOR_PAID} — keep free predictions to build record`;
  }
  if (stats.scoreBps < MIN_SCORE_BPS_FOR_PAID) {
    return `Prophet Score ${formatScorePercent(stats.scoreBps)} — need ≥ ${MIN_SCORE_BPS_FOR_PAID / 100} for paid unlock`;
  }
  return "Eligible for paid unlock — set unlock_price > 0";
}

export function formatAccuracyPercent(stats: ProphetStatsView): string {
  const total = stats.wins + stats.losses;
  if (total === 0) return "—";
  return `${((stats.wins / total) * 100).toFixed(1)}%`;
}

export function auditOutcomeLabel(outcome: AuditPreviewOutcome): string {
  switch (outcome) {
    case "win":
      return "Correct prediction → +1 win";
    case "loss":
      return "Wrong prediction → +1 loss";
    case "cheat":
      return "Hash mismatch → cheat, refund buyers";
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

function decodeBytesToHex(value: unknown): string {
  if (Array.isArray(value)) {
    return (value as number[])
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const text = decodeBytes(value);
  if (!text) return "";
  return Array.from(new TextEncoder().encode(text))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function decodeBytes(value: unknown): string {
  if (typeof value === "string") {
    try {
      return new TextDecoder().decode(
        Uint8Array.from(atob(value), (c) => c.charCodeAt(0)),
      );
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) {
    return new TextDecoder().decode(Uint8Array.from(value as number[]));
  }
  return "";
}

function parseAddressList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v));
}

export function parseProphecyFields(
  id: string,
  fields: Record<string, unknown>,
): ProphecyView {
  return {
    id,
    prophet: String(fields.prophet ?? ""),
    marketId: parseObjectId(fields.market_id),
    blobId: decodeBytes(fields.blob_id),
    sealIdHex: decodeBytesToHex(fields.seal_id),
    plaintextHashHex: decodeBytesToHex(fields.plaintext_hash),
    predictedValue: Number(fields.predicted_value ?? 0),
    predictedLow: Number(fields.predicted_low ?? fields.predicted_value ?? 0),
    predictedHigh: Number(fields.predicted_high ?? fields.predicted_value ?? 0),
    unlockPrice: BigInt(String(fields.unlock_price ?? "0")),
    lockTime: Number(fields.lock_time ?? 0),
    paidBuyers: parseAddressList(fields.paid_buyers),
    status: Number(fields.status ?? 0),
    isPublic: Boolean(fields.is_public),
    unlockCount: Number(fields.unlock_count ?? 0),
  };
}

/** O(1) lookup via ProphetRegistry dynamic field index. */
export async function lookupPropheciesByMarket(
  client: XMarketRpc,
  registryId: string,
  poolId: string,
): Promise<string[]> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::prophet_registry::lookup_prophecies_by_market`,
    arguments: [tx.object(registryId), tx.pure.id(poolId)],
  });
  const inspect = await client.devInspectTransactionBlock({
    sender:
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    transactionBlock: tx,
  });
  if (inspect.error) return [];
  const raw = inspect.results?.[0]?.returnValues?.[0];
  if (!raw) return [];
  const [bytes] = raw;
  if (!bytes?.length) return [];
  return parseIdVectorFromBcs(bytes);
}

function parseIdVectorFromBcs(bytes: number[]): string[] {
  if (bytes.length < 2) return [];
  const len = (bytes[0] << 8) | bytes[1];
  const ids: string[] = [];
  let offset = 2;
  for (let i = 0; i < len && offset + 32 <= bytes.length; i++) {
    const slice = bytes.slice(offset, offset + 32);
    const hex = slice.map((b) => b.toString(16).padStart(2, "0")).join("");
    ids.push(`0x${hex}`);
    offset += 32;
  }
  return ids;
}

export async function discoverPropheciesForPool(
  client: XMarketRpc,
  poolId: string,
  registryId: string = PROPHET_REGISTRY_ID,
): Promise<string[]> {
  if (registryId) {
    const indexed = await lookupPropheciesByMarket(client, registryId, poolId);
    if (indexed.length > 0) return indexed;
  }
  return discoverPropheciesByScan(client, poolId);
}

/** P4: Indexer 预言列表优先，回退链上扫描。 */
export async function discoverPropheciesForPoolWithIndexer(
  client: XMarketRpc,
  poolId: string,
  registryId: string = PROPHET_REGISTRY_ID,
): Promise<string[]> {
  const { fetchIndexerProphecies, indexerEnabled } = await import("./indexer");
  if (indexerEnabled()) {
    const rows = await fetchIndexerProphecies({ poolId, limit: 100 });
    const ids = rows
      .map((r) => String((r as { prophecy_id?: string }).prophecy_id ?? ""))
      .filter(Boolean);
    if (ids.length > 0) return ids;
  }
  return discoverPropheciesForPool(client, poolId, registryId);
}

/** P4: 到期公开预测优先读 Indexer 明文缓存。 */
export async function decryptFromIndexerCache(
  prophecyId: string,
): Promise<DecryptedProphecyContent | null> {
  const { fetchCachedProphecyPlaintext, indexerEnabled } = await import("./indexer");
  if (!indexerEnabled()) return null;
  const cache = await fetchCachedProphecyPlaintext(prophecyId);
  const payload = cache?.plaintext_json;
  if (!payload || typeof payload.market_id !== "string") return null;
  const json = canonicalProphecyJson({
    market_id: payload.market_id,
    predicted_value: Number(payload.predicted_value ?? 0),
    analysis_content: String(payload.analysis_content ?? ""),
    ...(payload.predicted_low != null && payload.predicted_high != null
      ? {
          predicted_low: Number(payload.predicted_low),
          predicted_high: Number(payload.predicted_high),
        }
      : {}),
  });
  const parsed = JSON.parse(json) as ProphecyPayload & {
    analysis_content?: string;
  };
  return {
    json,
    analysis: parsed.analysis_content ?? "",
    payload: parsed,
  };
}

export function normalizeSuiAddress(addr: string): string {
  const trimmed = addr.trim().toLowerCase();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

export function isValidSuiAddress(addr: string): boolean {
  return /^0x[a-f0-9]{64}$/.test(normalizeSuiAddress(addr));
}

export function prophetProfilePath(address: string): string {
  return `/prophet/${encodeURIComponent(normalizeSuiAddress(address))}`;
}

export function shortAddress(address: string, head = 6, tail = 4): string {
  const a = normalizeSuiAddress(address);
  if (a.length <= head + tail + 3) return a;
  return `${a.slice(0, head + 2)}…${a.slice(-tail)}`;
}

export async function discoverPropheciesByProphet(
  client: XMarketRpc,
  prophetAddress: string,
  limit = 50,
): Promise<string[]> {
  if (!client.queryEvents) return [];
  const prophet = normalizeSuiAddress(prophetAddress);
  const out: string[] = [];
  let cursor: string | null | undefined = null;
  do {
    const page = await client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::prophet_registry::ProphecyCommitted`,
      },
      cursor: cursor ?? undefined,
      limit: 50,
    });
    cursor = page.hasNextPage ? page.nextCursor : null;
    for (const ev of page.data) {
      const p = ev.parsedJson as {
        prophecy_id?: string;
        prophet?: string;
      } | null;
      if (
        p?.prophecy_id &&
        p.prophet &&
        normalizeSuiAddress(p.prophet) === prophet
      ) {
        out.push(p.prophecy_id);
        if (out.length >= limit) return out;
      }
    }
  } while (cursor);
  return out;
}

async function discoverPropheciesByScan(
  client: XMarketRpc,
  poolId: string,
): Promise<string[]> {
  if (!client.queryEvents) return [];
  const out: string[] = [];
  let cursor: string | null | undefined = null;
  do {
    const page = await client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::prophet_registry::ProphecyCommitted`,
      },
      cursor: cursor ?? undefined,
      limit: 50,
    });
    cursor = page.hasNextPage ? page.nextCursor : null;
    for (const ev of page.data) {
      const p = ev.parsedJson as {
        prophecy_id?: string;
        market_id?: string;
      } | null;
      if (p?.market_id === poolId && p.prophecy_id) {
        out.push(p.prophecy_id);
      }
    }
  } while (cursor);
  return out;
}

export async function fetchProphecy(
  client: XMarketRpc,
  prophecyId: string,
): Promise<ProphecyView | null> {
  const obj = await client.getObject({
    id: prophecyId,
    options: { showContent: true },
  });
  const fields = parseMoveFields(obj.data?.content);
  if (!fields) return null;
  return parseProphecyFields(prophecyId, fields);
}

export async function fetchProphetRegistry(
  client: XMarketRpc,
  registryId: string = PROPHET_REGISTRY_ID,
): Promise<ProphetRegistryView | null> {
  if (!registryId) return null;
  const obj = await client.getObject({
    id: registryId,
    options: { showContent: true },
  });
  const fields = parseMoveFields(obj.data?.content);
  if (!fields) return null;
  return {
    protocolFeeBps: Number(fields.protocol_fee_bps ?? 500),
    prophecyCount: Number(fields.prophecy_count ?? 0),
  };
}

export function parseProphetStatsFields(
  fields: Record<string, unknown>,
): ProphetStatsView {
  return {
    prophet: String(fields.prophet ?? ""),
    wins: Number(fields.wins ?? 0),
    losses: Number(fields.losses ?? 0),
    cheats: Number(fields.cheats ?? 0),
    currentStreak: Number(fields.current_streak ?? 0),
    maxStreak: Number(fields.max_streak ?? 0),
    totalAudited: Number(fields.total_audited ?? 0),
    totalUnlockRevenue: BigInt(String(fields.total_unlock_revenue ?? "0")),
    scoreBps: Number(fields.score_bps ?? 0),
  };
}

export async function fetchProphetStats(
  client: XMarketRpc,
  registryId: string,
  prophetAddress: string,
): Promise<ProphetStatsView | null> {
  if (!registryId || !prophetAddress || !client.getDynamicFieldObject) {
    return null;
  }
  try {
    const df = await client.getDynamicFieldObject({
      parentId: registryId,
      name: { type: "address", value: prophetAddress },
    });
    const fields = parseMoveFields(df.data?.content);
    if (!fields) return null;
    return parseProphetStatsFields(fields);
  } catch {
    return null;
  }
}

export async function discoverProphetAddresses(
  client: XMarketRpc,
): Promise<string[]> {
  if (!client.queryEvents) return [];
  const prophets = new Set<string>();
  let cursor: string | null | undefined = null;
  do {
    const page = await client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::prophet_registry::ProphecyCommitted`,
      },
      cursor: cursor ?? undefined,
      limit: 50,
    });
    cursor = page.hasNextPage ? page.nextCursor : null;
    for (const ev of page.data) {
      const p = ev.parsedJson as { prophet?: string } | null;
      if (p?.prophet) prophets.add(p.prophet);
    }
  } while (cursor);
  return [...prophets];
}

export interface LeaderboardEntry extends ProphetStatsView {
  rank: number;
}

export async function fetchLeaderboard(
  client: XMarketRpc,
  registryId: string = PROPHET_REGISTRY_ID,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  if (!registryId) return [];
  const addresses = await discoverProphetAddresses(client);
  const statsList = await Promise.all(
    addresses.map((addr) => fetchProphetStats(client, registryId, addr)),
  );
  return statsList
    .filter((s): s is ProphetStatsView => s !== null)
    .sort((a, b) => b.scoreBps - a.scoreBps || b.wins - a.wins)
    .slice(0, limit)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export function appendCommitPrivateProphecy(
  tx: Transaction,
  args: {
    registryId: string;
    poolId: string;
    blobId: string;
    sealId: Uint8Array;
    plaintextHash: Uint8Array;
    predictedValue: number;
    predictedLow: number;
    predictedHigh: number;
    unlockPrice: bigint;
    lockTime: number;
  },
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::prophet_registry::commit_private_prophecy`,
    arguments: [
      tx.object(args.registryId),
      tx.object(args.poolId),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(args.blobId))),
      tx.pure.vector("u8", Array.from(args.sealId)),
      tx.pure.vector("u8", Array.from(args.plaintextHash)),
      tx.pure.u64(args.predictedValue),
      tx.pure.u64(args.predictedLow),
      tx.pure.u64(args.predictedHigh),
      tx.pure.u64(args.unlockPrice),
      tx.pure.u64(args.lockTime),
    ],
  });
}

export async function appendUnlockProphecy(
  tx: Transaction,
  client: XMarketRpc & CoinsClient,
  owner: string,
  args: {
    registryId: string;
    prophecyId: string;
    unlockPrice: bigint;
  },
) {
  const payment = await prepareUsdcPayment(
    tx,
    client,
    owner,
    args.unlockPrice,
  );
  tx.moveCall({
    target: `${PACKAGE_ID}::prophet_registry::unlock_prophecy`,
    arguments: [
      tx.object(args.registryId),
      tx.object(args.prophecyId),
      payment,
      tx.object(SUI_CLOCK_ID),
    ],
  });
}

export function appendAuditProphecy(
  tx: Transaction,
  args: {
    registryId: string;
    prophecyId: string;
    poolId: string;
    plaintext: string;
  },
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::prophet_registry::audit_prophecy`,
    arguments: [
      tx.object(args.registryId),
      tx.object(args.prophecyId),
      tx.object(args.poolId),
      tx.pure.vector("u8", Array.from(new TextEncoder().encode(args.plaintext))),
      tx.object(SUI_CLOCK_ID),
    ],
  });
}

export interface DecryptedProphecyContent {
  json: string;
  analysis: string;
  payload: ProphecyPayload;
}

function parseProphecyPlaintextJson(json: string): DecryptedProphecyContent {
  const parsed = JSON.parse(json) as ProphecyPayload & {
    analysis_content?: string;
  };
  return {
    json,
    analysis: parsed.analysis_content ?? "",
    payload: {
      market_id: parsed.market_id,
      predicted_value: parsed.predicted_value,
      analysis_content: parsed.analysis_content ?? "",
    },
  };
}

/** Fetch prophecy body when publicly readable (no wallet / Seal required). */
export async function fetchPublicProphecyContent(
  prophecy: ProphecyView,
): Promise<DecryptedProphecyContent | null> {
  if (!isPublicProphecy(prophecy) || !isProphecyBlobId(prophecy.blobId)) {
    return null;
  }
  if (prophecy.sealIdHex.length === 0) {
    try {
      return await readPublicProphecyContent(prophecy);
    } catch {
      return null;
    }
  }
  return null;
}

/** Read plaintext JSON from Indexer/IPFS (public / free prophecies). */
export async function readPublicProphecyContent(
  prophecy: ProphecyView,
): Promise<DecryptedProphecyContent> {
  const bytes = await readProphecyBlob(prophecy.blobId);
  const json = new TextDecoder().decode(bytes);
  return parseProphecyPlaintextJson(json);
}

export async function decryptProphecyContent(
  prophecy: ProphecyView,
  accountAddress: string,
  signPersonalMessage: (message: Uint8Array) => Promise<string>,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<DecryptedProphecyContent> {
  if (!canReadProphecyContent(prophecy, accountAddress, nowSec)) {
    throw new LocalizedError("prophet.readCondition");
  }
  if (isPublicProphecy(prophecy) && prophecy.sealIdHex.length === 0) {
    return readPublicProphecyContent(prophecy);
  }
  const sealId = new Uint8Array(hexToBytes(prophecy.sealIdHex));
  const encrypted = await readProphecyBlob(prophecy.blobId);
  const sessionKey = await createProphetSessionKey(
    accountAddress,
    signPersonalMessage,
  );
  const plain = await decryptProphecyPayload(
    encrypted,
    sealId,
    prophecy.id,
    sessionKey,
    accountAddress,
  );
  const json = new TextDecoder().decode(plain);
  return parseProphecyPlaintextJson(json);
}

export function loadStoredProphecyPlaintext(sealIdHex: string): string | null {
  if (typeof localStorage === "undefined" || !sealIdHex) return null;
  return localStorage.getItem(`prophet-plaintext:${sealIdHex}`);
}

export function storeProphecyPlaintext(sealIdHex: string, json: string): void {
  if (typeof localStorage === "undefined" || !sealIdHex) return;
  localStorage.setItem(`prophet-plaintext:${sealIdHex}`, json);
}

/** Parse newly created PrivateProphecy id from commit transaction. */
export async function extractProphecyIdFromTx(
  client: XMarketRpc,
  digest: string,
): Promise<string | null> {
  if (!client.getTransactionBlock) return null;
  const tx = await client.getTransactionBlock({
    digest,
    options: { showObjectChanges: true },
  });
  const typeSuffix = "prophet_registry::PrivateProphecy";
  for (const change of tx.objectChanges ?? []) {
    if (
      change.type === "created" &&
      "objectType" in change &&
      String(change.objectType).includes(typeSuffix) &&
      "objectId" in change
    ) {
      return change.objectId;
    }
  }
  return null;
}

export { parseUsdcAmount, formatUsdcBaseUnits } from "./usdc";
