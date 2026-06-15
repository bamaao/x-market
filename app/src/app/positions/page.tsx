"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { PACKAGE_ID, indexerMarketToRef } from "@/lib/markets";
import { fetchIndexerMarkets, indexerEnabled } from "@/lib/indexer";
import {
  findMarketByPoolId,
  matchesPositionFilter,
  parseMoveObjectFields,
  parsePoolView,
  parsePositionView,
  summarizePortfolio,
  type MarketRef,
  type PositionFilter,
  type PositionRow,
} from "@/lib/position-display";
import { PageHeader } from "@/components/PageHeader";
import { MarketPositionsGroup } from "@/components/MarketPositionsGroup";
import { formatUsdcBaseUnits } from "@/lib/usdc";
import { useT } from "@/i18n/context";

const LINEAR_CALL_KIND = 2;
const LINEAR_PUT_KIND = 3;
const STRADDLE_KIND = 4;
const VARIANCE_SWAP_KIND = 5;
const STRUCTURED_NOTE_KIND = 6;
const RANGE_NOTE_KIND = 7;
const BARRIER_NOTE_KIND = 8;
const OUTCOME_SLOTS = 15;

const FILTER_OPTIONS = [
  { id: "all" as const, key: "positions.filterAll" },
  { id: "pending" as const, key: "positions.filterPending" },
  { id: "claimable" as const, key: "positions.filterClaimable" },
  { id: "closed" as const, key: "positions.filterClosed" },
];

function estimateCrossMargin(
  positions: Array<{
    contract_kind: number;
    interval_a: number;
    interval_b: number;
    stake_usdc: bigint;
    entry_prob_ppb: bigint;
  }>,
): bigint {
  let worst = 0n;
  for (let slot = 0; slot < OUTCOME_SLOTS; slot += 1) {
    let scenario = 0n;
    for (const p of positions) {
      if (p.contract_kind === LINEAR_CALL_KIND) {
        const diff = BigInt(Math.max(slot - p.interval_a, 0));
        scenario += (p.stake_usdc * diff) / 10n;
      } else if (p.contract_kind === LINEAR_PUT_KIND) {
        const diff = BigInt(Math.max(p.interval_a - slot, 0));
        scenario += (p.stake_usdc * diff) / 10n;
      } else if (p.contract_kind === STRADDLE_KIND) {
        const diff = BigInt(Math.abs(slot - p.interval_a));
        scenario += (p.stake_usdc * diff) / 10n;
      } else if (p.contract_kind === VARIANCE_SWAP_KIND) {
        const d = BigInt(Math.abs(slot - p.interval_a));
        scenario += (p.stake_usdc * d * d) / 10n;
      } else if (p.contract_kind === STRUCTURED_NOTE_KIND) {
        const uncapped = BigInt(Math.max(slot - p.interval_a, 0));
        const cap = BigInt(Math.max(p.interval_b - p.interval_a, 0));
        const diff = uncapped > cap ? cap : uncapped;
        scenario += (p.stake_usdc * diff) / 10n;
      } else if (p.contract_kind === RANGE_NOTE_KIND) {
        if (slot >= p.interval_a && slot <= p.interval_b) {
          scenario += p.stake_usdc;
        }
      } else if (p.contract_kind === BARRIER_NOTE_KIND) {
        if (slot >= p.interval_a) {
          scenario += p.stake_usdc;
        }
      } else if (p.entry_prob_ppb > 0n) {
        const inRange = slot >= p.interval_a && slot <= p.interval_b;
        if (inRange) {
          scenario += (p.stake_usdc * 1_000_000_000n) / p.entry_prob_ppb;
        }
      }
    }
    if (scenario > worst) worst = scenario;
  }
  return worst;
}

