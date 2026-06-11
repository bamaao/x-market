import type { MarketKind, SeedMarket } from "./markets";
import { SEED_MARKETS } from "./markets";
import { resolveMarketImageUrl } from "./market-media";
import { formatUsdcBaseUnits } from "./usdc";

export const CONTRACT_INTERVAL = 0;
export const CONTRACT_DIGITAL = 1;
export const CONTRACT_LINEAR_CALL = 2;
export const CONTRACT_LINEAR_PUT = 3;
export const CONTRACT_STRADDLE = 4;
export const CONTRACT_VARIANCE_SWAP = 5;
export const CONTRACT_STRUCTURED_NOTE = 6;
export const CONTRACT_RANGE_NOTE = 7;
export const CONTRACT_BARRIER_NOTE = 8;

export const POOL_KIND_POISSON = 0;
export const POOL_KIND_DIRICHLET = 1;
export const POOL_KIND_NORMAL = 2;
export const POOL_KIND_BETA = 3;

export const STATUS_AUCTION = 0;
export const STATUS_TRADING = 1;
export const STATUS_SETTLED = 2;

export interface PositionView {
  marketId: string;
  contractKind: number;
  intervalA: number;
  intervalB: number;
  stakeUsdc: bigint;
  entryProbPpb: bigint;
  claimed: boolean;
  settled: boolean;
}

export interface PoolView {
  poolId: string;
  kind: number;
  status: number;
  maturityTs: number;
  resolved: boolean;
  resolvedValue: bigint;
  paused: boolean;
  lambdaTenths: number;
  muTenths: number;
  sigmaTenths: number;
  collateralUsdc: bigint;
  feeBps: number;
  feeMultiplierBps: number;
  sigmaVirtualTenths: number;
  dirichletAlphas: number[];
}

export type PositionFilter = "all" | "pending" | "claimable" | "closed";

export interface PositionRow {
  objectId: string;
  position: PositionView;
  market?: MarketRef;
}

export interface PortfolioSummary {
  totalCount: number;
  totalStake: bigint;
  pendingStake: bigint;
  claimableUsdc: bigint;
  claimableCount: number;
  lostStake: bigint;
}

export interface MarketGroupSummary {
  poolId: string;
  positionCount: number;
  totalStake: bigint;
  claimableUsdc: bigint;
  claimableCount: number;
}

export interface MarketRef {
  id: string;
  title: string;
  description: string;
  kind: MarketKind;
  poolId: string;
  imageUrl?: string;
}

export type SettlementDisplay =
  | { state: "pending"; label: string }
  | { state: "hit" | "miss"; label: string; payoutUsdc: bigint | null }
  | { state: "claimed"; label: string };

export function parseMoveObjectFields(
  content: unknown,
): Record<string, unknown> | undefined {
  if (!content || typeof content !== "object") return undefined;
  const c = content as { dataType?: string; fields?: Record<string, unknown> };
  if (c.dataType === "moveObject" && c.fields) return c.fields;
  return undefined;
}

export function parsePositionView(
  fields: Record<string, unknown> | undefined,
): PositionView | null {
  if (!fields) return null;
  const marketId = String(fields.market_id ?? "");
  if (!marketId) return null;
  const stakeRaw = fields.stake_usdc;
  const entryRaw = fields.entry_prob_ppb;
  return {
    marketId,
    contractKind: Number(fields.contract_kind ?? 0),
    intervalA: Number(fields.interval_a ?? 0),
    intervalB: Number(fields.interval_b ?? 0),
    stakeUsdc:
      typeof stakeRaw === "string" || typeof stakeRaw === "number"
        ? BigInt(String(stakeRaw))
        : 0n,
    entryProbPpb:
      typeof entryRaw === "string" || typeof entryRaw === "number"
        ? BigInt(String(entryRaw))
        : 0n,
    claimed: fields.claimed === true,
    settled: fields.settled === true,
  };
}

