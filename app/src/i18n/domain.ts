import type { Translator } from "./core";
import type { Locale } from "./types";
import type { MarketKind } from "@/lib/markets";
import type { ProphetMarketEligibility, ProphetMarketStatus } from "@/lib/prophet-market-eligibility";
import { PROPHET_UNLOCK_CUTOFF_SECS } from "@/lib/prophet-market-eligibility";
import type { OracleQueueFilter, OracleQueueStatus } from "@/lib/oracle-queue";
import type { AuditPreviewOutcome, ProphetStatsView, ProphetWorkflowStep } from "@/lib/prophet";
import {
  MIN_AUDITED_FOR_PAID,
  MIN_SCORE_BPS_FOR_PAID,
  formatScorePercent,
} from "@/lib/prophet";
import {
  CONTRACT_BARRIER_NOTE,
  CONTRACT_DIGITAL,
  CONTRACT_LINEAR_CALL,
  CONTRACT_LINEAR_PUT,
  CONTRACT_RANGE_NOTE,
  CONTRACT_STRADDLE,
  CONTRACT_STRUCTURED_NOTE,
  CONTRACT_VARIANCE_SWAP,
  POOL_KIND_BETA,
  POOL_KIND_DIRICHLET,
  POOL_KIND_NORMAL,
  POOL_KIND_POISSON,
  effectiveFeeBps,
  effectiveSigmaTenths,
  getSettlementDisplay,
  type PoolView,
  type PositionView,
  type SettlementDisplay,
} from "@/lib/position-display";
import { formatUsdcBaseUnits } from "@/lib/usdc";

const POOL_STATUS_KEYS: Record<ProphetMarketStatus, string> = {
  open: "prophet.poolStatusOpen",
  closing: "prophet.poolStatusClosing",
  expired: "prophet.poolStatusExpired",
  resolved: "prophet.poolStatusResolved",
  paused: "prophet.poolStatusPaused",
  no_pool: "prophet.poolStatusNoPool",
};

export function localizedProphetPoolStatus(
  status: ProphetMarketStatus,
  t: Translator,
): string {
  return t(POOL_STATUS_KEYS[status]);
}

export function localizedProphetEligibilityReason(
  eligibility: ProphetMarketEligibility,
  t: Translator,
): string {
  switch (eligibility.status) {
    case "no_pool":
      return t("prophet.eligibilityNoPool");
    case "resolved":
      return t("prophet.eligibilityResolved");
    case "paused":
      return t("prophet.eligibilityPaused");
    case "expired":
      return t("prophet.eligibilityExpired");
    case "closing":
      if (eligibility.closingReason === "resolution_window") {
        return t("prophet.eligibilityResolutionWindow");
      }
      return t("prophet.eligibilityClosing", {
        minutes: PROPHET_UNLOCK_CUTOFF_SECS / 60,
      });
    case "open":
      return t("prophet.eligibilityOpen");
  }
}

export function localizedRemainingTime(secs: number | null, t: Translator): string {
  if (secs == null) return t("common.dash");
  if (secs <= 0) return t("prophet.remainingExpired");
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return t("prophet.remainingDays", { d, h });
  if (h > 0) return t("prophet.remainingHours", { h, m });
  return t("prophet.remainingMinutes", { m });
}

export function localizedProphecyStatus(status: number, t: Translator): string {
  switch (status) {
    case 0:
      return t("prophet.statusOpen");
    case 1:
      return t("prophet.statusWin");
    case 2:
      return t("prophet.statusLoss");
    case 3:
      return t("prophet.statusCheat");
    default:
      return t("prophet.statusUnknown", { status });
  }
}

export function localizedContractKind(kind: number, t: Translator): string {
  switch (kind) {
    case 1:
      return t("positions.contract.digital");
    case 2:
      return "Linear Call";
    case 3:
      return "Linear Put";
    case 4:
      return "Straddle";
    case 5:
      return "Variance Swap";
    case 6:
      return "Structured Note";
    case 7:
      return "Range Note";
    case 8:
      return "Barrier Note";
    default:
      return t("positions.contract.interval");
  }
}

export function localizedPoolStatusLabel(
  pool: { paused: boolean; resolved: boolean; status: number },
  t: Translator,
): string {
  if (pool.paused) return t("positions.poolStatus.paused");
  if (pool.resolved || pool.status === 2) return t("positions.poolStatus.settled");
  if (pool.status === 0) return t("positions.poolStatus.auction");
  return t("positions.poolStatus.trading");
}

export function localizedMaturityHint(
  pool: { resolved: boolean; maturityTs: number },
  nowSec: number,
  t: Translator,
): string {
  if (pool.resolved) return t("positions.maturity.settled");
  if (!pool.maturityTs) return t("common.dash");
  const delta = pool.maturityTs - nowSec;
  if (delta <= 0) return t("positions.maturity.pendingOracle");
  return new Date(pool.maturityTs * 1000).toLocaleString();
}

