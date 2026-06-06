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
import { isWalrusBlobId, readBlobFromWalrus } from "./walrus";

export const PROPHET_REGISTRY_ID =
  process.env.NEXT_PUBLIC_PROPHET_REGISTRY_ID ?? "";

/** Align with on-chain `prophet_leaderboard` (PRD §11.3.7). */
export const MIN_AUDITED_FOR_PAID = 3;
export const MIN_SCORE_BPS_FOR_PAID = 4000;

export type ProphetWorkflowStep =
  | "commit"
  | "unlock"
  | "decrypt"
  | "audit"
  | "done";

export const PROPHET_FLOW_STEPS: { id: ProphetWorkflowStep; label: string }[] =
  [
    { id: "commit", label: "1. Seal → Walrus → Commit" },
    { id: "unlock", label: "2. 解锁" },
    { id: "decrypt", label: "3. Seal 解密" },
    { id: "audit", label: "4. 审计 → 战绩 → 分账" },
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
}

export interface ProphecyView {
  id: string;
  prophet: string;
  marketId: string;
  blobId: string;
  sealIdHex: string;
  plaintextHashHex: string;
  predictedValue: number;
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

export function buildProphecyPayload(
  marketId: string,
  predictedValue: number,
  analysis: string,
): ProphecyPayload {
  return {
    market_id: marketId,
    predicted_value: predictedValue,
    analysis_content: analysis,
  };
}

export function canonicalProphecyJson(payload: ProphecyPayload): string {
  return JSON.stringify({
    market_id: payload.market_id,
    predicted_value: payload.predicted_value,
    analysis_content: payload.analysis_content,
  });
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

/** Matches on-chain `seal_access_allowed` (paid OR is_public OR past lock_time). */
export function canSealDecryptProphecy(
  prophecy: ProphecyView,
  viewer: string | undefined,
  nowSec: number,
): boolean {
  if (prophecy.sealIdHex.length !== 64) return false;
  if (!isWalrusBlobId(prophecy.blobId)) return false;
  if (prophecy.isPublic) return true;
  if (viewer && prophecy.paidBuyers.includes(viewer)) return true;
  return nowSec > prophecy.lockTime;
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
      return "等待订阅或发布";
    case "unlock":
      return "可付费解锁";
    case "decrypt":
      return "可 Seal 解密";
    case "audit":
      return "等待 Oracle 审计";
    case "done":
      return "已审计结算";
  }
}

export function prophecyStatusLabel(status: number): string {
  switch (status) {
    case PROPHECY_STATUS_OPEN:
      return "开放";
    case PROPHECY_STATUS_WIN:
      return "审计·胜";
    case PROPHECY_STATUS_LOSS:
      return "审计·负";
    case PROPHECY_STATUS_CHEAT:
      return "作弊";
    default:
      return `未知(${status})`;
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
): { ok: boolean; reason?: string } {
  let payload: ProphecyPayload;
  try {
    const parsed = JSON.parse(plaintextJson) as Partial<ProphecyPayload>;
    if (!parsed.market_id || parsed.predicted_value === undefined) {
      return { ok: false, reason: "JSON 缺少 market_id / predicted_value" };
    }
    payload = {
      market_id: String(parsed.market_id),
      predicted_value: Number(parsed.predicted_value),
      analysis_content: String(parsed.analysis_content ?? ""),
    };
  } catch {
    return { ok: false, reason: "JSON 解析失败" };
  }
  const computed = bytesToHex(hashProphecyPlaintext(payload));
  if (computed !== prophecy.plaintextHashHex) {
    return { ok: false, reason: "blake2b256 与链上 plaintext_hash 不匹配" };
  }
  return { ok: true };
}

export function previewAuditOutcome(
  prophecy: ProphecyView,
  resolvedValue: number | null,
  plaintextJson: string,
): { outcome: AuditPreviewOutcome; hashOk: boolean; reason?: string } {
  const hashCheck = verifyProphecyPlaintextHash(plaintextJson, prophecy);
  if (!hashCheck.ok) {
    return { outcome: "cheat", hashOk: false, reason: hashCheck.reason };
  }
  if (resolvedValue === null) {
    return { outcome: "loss", hashOk: true, reason: "Pool 尚无 resolved_value" };
  }
  return {
    outcome: resolvedValue === prophecy.predictedValue ? "win" : "loss",
    hashOk: true,
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
    return `新预言家须先发布免费预测（unlock_price = 0），完成 ≥${MIN_AUDITED_FOR_PAID} 场审计且 Score ≥ ${MIN_SCORE_BPS_FOR_PAID / 100} 后方可开通付费`;
  }
  if (stats.cheats > 0) return "存在作弊记录，暂不可开通付费解锁";
  if (stats.totalAudited < MIN_AUDITED_FOR_PAID) {
    return `已审计 ${stats.totalAudited}/${MIN_AUDITED_FOR_PAID} 场，继续免费练手预测以积累战绩`;
  }
  if (stats.scoreBps < MIN_SCORE_BPS_FOR_PAID) {
    return `Prophet Score ${formatScorePercent(stats.scoreBps)}，需 ≥ ${MIN_SCORE_BPS_FOR_PAID / 100} 方可开通付费`;
  }
  return "已满足付费开通条件，可设置 unlock_price > 0";
}

export function formatAccuracyPercent(stats: ProphetStatsView): string {
  const total = stats.wins + stats.losses;
  if (total === 0) return "—";
  return `${((stats.wins / total) * 100).toFixed(1)}%`;
}

export function auditOutcomeLabel(outcome: AuditPreviewOutcome): string {
  switch (outcome) {
    case "win":
      return "预测正确 → 战绩 +1 胜";
    case "loss":
      return "预测错误 → 战绩 +1 负";
    case "cheat":
      return "Hash 不匹配 → 作弊，退款买家";
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

export async function decryptProphecyContent(
  prophecy: ProphecyView,
  accountAddress: string,
  signPersonalMessage: (message: Uint8Array) => Promise<string>,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<DecryptedProphecyContent> {
  if (!canSealDecryptProphecy(prophecy, accountAddress, nowSec)) {
    throw new Error(
      "尚未满足 Seal 解密条件：请先 unlock_prophecy，或等待 lock_time / is_public",
    );
  }
  const sealId = new Uint8Array(hexToBytes(prophecy.sealIdHex));
  const encrypted = await readBlobFromWalrus(prophecy.blobId);
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
