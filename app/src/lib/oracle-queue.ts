import type { IndexerOracleQueueItem } from "./indexer";

export type OracleQueueStatus =
  | "pending_propose"
  | "active_assertion"
  | "in_arbitration"
  | "no_feed"
  | "awaiting_maturity"
  | "other"
  | "settled";

export type OracleQueueFilter =
  | "actionable"
  | "pending_propose"
  | "active_assertion"
  | "in_arbitration"
  | "all";

export const ORACLE_QUEUE_FILTERS: {
  value: OracleQueueFilter;
  label: string;
}[] = [
  { value: "actionable", label: "待办" },
  { value: "pending_propose", label: "待提议" },
  { value: "active_assertion", label: "争议窗口" },
  { value: "in_arbitration", label: "委员会" },
  { value: "all", label: "全部" },
];

const STATUS_PRIORITY: Record<OracleQueueStatus, number> = {
  in_arbitration: 0,
  active_assertion: 1,
  pending_propose: 2,
  no_feed: 3,
  other: 4,
  awaiting_maturity: 5,
  settled: 6,
};

export function oracleQueueStatusLabel(status: OracleQueueStatus): string {
  switch (status) {
    case "pending_propose":
      return "待提议";
    case "active_assertion":
      return "争议窗口 / 可 Finalize";
    case "in_arbitration":
      return "委员会终裁中";
    case "no_feed":
      return "待注册 Feed";
    case "awaiting_maturity":
      return "未到期";
    case "settled":
      return "已结算";
    default:
      return "进行中";
  }
}

export function oracleQueueStatusClass(status: OracleQueueStatus): string {
  switch (status) {
    case "in_arbitration":
      return "oracle-queue-badge oracle-queue-badge--warn";
    case "active_assertion":
      return "oracle-queue-badge oracle-queue-badge--accent";
    case "pending_propose":
      return "oracle-queue-badge oracle-queue-badge--info";
    case "no_feed":
      return "oracle-queue-badge oracle-queue-badge--muted";
    default:
      return "oracle-queue-badge";
  }
}

export function sortOracleQueueItems(
  items: IndexerOracleQueueItem[],
): IndexerOracleQueueItem[] {
  return [...items].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.queue_status as OracleQueueStatus] ?? 99;
    const pb = STATUS_PRIORITY[b.queue_status as OracleQueueStatus] ?? 99;
    if (pa !== pb) return pa - pb;
    return Number(a.maturity_ts) - Number(b.maturity_ts);
  });
}

export function formatMaturityTs(ts: string | number): string {
  const n = Number(ts);
  if (!n) return "—";
  return new Date(n * 1000).toLocaleString("zh-CN");
}
