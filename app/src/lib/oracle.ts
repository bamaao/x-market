import { Transaction } from "@mysten/sui/transactions";
import type { SuiClient } from "@mysten/sui/client";
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

const DATA_FEED_TYPE = `${PACKAGE_ID}::macro_oracle::DataFeed`;

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
  client: SuiClient,
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
  client: SuiClient,
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
  const hex = Array.from(idBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}

/** Fallback: scan DataFeed objects and match `market_id` field. */
export async function discoverFeedByMarketScan(
  client: SuiClient,
  poolId: string,
): Promise<string | null> {
  if (!poolId) return null;
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
  client: SuiClient,
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
      return "提议者胜诉";
    case VERDICT_DISPUTER_WINS:
      return "挑战者胜诉";
    case VERDICT_UNRESOLVED:
      return "无法裁决";
    default:
      return "待提案";
  }
}

export function claimedValueHint(kind: MarketKind): string {
  switch (kind) {
    case "poisson":
      return "总进球 slot 0–14";
    case "dirichlet":
      return "胜出 bucket 0=主胜 1=平 2=客胜";
    case "normal":
      return "宏观数值（tenths，如 CPI 2.8% → 28）";
  }
}

export function formatUnixTs(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("zh-CN");
}

export function livenessRemainingSecs(livenessEndAt: number, nowSec: number): number {
  return Math.max(0, livenessEndAt - nowSec);
}

export function formatCountdown(secs: number): string {
  if (secs <= 0) return "已结束";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
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

export function appendNullifyFeed(tx: Transaction, feedId: string) {
  tx.moveCall({
    target: `${PACKAGE_ID}::macro_oracle::nullify_feed`,
    arguments: [tx.object(feedId), tx.object(SUI_CLOCK_ID)],
  });
}
