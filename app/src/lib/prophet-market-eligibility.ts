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
  closingReason?: "cutoff" | "resolution_window";
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
      reason: "Pool ID not configured",
      remainingSecs: null,
    };
  }
  if (resolved) {
    return {
      status: "resolved",
      canCommit: false,
      reason: "Market settled — predictions closed",
      remainingSecs: null,
    };
  }
  if (paused) {
    return {
      status: "paused",
      canCommit: false,
      reason: "Market paused",
      remainingSecs: maturityTs > nowSec ? maturityTs - nowSec : 0,
    };
  }
  if (!maturityTs || maturityTs <= nowSec) {
    return {
      status: "expired",
      canCommit: false,
      reason: "Past maturity — predictions closed",
      remainingSecs: 0,
    };
  }

  const remainingSecs = maturityTs - nowSec;

  if (nowSec + PROPHET_UNLOCK_CUTOFF_SECS >= maturityTs) {
    return {
      status: "closing",
      canCommit: false,
      reason: `Less than ${PROPHET_UNLOCK_CUTOFF_SECS / 60} min to maturity`,
      remainingSecs,
      closingReason: "cutoff",
    };
  }

  if (
    resolutionWindowTs > 0 &&
    remainingSecs <= resolutionWindowTs
  ) {
    return {
      status: "closing",
      canCommit: false,
      reason: "In settlement window",
      remainingSecs,
      closingReason: "resolution_window",
    };
  }

  return {
    status: "open",
    canCommit: true,
    reason: "Open for predictions",
    remainingSecs,
  };
}

export function formatRemainingTime(secs: number | null): string {
  if (secs == null) return "—";
  if (secs <= 0) return "Expired";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export function prophetStatusLabel(status: ProphetMarketStatus): string {
  switch (status) {
    case "open":
      return "Open";
    case "closing":
      return "Closing soon";
    case "expired":
      return "Closed";
    case "resolved":
      return "Settled";
    case "paused":
      return "Paused";
    case "no_pool":
      return "Not configured";
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
