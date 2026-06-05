import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, GLOBAL_CONFIG_ID, SEED_MARKETS } from "./markets";
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

export interface OracleFeedRef {
  id: string;
  title: string;
  poolId: string;
  feedId: string;
  kind: "poisson" | "dirichlet" | "normal";
}

const feedPoisson = process.env.NEXT_PUBLIC_ORACLE_FEED_POISSON ?? "";
const feedDirichlet = process.env.NEXT_PUBLIC_ORACLE_FEED_DIRICHLET ?? "";
const feedNormal = process.env.NEXT_PUBLIC_ORACLE_FEED_NORMAL ?? "";

/** Seed oracle feeds (register on-chain after deploy; set env feed object IDs). */
export const ORACLE_FEEDS: OracleFeedRef[] = [
  {
    id: "US_GOALS_EVENT",
    title: "足球总进球结算",
    poolId: String(SEED_MARKETS[0]?.params.poolId ?? ""),
    feedId: feedPoisson,
    kind: "poisson",
  },
  {
    id: "WDL_EVENT",
    title: "胜平负结算",
    poolId: String(SEED_MARKETS[1]?.params.poolId ?? ""),
    feedId: feedDirichlet,
    kind: "dirichlet",
  },
  {
    id: "US_CPI_2026_M05",
    title: "CPI 宏观数据结算",
    poolId: String(SEED_MARKETS[2]?.params.poolId ?? ""),
    feedId: feedNormal,
    kind: "normal",
  },
];

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

export function claimedValueHint(kind: OracleFeedRef["kind"]): string {
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

export function appendRegisterDataFeed(
  tx: Transaction,
  configId: string,
  adminCapId: string,
  oracleConfigId: string,
  poolId: string,
  identifier: number[],
  eventTs: bigint,
  livenessSecs: bigint,
  bondRequired: bigint,
  ancillaryData: number[],
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::macro_oracle::register_data_feed`,
    arguments: [
      tx.object(configId),
      tx.object(adminCapId),
      tx.object(oracleConfigId),
      tx.object(poolId),
      tx.pure.vector("u8", identifier),
      tx.pure.u64(eventTs),
      tx.pure.u64(livenessSecs),
      tx.pure.u64(bondRequired),
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

/** Dispute + open arbitration case in one PTB (PRD §10.3.3.2). */
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

/** Legacy admin-only fast path (testnet drills only). */
export function appendAdminReportResolution(
  tx: Transaction,
  configId: string,
  adminCapId: string,
  poolId: string,
  resolvedValue: bigint,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::settlement_oracle::report_resolution`,
    arguments: [
      tx.object(configId),
      tx.object(adminCapId),
      tx.object(poolId),
      tx.pure.u64(resolvedValue),
      tx.object(SUI_CLOCK_ID),
    ],
  });
}
