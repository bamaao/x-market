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

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID } from "@/lib/markets";
import {
  claimableRows,
  formatResolvedValue,
  formatUsdcAmount,
  poolKindLabel,
  summarizeMarketGroup,
  type MarketGroupSummary,
  type MarketRef,
  type PoolView,
  type PositionRow,
} from "@/lib/position-display";
import {
  localizedFormatPoolParameterLines,
  localizedFormatTimeToMaturity,
  localizedFormatUnixTs,
  localizedPoolStatusLabel,
} from "@/i18n/domain";
import { useI18n, useT } from "@/i18n/context";
import { formatCaughtError } from "@/i18n/core";
import {
  fetchIndexerIvHistory,
  indexerEnabled,
  type IndexerIvPoint,
} from "@/lib/indexer";
import { PositionCard } from "@/components/PositionCard";
import { MarketCover } from "@/components/MarketCover";

type Props = {
  poolId: string;
  market?: MarketRef;
  pool?: PoolView;
  rows: PositionRow[];
  onClaimSuccess?: () => void;
};

export function MarketPositionsGroup({
  poolId,
  market,
  pool,
  rows,
  onClaimSuccess,
}: Props) {
  const t = useT();
  const { locale } = useI18n();
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [msg, setMsg] = useState<string | null>(null);
  const [ivLatest, setIvLatest] = useState<IndexerIvPoint | null>(null);

  const groupSummary: MarketGroupSummary = useMemo(
    () => summarizeMarketGroup(poolId, rows, pool),
    [poolId, rows, pool],
  );

  const toClaim = useMemo(() => claimableRows(rows, pool), [rows, pool]);
  const paramLines = pool ? localizedFormatPoolParameterLines(pool, t) : [];

  useEffect(() => {
    if (!indexerEnabled() || !poolId) return;
    void fetchIndexerIvHistory(poolId, 1).then((points) => {
      setIvLatest(points[0] ?? null);
    });
  }, [poolId]);

  const batchClaim = () => {
    if (!pool || toClaim.length === 0) return;
    const tx = new Transaction();
    for (const row of toClaim) {
      tx.moveCall({
        target: `${PACKAGE_ID}::settlement::claim_position`,
        arguments: [tx.object(poolId), tx.object(row.objectId)],
      });
    }
    signAndExecute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { transaction: tx as any },
      {
        onSuccess: (r) => {
          setMsg(
            t("positionsGroup.batchSuccess", {
              count: toClaim.length,
              digest: r.digest?.slice(0, 16) ?? "",
            }),
          );
          onClaimSuccess?.();
        },
        onError: (e) => setMsg(formatCaughtError(e, t)),
      },
    );
  };

  return (
    <section className="positions-group">
      <header className="positions-group-head">
        {market && (
          <MarketCover
            id={market.id}
            imageUrl={market.imageUrl}
            title={market.title}
            kind={market.kind}
            variant="thumb"
          />
        )}
        <div className="positions-group-title">
          {market ? (
            <Link href={`/markets/${market.id}`} className="position-market-link">
              <h2>{market.title}</h2>
            </Link>
          ) : (
            <h2>{t("positionsGroup.unknownMarket")}</h2>
          )}
          <p className="hint position-market-desc">
            {market?.description ?? `Pool ${poolId.slice(0, 12)}…`}
          </p>
        </div>
        <div className="position-badges">
          {pool && (
            <span className={`badge badge-${market?.kind ?? "poisson"}`}>
              {poolKindLabel(pool.kind)}
            </span>
          )}
          <span className="badge">
            {t("positionsGroup.positionCount", { count: groupSummary.positionCount })}
          </span>
        </div>
      </header>

      {pool && (
        <div className="positions-market-panel card">
          <div className="positions-market-panel-grid">
            <div>
              <h3>{t("positionsGroup.snapshot")}</h3>
              <ul className="pos-meta">
                <li>
                  {t("positionsGroup.status")}: {localizedPoolStatusLabel(pool, t)}
                </li>
                <li>
                  {t("positionsGroup.maturity")}: {localizedFormatUnixTs(pool.maturityTs, locale)}
                </li>
                <li>{localizedFormatTimeToMaturity(pool, t)}</li>
                {pool.resolved && (
                  <li>
                    {t("positionsGroup.settledValue")}:{" "}
                    {formatResolvedValue(pool, market?.kind)}
                  </li>
                )}
              </ul>
            </div>
            <div>
              <h3>{t("positionsGroup.params")}</h3>
              <ul className="pos-meta">
                {paramLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            {ivLatest && (
              <div>
                <h3>{t("iv.title")}</h3>
                <ul className="pos-meta">
                  <li>{t("iv.sigmaBase")}: {ivLatest.iv_tenths}</li>
                  <li>{t("iv.latestTau")}: {((ivLatest.tau_bps ?? 0) / 100).toFixed(1)}%</li>
                  <li>{t("iv.latestVolCrush")}: {ivLatest.vol_crush_bps} bps</li>
                </ul>
              </div>
            )}
          </div>
          <div className="positions-market-panel-actions">
            {market && (
              <Link href={`/markets/${market.id}`} className="secondary btn-link">
                {t("positionsGroup.tradeLink")}
              </Link>
            )}
            <Link
              href={`/oracle?pool=${encodeURIComponent(poolId)}`}
              className="secondary btn-link"
            >
              {t("positionsGroup.oracleLink")}
            </Link>
            {groupSummary.claimableCount > 0 && (
              <span className="positions-claimable-chip">
                {t("positionsGroup.claimable", {
                  amount: formatUsdcAmount(groupSummary.claimableUsdc),
                })}
              </span>
            )}
            {account && toClaim.length > 1 && (
              <button
                type="button"
                className="secondary"
                disabled={isPending}
                onClick={batchClaim}
              >
                {isPending
                  ? t("positionsGroup.batchClaiming")
                  : t("positionsGroup.batchClaim", { count: toClaim.length })}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid">
        {rows.map((row) => (
          <PositionCard
            key={row.objectId}
            objectId={row.objectId}
            position={row.position}
            market={market}
            pool={pool}
            showMarketHeader={false}
            onClaimSuccess={onClaimSuccess}
          />
        ))}
      </div>

      {msg && <p className="hint">{msg}</p>}
    </section>
  );
}
