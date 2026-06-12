import type { MarketKind, SeedMarket } from "./markets";

/** Align with on-chain `prophet_registry::unlock_cutoff_secs` (PRD §11.2). */
export const PROPHET_UNLOCK_CUTOFF_SECS = 300;

export type ProphetMarketStatus =
  | "open"
  | "closing"
  | "expired"
  | "resolved"
  | "paused"
  | "no_pool";

export interface ProphetPoolSnapshot {
  poolId: string;
  maturityTs: number;
  resolved: boolean;
  paused: boolean;
  resolutionWindowTs: number;
}

export interface ProphetMarketEligibility {
  status: ProphetMarketStatus;
  canCommit: boolean;
  reason: string;
  remainingSecs: number | null;
}

export interface ProphetPoolOption {
  market: SeedMarket;
  poolId: string;
  snapshot: ProphetPoolSnapshot;
  eligibility: ProphetMarketEligibility;
}

const KIND_LABELS: Record<MarketKind, string> = {
  poisson: "Poisson",
  dirichlet: "Dirichlet",
  normal: "Normal",
  beta: "Beta",
};

export function assessProphetMarketEligibility(
  nowSec: number,
  snapshot: ProphetPoolSnapshot,
): ProphetMarketEligibility {
  const { poolId, maturityTs, resolved, paused, resolutionWindowTs } = snapshot;

  if (!poolId) {
    return {
      status: "no_pool",
      canCommit: false,
      reason: "未配置 Pool ID",
      remainingSecs: null,
    };
  }
  if (resolved) {
    return {
      status: "resolved",
      canCommit: false,
      reason: "市场已结算，不可再提交预测",
      remainingSecs: null,
    };
  }
  if (paused) {
    return {
      status: "paused",
      canCommit: false,
      reason: "市场已暂停",
      remainingSecs: maturityTs > nowSec ? maturityTs - nowSec : 0,
    };
  }
  if (!maturityTs || maturityTs <= nowSec) {
    return {
      status: "expired",
      canCommit: false,
      reason: "已过到期时间，不可提交预测",
      remainingSecs: 0,
    };
  }

  const remainingSecs = maturityTs - nowSec;

  if (nowSec + PROPHET_UNLOCK_CUTOFF_SECS >= maturityTs) {
    return {
      status: "closing",
      canCommit: false,
      reason: `距到期不足 ${PROPHET_UNLOCK_CUTOFF_SECS / 60} 分钟（解锁窗口已关闭），不可提交新预测`,
      remainingSecs,
    };
  }

  if (
    resolutionWindowTs > 0 &&
    remainingSecs <= resolutionWindowTs
  ) {
    return {
      status: "closing",
      canCommit: false,
      reason: "已进入结算窗口，交易与预测均已关闭",
      remainingSecs,
    };
  }

  return {
    status: "open",
    canCommit: true,
    reason: "可提交预测",
    remainingSecs,
  };
}

export function formatRemainingTime(secs: number | null): string {
  if (secs == null) return "—";
  if (secs <= 0) return "已到期";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}天 ${h}小时`;
  if (h > 0) return `${h}小时 ${m}分`;
  return `${m} 分钟`;
}

export function prophetStatusLabel(status: ProphetMarketStatus): string {
  switch (status) {
    case "open":
      return "可预测";
    case "closing":
      return "即将截止";
    case "expired":
      return "已截止";
    case "resolved":
      return "已结算";
    case "paused":
      return "已暂停";
    case "no_pool":
      return "未配置";
  }
}

export function prophetStatusClass(status: ProphetMarketStatus): string {
  return `prophet-status prophet-status--${status}`;
}

export function matchesProphetMarketQuery(
  option: ProphetPoolOption,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { market, poolId } = option;
  const haystack = [
    market.title,
    market.description,
    market.id,
    poolId,
    market.kind,
    KIND_LABELS[market.kind],
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function sortProphetPoolOptions(
  options: ProphetPoolOption[],
): ProphetPoolOption[] {
  const rank = (s: ProphetMarketStatus): number => {
    switch (s) {
      case "open":
        return 0;
      case "closing":
        return 1;
      case "paused":
        return 2;
      case "expired":
        return 3;
      case "resolved":
        return 4;
      case "no_pool":
        return 5;
    }
  };
  return [...options].sort((a, b) => {
    const dr = rank(a.eligibility.status) - rank(b.eligibility.status);
    if (dr !== 0) return dr;
    const ma = a.snapshot.maturityTs || Number.MAX_SAFE_INTEGER;
    const mb = b.snapshot.maturityTs || Number.MAX_SAFE_INTEGER;
    return ma - mb;
  });
}

export function parsePoolSnapshotFromFields(
  poolId: string,
  fields: Record<string, unknown> | undefined,
): ProphetPoolSnapshot {
  return {
    poolId,
    maturityTs: Number(fields?.maturity_ts ?? 0),
    resolved: fields?.resolved === true,
    paused: fields?.paused === true,
    resolutionWindowTs: Number(fields?.resolution_window_ts ?? 0),
  };
}