export function parsePoolView(
  poolId: string,
  fields: Record<string, unknown> | undefined,
): PoolView | null {
  if (!fields) return null;
  const alphasRaw = fields.dirichlet_alphas;
  const dirichletAlphas = Array.isArray(alphasRaw)
    ? alphasRaw.map((v) => Number(v))
    : [];
  return {
    poolId,
    kind: Number(fields.kind ?? 0),
    status: Number(fields.status ?? 0),
    maturityTs: Number(fields.maturity_ts ?? 0),
    resolved: fields.resolved === true,
    resolvedValue: BigInt(String(fields.resolved_value ?? 0)),
    paused: fields.paused === true,
    lambdaTenths: Number(fields.lambda_tenths ?? 0),
    muTenths: Number(fields.mu_tenths ?? 0),
    sigmaTenths: Number(fields.sigma_tenths ?? 0),
    collateralUsdc: BigInt(String(fields.collateral_usdc ?? 0)),
    feeBps: Number(fields.fee_bps ?? 0),
    feeMultiplierBps: Number(fields.fee_multiplier_bps ?? 0),
    sigmaVirtualTenths: Number(fields.sigma_virtual_tenths ?? 0),
    dirichletAlphas,
  };
}

export function findMarketByPoolId(
  poolId: string,
  extraMarkets: MarketRef[] = [],
): MarketRef | undefined {
  const all = [
    ...extraMarkets,
    ...SEED_MARKETS.map((m) => seedMarketToRef(m)),
  ];
  return all.find((m) => m.poolId === poolId);
}

export function seedMarketToRef(m: SeedMarket): MarketRef {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    kind: m.kind,
    poolId: String(m.params.poolId ?? ""),
    imageUrl: resolveMarketImageUrl({ id: m.id, imageUrl: m.imageUrl }),
  };
}

export function contractKindLabel(kind: number): string {
  switch (kind) {
    case CONTRACT_DIGITAL:
      return "数字期权";
    case CONTRACT_LINEAR_CALL:
      return "Linear Call";
    case CONTRACT_LINEAR_PUT:
      return "Linear Put";
    case CONTRACT_STRADDLE:
      return "Straddle";
    case CONTRACT_VARIANCE_SWAP:
      return "Variance Swap";
    case CONTRACT_STRUCTURED_NOTE:
      return "Structured Note";
    case CONTRACT_RANGE_NOTE:
      return "Range Note";
    case CONTRACT_BARRIER_NOTE:
      return "Barrier Note";
    default:
      return "区间合约";
  }
}

const DIRICHLET_OUTCOMES = ["主胜", "平局", "客胜"];

export function formatOutcomeDescription(
  position: PositionView,
  marketKind?: MarketKind,
  poolKind?: number,
): string {
  const { contractKind, intervalA, intervalB } = position;
  const kind = poolKind ?? poolKindFromMarketKind(marketKind);

  if (kind === POOL_KIND_DIRICHLET) {
    const label = DIRICHLET_OUTCOMES[intervalA] ?? `结果 ${intervalA}`;
    return contractKind === CONTRACT_DIGITAL ? label : label;
  }

  if (kind === POOL_KIND_POISSON) {
    if (contractKind === CONTRACT_DIGITAL) {
      return `恰好 ${intervalA} 球`;
    }
    return intervalA === intervalB
      ? `${intervalA} 球`
      : `进球 [${intervalA}, ${intervalB}]`;
  }

  if (kind === POOL_KIND_BETA) {
    return `得票率 ${(intervalA / 10).toFixed(1)}% – ${(intervalB / 10).toFixed(1)}%`;
  }

  if (kind === POOL_KIND_NORMAL) {
    if (contractKind === CONTRACT_DIGITAL) {
      return `≥ ${formatNormalTenths(intervalA)}`;
    }
    if (contractKind === CONTRACT_LINEAR_CALL) {
      return `Call K=${formatNormalTenths(intervalA)}`;
    }
    if (contractKind === CONTRACT_LINEAR_PUT) {
      return `Put K=${formatNormalTenths(intervalA)}`;
    }
    if (contractKind === CONTRACT_STRADDLE) {
      return `Straddle K=${formatNormalTenths(intervalA)}`;
    }
    if (contractKind === CONTRACT_VARIANCE_SWAP) {
      return `VarSwap K=${formatNormalTenths(intervalA)}`;
    }
    if (contractKind === CONTRACT_STRUCTURED_NOTE) {
      return `Structured K=${formatNormalTenths(intervalA)} C=${formatNormalTenths(intervalB)}`;
    }
    if (contractKind === CONTRACT_RANGE_NOTE) {
      return `Range [${formatNormalTenths(intervalA)}, ${formatNormalTenths(intervalB)}]`;
    }
    if (contractKind === CONTRACT_BARRIER_NOTE) {
      return `Barrier ≥ ${formatNormalTenths(intervalA)}`;
    }
    return `区间 [${formatNormalTenths(intervalA)}, ${formatNormalTenths(intervalB)}]`;
  }

  if (contractKind === CONTRACT_DIGITAL) {
    return `结果 ${intervalA}`;
  }
  return intervalA === intervalB
    ? `[${intervalA}]`
    : `[${intervalA}, ${intervalB}]`;
}

