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
import { useMemo, useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import {
  appendWithdrawLiquidity,
  parsePoolNavFields,
} from "@/lib/lp";
import {
  canDepositLp,
  formatResolvedValue,
  formatUsdcAmount,
  poolKindLabel,
  STATUS_SETTLED,
  STATUS_VOIDED,
  type MarketRef,
  type PoolView,
} from "@/lib/position-display";
import {
  localizedFormatPoolParameterLines,
  localizedFormatTimeToMaturity,
  localizedFormatUnixTs,
  localizedPoolStatusLabel,
} from "@/i18n/domain";
import { useI18n, useT } from "@/i18n/context";
import { formatCaughtError } from "@/i18n/core";
import { formatUsdcBaseUnits } from "@/lib/usdc";
import { MarketCover } from "@/components/MarketCover";

export interface LpShareRow {
  lpObjectId: string;
  shares: bigint;
  estimatedUsdc: bigint | null;
}

type Props = {
  poolId: string;
  market?: MarketRef;
  pool?: PoolView;
  poolFields?: Record<string, unknown>;
  rows: LpShareRow[];
  onRedeemSuccess?: () => void;
};

function isSettledPool(pool: PoolView | undefined): boolean {
  if (!pool) return false;
  return pool.resolved || pool.status === STATUS_SETTLED || pool.status === STATUS_VOIDED;
}

export function LpMarketGroup({
  poolId,
  market,
  pool,
  poolFields,
  rows,
  onRedeemSuccess,
}: Props) {
  const t = useT();
  const { locale } = useI18n();
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [msg, setMsg] = useState<string | null>(null);

  const nav = useMemo(
    () => (poolFields ? parsePoolNavFields(poolFields) : null),
    [poolFields],
  );

  const totalShares = useMemo(
    () => rows.reduce((sum, row) => sum + row.shares, 0n),
    [rows],
  );

  const totalEstimated = useMemo(
    () => rows.reduce((sum, row) => sum + (row.estimatedUsdc ?? 0n), 0n),
    [rows],
  );

  const redeemableRows = useMemo(
    () => rows.filter((row) => row.estimatedUsdc != null && row.estimatedUsdc > 0n),
    [rows],
  );

  const settled = isSettledPool(pool);
  const paramLines = pool ? localizedFormatPoolParameterLines(pool, t) : [];
  const redeemLabel = settled ? t("lp.redeemSettled") : t("lp.redeem");

  const redeemShares = (targets: LpShareRow[]) => {
    if (targets.length === 0) return;
    const tx = new Transaction();
    for (const row of targets) {
      appendWithdrawLiquidity(tx, poolId, row.lpObjectId);
    }
    signAndExecute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { transaction: tx as any },
      {
        onSuccess: (r) => {
          setMsg(
            targets.length > 1
              ? t("lp.redeemAllSuccess", {
                  count: targets.length,
                  digest: r.digest?.slice(0, 16) ?? "",
                })
              : t("common.txSuccess", { digest: r.digest?.slice(0, 18) ?? "" }),
          );
          onRedeemSuccess?.();
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
            <h2>{t("lp.unknownMarket")}</h2>
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
            {t("lp.shareCount", { count: rows.length })}
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
            <div>
              <h3>{t("lp.navSummary")}</h3>
              <ul className="pos-meta">
                <li>
                  {t("lp.totalShares")}: {formatUsdcBaseUnits(totalShares)}
                </li>
                <li>
                  {t("lp.estimatedRedeem", {
                    amount: formatUsdcBaseUnits(totalEstimated),
                  })}
                </li>
                {nav && (
                  <li>
                    {t("trade.vaultLabel", {
                      amount: formatUsdcBaseUnits(nav.vaultUsdc),
                    })}
                  </li>
                )}
              </ul>
            </div>
          </div>
          <div className="positions-market-panel-actions">
            {market && canDepositLp(pool) && (
              <Link href={`/markets/${market.id}`} className="secondary btn-link">
                {t("lp.depositLink")}
              </Link>
            )}
            {settled && (
              <Link
                href={`/oracle?pool=${encodeURIComponent(poolId)}`}
                className="secondary btn-link"
              >
                {t("positionsGroup.oracleLink")}
              </Link>
            )}
            {totalEstimated > 0n && (
              <span className="positions-claimable-chip">
                {t("lp.redeemable", { amount: formatUsdcAmount(totalEstimated) })}
              </span>
            )}
            {account && redeemableRows.length > 1 && (
              <button
                type="button"
                className="secondary"
                disabled={isPending}
                onClick={() => redeemShares(redeemableRows)}
              >
                {isPending
                  ? t("common.processing")
                  : t("lp.redeemAll", { count: redeemableRows.length })}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid">
        {rows.map((row) => {
          const canRedeem = row.estimatedUsdc != null && row.estimatedUsdc > 0n;
          return (
            <article key={row.lpObjectId} className="card">
              <span className="badge">LpShare</span>
              <p className="hint">
                {t("lp.shares", { amount: formatUsdcBaseUnits(row.shares) })}
              </p>
              {row.estimatedUsdc != null ? (
                <p className="hint">
                  {t("lp.estimatedRedeem", {
                    amount: formatUsdcBaseUnits(row.estimatedUsdc),
                  })}
                </p>
              ) : null}
              {!canRedeem && nav && (
                <p className="hint">{t("lp.cannotRedeem")}</p>
              )}
              <button
                type="button"
                className="secondary"
                disabled={!account || isPending || !canRedeem}
                onClick={() => redeemShares([row])}
              >
                {isPending ? t("common.processing") : redeemLabel}
              </button>
              <p className="mono hint">{row.lpObjectId}</p>
            </article>
          );
        })}
      </div>

      {msg && <p className="hint">{msg}</p>}
    </section>
  );
}
