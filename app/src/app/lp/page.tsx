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

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { PACKAGE_ID, indexerMarketToRef } from "@/lib/markets";
import { fetchIndexerMarkets, indexerEnabled } from "@/lib/indexer";
import { estimateLpRedeemUsdc, parsePoolNavFields } from "@/lib/lp";
import {
  findMarketByPoolId,
  parseMoveObjectFields,
  parsePoolView,
  STATUS_SETTLED,
  STATUS_TRADING,
  STATUS_VOIDED,
  type MarketRef,
  type PoolView,
} from "@/lib/position-display";
import { formatUsdcBaseUnits } from "@/lib/usdc";
import { PageHeader } from "@/components/PageHeader";
import { LpMarketGroup, type LpShareRow } from "@/components/LpMarketGroup";
import { useT } from "@/i18n/context";

type LpFilter = "all" | "active" | "settled";

const FILTER_OPTIONS: Array<{ id: LpFilter; key: string }> = [
  { id: "all", key: "lp.filterAll" },
  { id: "active", key: "lp.filterActive" },
  { id: "settled", key: "lp.filterSettled" },
];

interface LpRow {
  lpObjectId: string;
  poolId: string;
  shares: bigint;
  market?: MarketRef;
}

function poolMatchesFilter(pool: PoolView | undefined, filter: LpFilter): boolean {
  if (filter === "all") return true;
  if (!pool) return filter === "active";
  const settled =
    pool.resolved ||
    pool.status === STATUS_SETTLED ||
    pool.status === STATUS_VOIDED;
  if (filter === "settled") return settled;
  return pool.status === STATUS_TRADING && !pool.paused;
}

export default function LpPage() {
  const t = useT();
  const account = useCurrentAccount();
  const [indexerMarkets, setIndexerMarkets] = useState<MarketRef[]>([]);
  const [filter, setFilter] = useState<LpFilter>("all");

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
        StructType: `${PACKAGE_ID}::lp_token::LpShare`,
      },
      options: { showContent: true },
    },
    { enabled: !!account?.address && PACKAGE_ID !== "0x0" },
  );

  const rows = useMemo((): LpRow[] => {
    const mapped =
      data?.data
        ?.map((obj) => {
          const fields = parseMoveObjectFields(obj.data?.content);
          const poolId = String(fields?.market_id ?? "").trim();
          const sharesRaw = fields?.shares;
          if (!poolId || sharesRaw == null) return null;
          return {
            lpObjectId: obj.data?.objectId ?? "",
            poolId,
            shares: BigInt(String(sharesRaw)),
            market: findMarketByPoolId(poolId, indexerMarkets),
          };
        })
        .filter(Boolean) ?? [];
    return mapped as LpRow[];
  }, [data?.data, indexerMarkets]);

  const poolIds = useMemo(
    () => [...new Set(rows.map((r) => r.poolId))],
    [rows],
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
    const views = new Map<string, PoolView>();
    const fieldsMap = new Map<string, Record<string, unknown>>();
    poolBatch?.forEach((entry, idx) => {
      const poolId = poolIds[idx];
      if (!poolId || entry.error) return;
      const fields = parseMoveObjectFields(entry.data?.content);
      if (!fields) return;
      fieldsMap.set(poolId, fields);
      const view = parsePoolView(poolId, fields);
      if (view) views.set(poolId, view);
    });
    return { views, fieldsMap };
  }, [poolBatch, poolIds]);

  const grouped = useMemo(() => {
    const groups = new Map<string, LpRow[]>();
    for (const row of rows) {
      const list = groups.get(row.poolId) ?? [];
      list.push(row);
      groups.set(row.poolId, list);
    }
    return [...groups.entries()]
      .filter(([poolId]) =>
        poolMatchesFilter(poolsById.views.get(poolId), filter),
      )
      .sort((a, b) => {
        const poolA = poolsById.views.get(a[0]);
        const poolB = poolsById.views.get(b[0]);
        return (poolB?.maturityTs ?? 0) - (poolA?.maturityTs ?? 0);
      });
  }, [rows, poolsById.views, filter]);

  const portfolio = useMemo(() => {
    let totalShares = 0n;
    let totalEstimated = 0n;
    for (const row of rows) {
      totalShares += row.shares;
      const fields = poolsById.fieldsMap.get(row.poolId);
      const nav = parsePoolNavFields(fields);
      if (!nav) continue;
      const est = estimateLpRedeemUsdc(
        row.shares,
        nav.vaultUsdc,
        nav.liabilityByK,
        nav.lpShares,
      );
      if (est != null) totalEstimated += est;
    }
    return {
      shareCount: rows.length,
      marketCount: poolIds.length,
      totalShares,
      totalEstimated,
    };
  }, [rows, poolIds.length, poolsById.fieldsMap]);

  const refreshAll = () => {
    void refetch();
    void refetchPools();
  };

  const buildShareRows = (items: LpRow[]): LpShareRow[] =>
    items.map((row) => {
      const fields = poolsById.fieldsMap.get(row.poolId);
      const nav = parsePoolNavFields(fields);
      const estimatedUsdc =
        nav != null
          ? estimateLpRedeemUsdc(
              row.shares,
              nav.vaultUsdc,
              nav.liabilityByK,
              nav.lpShares,
            )
          : null;
      return {
        lpObjectId: row.lpObjectId,
        shares: row.shares,
        estimatedUsdc,
      };
    });

  return (
    <>
      <PageHeader title={t("lp.title")} subtitle={t("lp.portfolioSubtitle")} />

      {!account && <p className="hint">{t("lp.connectHint")}</p>}

      {account && (
        <>
          <div className="positions-summary">
            <div className="stat-card">
              <div className="label">{t("lp.statCount")}</div>
              <div className="value accent">{portfolio.shareCount}</div>
            </div>
            <div className="stat-card">
              <div className="label">{t("lp.statMarkets")}</div>
              <div className="value">{portfolio.marketCount}</div>
            </div>
            <div className="stat-card">
              <div className="label">{t("lp.statShares")}</div>
              <div className="value">
                {formatUsdcBaseUnits(portfolio.totalShares)}
              </div>
            </div>
            <div className="stat-card">
              <div className="label">{t("lp.statEstValue")}</div>
              <div className="value accent">
                {formatUsdcBaseUnits(portfolio.totalEstimated)} USDC
              </div>
            </div>
            <button type="button" className="secondary" onClick={refreshAll}>
              {t("common.refresh")}
            </button>
          </div>

          <div className="positions-filters" role="tablist" aria-label={t("lp.title")}>
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

      {isPending && account && <p className="hint">{t("lp.loading")}</p>}

      {grouped.map(([poolId, items]) => (
        <LpMarketGroup
          key={poolId}
          poolId={poolId}
          market={items[0]?.market ?? findMarketByPoolId(poolId, indexerMarkets)}
          pool={poolsById.views.get(poolId)}
          poolFields={poolsById.fieldsMap.get(poolId)}
          rows={buildShareRows(items)}
          onRedeemSuccess={refreshAll}
        />
      ))}

      {account && grouped.length === 0 && rows.length > 0 && !isPending && (
        <p className="hint">{t("lp.filterEmpty")}</p>
      )}

      {account && rows.length === 0 && !isPending && (
        <p className="hint">
          {t("lp.empty")}{" "}
          <Link href="/">{t("lp.emptyDeposit")}</Link>
        </p>
      )}
    </>
  );
}