function formatNormalTenths(v: number): string {
  return `${(v / 10).toFixed(1)}%`;
}

function poolKindFromMarketKind(kind?: MarketKind): number {
  switch (kind) {
    case "poisson":
      return POOL_KIND_POISSON;
    case "dirichlet":
      return POOL_KIND_DIRICHLET;
    case "normal":
      return POOL_KIND_NORMAL;
    case "beta":
      return POOL_KIND_BETA;
    default:
      return POOL_KIND_POISSON;
  }
}

export function formatEntryProbability(entryProbPpb: bigint): string {
  if (entryProbPpb <= 0n) return "—";
  const pct = (Number(entryProbPpb) / 10_000_000).toFixed(2);
  return `${pct}%`;
}

export function estimateMaxPayoutUsdc(position: PositionView): bigint | null {
  if (position.entryProbPpb <= 0n) return null;
  if (position.contractKind >= CONTRACT_LINEAR_CALL) {
    return null;
  }
  return (position.stakeUsdc * 1_000_000_000n) / position.entryProbPpb;
}

export function poolKindLabel(kind: number): string {
  switch (kind) {
    case POOL_KIND_DIRICHLET:
      return "Dirichlet";
    case POOL_KIND_NORMAL:
      return "Normal";
    case POOL_KIND_BETA:
      return "Beta";
    default:
      return "Poisson";
  }
}

export function poolStatusLabel(pool: PoolView): string {
  if (pool.paused) return "已暂停";
  if (pool.resolved || pool.status === STATUS_SETTLED) return "已结算";
  if (pool.status === STATUS_AUCTION) return "竞价中";
  return "交易中";
}