export function localizedOracleWorkflowStep(
  step: string,
  t: Translator,
): string {
  const map: Record<string, string> = {
    register_feed: "oracle.stepRegisterFeed",
    propose: "oracle.stepWaitPropose",
    liveness: "oracle.stepLiveness",
    finalize_or_dispute: "oracle.stepFinalize",
    arbitration: "oracle.stepArbitration",
    settled: "oracle.stepSettled",
    idle: "common.dash",
  };
  const key = map[step];
  return key ? t(key) : step;
}

export function localizedVerdictLabel(verdict: number, t: Translator): string {
  switch (verdict) {
    case 1:
      return t("oracle.verdictProposer");
    case 2:
      return t("oracle.verdictDisputer");
    case 3:
      return t("oracle.verdictUnresolved");
    default:
      return t("oracle.verdictPending");
  }
}

export function localizedClaimedValueHint(kind: string, t: Translator): string {
  switch (kind) {
    case "poisson":
      return t("oracle.valueHintPoisson");
    case "dirichlet":
      return t("oracle.valueHintDirichlet");
    case "normal":
      return t("oracle.valueHintNormal");
    case "beta":
      return t("oracle.valueHintBeta");
    default:
      return "";
  }
}

export function localizedCountdown(secs: number, t: Translator): string {
  if (secs <= 0) return t("oracle.countdownEnded");
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function localizedContractMode(mode: string, t: Translator): string {
  switch (mode) {
    case "interval":
      return t("trade.interval");
    case "digital":
      return t("trade.digital");
    default:
      return mode.replace(/_/g, " ");
  }
}

export function localizedAuctionBucketLabel(
  kind: string,
  index: 0 | 1 | 2,
  t: Translator,
): string {
  const keys: Record<string, [string, string, string]> = {
    poisson: ["auction.bucketPoisson0", "auction.bucketPoisson1", "auction.bucketPoisson2"],
    dirichlet: ["auction.bucketDirichlet0", "auction.bucketDirichlet1", "auction.bucketDirichlet2"],
    normal: ["auction.bucketNormal0", "auction.bucketNormal1", "auction.bucketNormal2"],
  };
  const bucketKeys = keys[kind] ?? keys.poisson;
  return t(bucketKeys[index]);
}

export function localizedSettlementDisplay(
  position: PositionView,
  pool: PoolView | undefined,
  t: Translator,
): SettlementDisplay {
  const raw = getSettlementDisplay(position, pool);
  switch (raw.state) {
    case "claimed":
      return { ...raw, label: t("positions.settlement.claimed") };
    case "pending": {
      const status = pool
        ? localizedPoolStatusLabel(pool, t)
        : t("common.unknown");
      return { ...raw, label: t("positions.settlement.pending", { status }) };
    }
    case "miss":
      return { ...raw, label: t("positions.settlement.miss") };
    case "hit":
      return { ...raw, label: t("positions.settlement.hit") };
  }
}

export function localizedPaidUnlockEligibilityHint(
  stats: ProphetStatsView | null | undefined,
  t: Translator,
): string {
  if (!stats) {
    return t("prophet.paidHintNew", {
      min: MIN_AUDITED_FOR_PAID,
      score: MIN_SCORE_BPS_FOR_PAID / 100,
    });
  }
  if (stats.cheats > 0) return t("prophet.paidHintCheat");
  if (stats.totalAudited < MIN_AUDITED_FOR_PAID) {
    return t("prophet.paidHintProgress", {
      audited: stats.totalAudited,
      required: MIN_AUDITED_FOR_PAID,
    });
  }
  if (stats.scoreBps < MIN_SCORE_BPS_FOR_PAID) {
    return t("prophet.paidHintScore", {
      score: formatScorePercent(stats.scoreBps),
      min: MIN_SCORE_BPS_FOR_PAID / 100,
    });
  }
  return t("prophet.paidHintEligible");
}

export function localizedProphetWorkflowStep(
  step: ProphetWorkflowStep,
  t: Translator,
): string {
  switch (step) {
    case "commit":
      return t("prophet.workflowWait");
    case "unlock":
      return t("prophet.workflowUnlock");
    case "decrypt":
      return t("prophet.workflowDecrypt");
    case "audit":
      return t("prophet.workflowAudit");
    case "done":
      return t("prophet.workflowDone");
  }
}

export function localizedAuditOutcome(
  outcome: AuditPreviewOutcome,
  t: Translator,
): string {
  switch (outcome) {
    case "win":
      return t("prophet.auditPreviewWin");
    case "loss":
      return t("prophet.auditPreviewLoss");
    case "cheat":
      return t("prophet.auditPreviewCheat");
  }
}

export function localizedOracleQueueFilter(
  filter: OracleQueueFilter,
  t: Translator,
): string {
  return t(`oracle.queueFilter.${filter}`);
}

export function localizedOracleQueueStatus(
  status: OracleQueueStatus,
  t: Translator,
): string {
  const key = `oracle.queueStatus.${status}`;
  const label = t(key);
  return label === key ? t("oracle.queueStatus.other") : label;
}

export function localizedFeedStatus(status: number, t: Translator): string {
  switch (status) {
    case 0:
      return t("oracle.feedOpen");
    case 1:
      return t("oracle.feedFinalized");
    case 2:
      return t("oracle.feedNullified");
    default:
      return String(status);
  }
}

export function localizedAssertionStatus(status: number, t: Translator): string {
  switch (status) {
    case 0:
      return t("oracle.assertionProposed");
    case 1:
      return t("oracle.assertionArbitration");
    case 2:
      return t("oracle.assertionFinalized");
    case 3:
      return t("oracle.assertionRejected");
    default:
      return String(status);
  }
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

function formatNormalTenths(v: number): string {
  return `${(v / 10).toFixed(1)}%`;
}

export function localizedFormatOutcomeDescription(
  position: PositionView,
  marketKind: MarketKind | undefined,
  poolKind: number | undefined,
  t: Translator,
): string {
  const { contractKind, intervalA, intervalB } = position;
  const kind = poolKind ?? poolKindFromMarketKind(marketKind);

  if (kind === POOL_KIND_DIRICHLET) {
    const labels = [
      t("trade.dirichletHome"),
      t("trade.dirichletDraw"),
      t("trade.dirichletAway"),
    ];
    return labels[intervalA] ?? t("positions.outcome.dirichletFallback", { n: intervalA });
  }

  if (kind === POOL_KIND_POISSON) {
    if (contractKind === CONTRACT_DIGITAL) {
      return t("positions.outcome.poissonExact", { n: intervalA });
    }
    return intervalA === intervalB
      ? t("positions.outcome.poissonSingle", { n: intervalA })
      : t("positions.outcome.poissonRange", { a: intervalA, b: intervalB });
  }

  if (kind === POOL_KIND_BETA) {
    return t("positions.outcome.betaRange", {
      a: (intervalA / 10).toFixed(1),
      b: (intervalB / 10).toFixed(1),
    });
  }

  if (kind === POOL_KIND_NORMAL) {
    if (contractKind === CONTRACT_DIGITAL) {
      return t("positions.outcome.normalGte", { v: formatNormalTenths(intervalA) });
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
    return t("positions.outcome.normalRange", {
      a: formatNormalTenths(intervalA),
      b: formatNormalTenths(intervalB),
    });
  }

  if (contractKind === CONTRACT_DIGITAL) {
    return t("positions.outcome.fallback", { n: intervalA });
  }
  return intervalA === intervalB
    ? t("positions.outcome.bracketSingle", { n: intervalA })
    : t("positions.outcome.bracketRange", { a: intervalA, b: intervalB });
}

export function localizedFormatPoolParameterLines(pool: PoolView, t: Translator): string[] {
  const lines: string[] = [
    t("positions.poolParams.vault", {
      amount: formatUsdcBaseUnits(pool.collateralUsdc),
    }),
    t("positions.poolParams.feeRate", {
      fee: pool.feeBps,
      effective: effectiveFeeBps(pool),
    }),
  ];

  if (pool.kind === POOL_KIND_POISSON) {
    lines.push(
      t("positions.poolParams.poissonLambda", {
        lambda: (pool.lambdaTenths / 10).toFixed(1),
      }),
    );
  } else if (pool.kind === POOL_KIND_DIRICHLET) {
    const alphas =
      pool.dirichletAlphas.length > 0 ? pool.dirichletAlphas.join(", ") : "—";
    lines.push(t("positions.poolParams.dirichletAlpha", { alphas }));
  } else if (pool.kind === POOL_KIND_NORMAL) {
    lines.push(
      t("positions.poolParams.normalMuSigma", {
        mu: (pool.muTenths / 10).toFixed(1),
        sigma: (effectiveSigmaTenths(pool) / 10).toFixed(1),
      }),
    );
  } else if (pool.kind === POOL_KIND_BETA) {
    const a = pool.dirichletAlphas[0] ?? 0;
    const b = pool.dirichletAlphas[1] ?? 0;
    lines.push(t("positions.poolParams.betaParams", { a, b }));
  }

  return lines;
}

export function localizedFormatTimeToMaturity(
  pool: PoolView,
  t: Translator,
  nowSec = Math.floor(Date.now() / 1000),
): string {
  if (pool.resolved) return t("positions.maturity.settled");
  if (!pool.maturityTs) return t("common.dash");
  const delta = pool.maturityTs - nowSec;
  if (delta <= 0) return t("positions.maturity.pendingOracle");
  const days = Math.floor(delta / 86400);
  const hours = Math.floor((delta % 86400) / 3600);
  if (days > 0) {
    return t("positions.maturityTime.countdownDays", { days, hours });
  }
  const mins = Math.floor((delta % 3600) / 60);
  return t("positions.maturityTime.countdownHours", { hours, mins });
}

export function localizedFormatUnixTs(ts: number, locale: Locale): string {
  if (!ts) return "—";
  const tag = locale === "zh" ? "zh-CN" : "en-US";
  return new Date(ts * 1000).toLocaleString(tag, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function localizedProphecyVerifyReason(
  reasonKey: string | undefined,
  t: Translator,
): string {
  if (!reasonKey) return "";
  return t(reasonKey);
}