export default function PositionsPage() {
  const t = useT();
  const account = useCurrentAccount();
  const [indexerMarkets, setIndexerMarkets] = useState<MarketRef[]>([]);
  const [filter, setFilter] = useState<PositionFilter>("all");

  useEffect(() => {
    if (!indexerEnabled()) return;
    void fetchIndexerMarkets().then(({ markets: rows }) => {
      setIndexerMarkets(rows.map(indexerMarketToRef));
    });
  }, []);

  const { data, isPending, refetch } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address ?? "",
      filter: {
        StructType: `${PACKAGE_ID}::position::Position`,
      },
      options: { showContent: true, showType: true },
    },
    { enabled: !!account?.address && PACKAGE_ID !== "0x0" },
  );

  const allRows = useMemo((): PositionRow[] => {
    const rows =
      data?.data
        ?.map((obj) => {
          const raw = parseMoveObjectFields(obj.data?.content);
          const view = parsePositionView(raw);
          if (!view) return null;
          return {
            objectId: obj.data?.objectId ?? "",
            position: view,
            market: findMarketByPoolId(view.marketId, indexerMarkets),
          };
        })
        .filter(Boolean) ?? [];
    return rows as PositionRow[];
  }, [data?.data, indexerMarkets]);

  const poolIds = useMemo(
    () => [...new Set(allRows.map((p) => p.position.marketId).filter(Boolean))],
    [allRows],
  );

  const { data: poolBatch, refetch: refetchPools } = useSuiClientQuery(
    "multiGetObjects",
    {
      ids: poolIds,
      options: { showContent: true },
    },
    { enabled: poolIds.length > 0 },
  );

  const poolsById = useMemo(() => {
    const map = new Map<string, NonNullable<ReturnType<typeof parsePoolView>>>();
    poolBatch?.forEach((entry, idx) => {
      const poolId = poolIds[idx];
      if (!poolId || entry.error) return;
      const fields = parseMoveObjectFields(entry.data?.content);
      const view = parsePoolView(poolId, fields);
      if (view) map.set(poolId, view);
    });
    return map;
  }, [poolBatch, poolIds]);

  const filteredRows = useMemo(
    () =>
      allRows.filter((row) =>
        matchesPositionFilter(
          row.position,
          poolsById.get(row.position.marketId),
          filter,
        ),
      ),
    [allRows, poolsById, filter],
  );

  const portfolio = useMemo(
    () => summarizePortfolio(allRows, poolsById),
    [allRows, poolsById],
  );

  const crossMarginVar = estimateCrossMargin(
    allRows.map((p) => ({
      contract_kind: p.position.contractKind,
      interval_a: p.position.intervalA,
      interval_b: p.position.intervalB,
      stake_usdc: p.position.stakeUsdc,
      entry_prob_ppb: p.position.entryProbPpb,
    })),
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, PositionRow[]>();
    for (const item of filteredRows) {
      const key = item.position.marketId;
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return [...groups.entries()].sort((a, b) => {
      const poolA = poolsById.get(a[0]);
      const poolB = poolsById.get(b[0]);
      const claimA = summarizePortfolio(a[1], poolsById).claimableUsdc;
      const claimB = summarizePortfolio(b[1], poolsById).claimableUsdc;
      if (claimA !== claimB) return claimB > claimA ? 1 : -1;
      return (poolB?.maturityTs ?? 0) - (poolA?.maturityTs ?? 0);
    });
  }, [filteredRows, poolsById]);

  const refreshAll = () => {
    void refetch();
    void refetchPools();
  };

  return (
    <>
      <PageHeader
        title={t("positions.title")}
        subtitle={t("positions.subtitle")}
      />

      {!account && <p className="hint">{t("positions.connectHint")}</p>}

      {account && (
        <>
          <div className="positions-summary">
            <div className="stat-card">
              <div className="label">{t("positions.statCount")}</div>
              <div className="value accent">{portfolio.totalCount}</div>
            </div>
            <div className="stat-card">
              <div className="label">{t("positions.statCost")}</div>
              <div className="value">
                {formatUsdcBaseUnits(portfolio.totalStake)} USDC
              </div>
            </div>
            <div className="stat-card">
              <div className="label">{t("positions.statPending")}</div>
              <div className="value">
                {formatUsdcBaseUnits(portfolio.pendingStake)} USDC
              </div>
            </div>
            <div className="stat-card">
              <div className="label">{t("positions.statClaimable")}</div>
              <div className="value accent">
                {formatUsdcBaseUnits(portfolio.claimableUsdc)} USDC
              </div>
              <div className="hint" style={{ marginTop: "0.25rem" }}>
                {t("positions.claimableCount", { count: portfolio.claimableCount })}
              </div>
            </div>
            <div className="stat-card">
              <div className="label">{t("positions.statUnhit")}</div>
              <div className="value">
                {formatUsdcBaseUnits(portfolio.lostStake)} USDC
              </div>
            </div>
            <div className="stat-card">
              <div className="label">{t("positions.crossMargin")}</div>
              <div className="value">
                {formatUsdcBaseUnits(crossMarginVar)} USDC
              </div>
            </div>
            <button type="button" className="secondary" onClick={refreshAll}>
              {t("common.refresh")}
            </button>
          </div>

          <div className="positions-filters" role="tablist" aria-label={t("positions.title")}>
            {FILTER_OPTIONS.map(({ id, key }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                className={filter === id ? "filter-chip active" : "filter-chip"}
                onClick={() => setFilter(id)}
              >
                {t(key)}
              </button>
            ))}
          </div>
        </>
      )}

      {isPending && account && <p className="hint">{t("positions.loading")}</p>}

      {grouped.map(([poolId, items]) => {
        const market =
          items[0]?.market ?? findMarketByPoolId(poolId, indexerMarkets);
        const pool = poolsById.get(poolId);
        return (
          <MarketPositionsGroup
            key={poolId}
            poolId={poolId}
            market={market}
            pool={pool}
            rows={items}
            onClaimSuccess={refreshAll}
          />
        );
      })}

      {account &&
        filteredRows.length === 0 &&
        allRows.length > 0 &&
        !isPending && (
          <p className="hint">{t("positions.filterEmpty")}</p>
        )}

      {account && allRows.length === 0 && !isPending && (
        <p className="hint">{t("positions.emptyBuy")}</p>
      )}
    </>
  );
}