export function formatUnixTs(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatResolvedValue(pool: PoolView, marketKind?: MarketKind): string {
  const rv = pool.resolvedValue;
  const kind = pool.kind;
  if (kind === POOL_KIND_POISSON || kind === POOL_KIND_DIRICHLET) {
    return String(rv);
  }
  if (kind === POOL_KIND_BETA) {
    return `${Number(rv) / 10}%`;
  }
  if (kind === POOL_KIND_NORMAL || marketKind === "normal") {
    return `${(Number(rv) / 10).toFixed(1)}%`;
  }
  return String(rv);
}

function isLinearKind(kind: number): boolean {
  return kind >= CONTRACT_LINEAR_CALL && kind <= CONTRACT_BARRIER_NOTE;
}

export function isPositionWinner(
  position: PositionView,
  pool: PoolView,
): boolean {
  if (!pool.resolved) return false;
  const rv = pool.resolvedValue;
  const slot = Number(rv);
  const kind = pool.kind;

  if (kind === POOL_KIND_POISSON) {
    if (slot >= 15) return false;
    if (position.contractKind === CONTRACT_DIGITAL) {
      return slot === position.intervalA;
    }
    return slot >= position.intervalA && slot <= position.intervalB;
  }

  if (kind === POOL_KIND_DIRICHLET) {
    if (slot >= 15) return false;
    return slot === position.intervalA;
  }

  if (kind === POOL_KIND_NORMAL) {
    if (isLinearKind(position.contractKind)) {
      return true;
    }
    if (position.contractKind === CONTRACT_DIGITAL) {
      return rv >= BigInt(position.intervalA);
    }
    return (
      rv >= BigInt(position.intervalA) && rv <= BigInt(position.intervalB)
    );
  }

  if (kind === POOL_KIND_BETA) {
    return (
      slot >= position.intervalA &&
      slot <= position.intervalB &&
      slot <= 1000
    );
  }

  return false;
}

function derivativePayoutUsdc(
  contractKind: number,
  paramA: number,
  paramB: number,
  resolvedSlot: number,
  stakeUsdc: bigint,
): bigint {
  let diff = 0n;
  if (contractKind === CONTRACT_LINEAR_CALL) {
    diff = BigInt(Math.max(resolvedSlot - paramA, 0));
  } else if (contractKind === CONTRACT_LINEAR_PUT) {
    diff = BigInt(Math.max(paramA - resolvedSlot, 0));
  } else if (contractKind === CONTRACT_STRADDLE) {
    diff = BigInt(Math.abs(resolvedSlot - paramA));
  } else if (contractKind === CONTRACT_VARIANCE_SWAP) {
    const d = BigInt(Math.abs(resolvedSlot - paramA));
    diff = d * d;
  } else if (contractKind === CONTRACT_STRUCTURED_NOTE) {
    const uncapped = BigInt(Math.max(resolvedSlot - paramA, 0));
    const cap = BigInt(Math.max(paramB - paramA, 0));
    diff = uncapped > cap ? cap : uncapped;
  } else if (contractKind === CONTRACT_RANGE_NOTE) {
    return resolvedSlot >= paramA && resolvedSlot <= paramB ? stakeUsdc : 0n;
  } else if (contractKind === CONTRACT_BARRIER_NOTE) {
    return resolvedSlot >= paramA ? stakeUsdc : 0n;
  } else {
    return 0n;
  }
  return (stakeUsdc * diff) / 10n;
}

export function estimatePayoutUsdc(
  position: PositionView,
  pool: PoolView,
): bigint {
  if (!pool.resolved || !isPositionWinner(position, pool)) return 0n;
  if (isLinearKind(position.contractKind)) {
    return derivativePayoutUsdc(
      position.contractKind,
      position.intervalA,
      position.intervalB,
      Number(pool.resolvedValue),
      position.stakeUsdc,
    );
  }
  if (position.entryProbPpb <= 0n) return 0n;
  return (position.stakeUsdc * 1_000_000_000n) / position.entryProbPpb;
}

export function getSettlementDisplay(
  position: PositionView,
  pool: PoolView | undefined,
): SettlementDisplay {
  if (position.claimed) {
    return { state: "claimed", label: "已领取赔付" };
  }
  if (!pool?.resolved) {
    const status = pool ? poolStatusLabel(pool) : "未知";
    return { state: "pending", label: `待结算（池状态：${status}）` };
  }
  const winner = isPositionWinner(position, pool);
  if (!winner) {
    return { state: "miss", label: "未命中", payoutUsdc: 0n };
  }
  const payout = estimatePayoutUsdc(position, pool);
  return {
    state: "hit",
    label: "已命中，可领取",
    payoutUsdc: payout,
  };
}

export function formatUsdcAmount(amount: bigint | null | undefined): string {
  if (amount == null) return "—";
  return `${formatUsdcBaseUnits(amount)} USDC`;
}

export function effectiveFeeBps(pool: PoolView): number {
  return Math.floor((pool.feeBps * (10_000 + pool.feeMultiplierBps)) / 10_000);
}

export function effectiveSigmaTenths(pool: PoolView): number {
  return pool.sigmaTenths + pool.sigmaVirtualTenths;
}

/** Human-readable AMM parameter lines for a pool snapshot. */
export function formatPoolParameterLines(pool: PoolView): string[] {
  const lines: string[] = [
    `Vault: ${formatUsdcBaseUnits(pool.collateralUsdc)} USDC`,
    `费率: ${pool.feeBps} bps（有效 ${effectiveFeeBps(pool)} bps）`,
  ];

  if (pool.kind === POOL_KIND_POISSON) {
    lines.push(`λ = ${(pool.lambdaTenths / 10).toFixed(1)} 球/场`);
  } else if (pool.kind === POOL_KIND_DIRICHLET) {
    const alphas =
      pool.dirichletAlphas.length > 0
        ? pool.dirichletAlphas.join(", ")
        : "—";
    lines.push(`α = [${alphas}]`);
  } else if (pool.kind === POOL_KIND_NORMAL) {
    lines.push(
      `μ = ${(pool.muTenths / 10).toFixed(1)}% · σ = ${(effectiveSigmaTenths(pool) / 10).toFixed(1)}%`,
    );
  } else if (pool.kind === POOL_KIND_BETA) {
    const a = pool.dirichletAlphas[0] ?? 0;
    const b = pool.dirichletAlphas[1] ?? 0;
    lines.push(`Beta α=${a} · β=${b}`);
  }

  return lines;
}

export function formatTimeToMaturity(pool: PoolView, nowSec = Math.floor(Date.now() / 1000)): string {
  if (pool.resolved) return "已到期并结算";
  if (!pool.maturityTs) return "—";
  const delta = pool.maturityTs - nowSec;
  if (delta <= 0) return "已到期待 Oracle 结算";
  const days = Math.floor(delta / 86400);
  const hours = Math.floor((delta % 86400) / 3600);
  if (days > 0) return `距到期 ${days} 天 ${hours} 小时`;
  const mins = Math.floor((delta % 3600) / 60);
  return `距到期 ${hours} 小时 ${mins} 分`;
}

export function getPositionFilterState(
  position: PositionView,
  pool: PoolView | undefined,
): "pending" | "claimable" | "closed" {
  const settlement = getSettlementDisplay(position, pool);
  if (settlement.state === "hit") return "claimable";
  if (settlement.state === "pending") return "pending";
  return "closed";
}

export function matchesPositionFilter(
  position: PositionView,
  pool: PoolView | undefined,
  filter: PositionFilter,
): boolean {
  if (filter === "all") return true;
  return getPositionFilterState(position, pool) === filter;
}

export function summarizePortfolio(
  rows: PositionRow[],
  poolsById: Map<string, PoolView>,
): PortfolioSummary {
  let totalStake = 0n;
  let pendingStake = 0n;
  let claimableUsdc = 0n;
  let claimableCount = 0;
  let lostStake = 0n;

  for (const row of rows) {
    const pool = poolsById.get(row.position.marketId);
    totalStake += row.position.stakeUsdc;
    const state = getPositionFilterState(row.position, pool);
    if (state === "pending") {
      pendingStake += row.position.stakeUsdc;
    } else if (state === "claimable" && pool) {
      claimableCount += 1;
      claimableUsdc += estimatePayoutUsdc(row.position, pool);
    } else if (state === "closed" && pool?.resolved) {
      lostStake += row.position.stakeUsdc;
    }
  }

  return {
    totalCount: rows.length,
    totalStake,
    pendingStake,
    claimableUsdc,
    claimableCount,
    lostStake,
  };
}

export function summarizeMarketGroup(
  poolId: string,
  rows: PositionRow[],
  pool: PoolView | undefined,
): MarketGroupSummary {
  let totalStake = 0n;
  let claimableUsdc = 0n;
  let claimableCount = 0;
  for (const row of rows) {
    totalStake += row.position.stakeUsdc;
    if (
      pool &&
      !row.position.claimed &&
      isPositionWinner(row.position, pool) &&
      pool.resolved
    ) {
      claimableCount += 1;
      claimableUsdc += estimatePayoutUsdc(row.position, pool);
    }
  }
  return {
    poolId,
    positionCount: rows.length,
    totalStake,
    claimableUsdc,
    claimableCount,
  };
}

export function claimableRows(
  rows: PositionRow[],
  pool: PoolView | undefined,
): PositionRow[] {
  if (!pool?.resolved) return [];
  return rows.filter(
    (row) =>
      !row.position.claimed && isPositionWinner(row.position, pool),
  );
}
