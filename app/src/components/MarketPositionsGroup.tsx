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
  formatPoolParameterLines,
  formatResolvedValue,
  formatTimeToMaturity,
  formatUnixTs,
  formatUsdcAmount,
  poolKindLabel,
  poolStatusLabel,
  summarizeMarketGroup,
  type MarketGroupSummary,
  type MarketRef,
  type PoolView,
  type PositionRow,
} from "@/lib/position-display";
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
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [msg, setMsg] = useState<string | null>(null);
  const [ivLatest, setIvLatest] = useState<IndexerIvPoint | null>(null);

  const groupSummary: MarketGroupSummary = useMemo(
    () => summarizeMarketGroup(poolId, rows, pool),
    [poolId, rows, pool],
  );

  const toClaim = useMemo(() => claimableRows(rows, pool), [rows, pool]);
  const paramLines = pool ? formatPoolParameterLines(pool) : [];

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
            `已批量领取 ${toClaim.length} 笔: ${r.digest?.slice(0, 16)}…`,
          );
          onClaimSuccess?.();
        },
        onError: (e) => setMsg(e.message),
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
            <h2>未知市场</h2>
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
          <span className="badge">{groupSummary.positionCount} 笔持仓</span>
        </div>
      </header>

      {pool && (
        <div className="positions-market-panel card">
          <div className="positions-market-panel-grid">
            <div>
              <h3>市场快照</h3>
              <ul className="pos-meta">
                <li>状态: {poolStatusLabel(pool)}</li>
                <li>到期: {formatUnixTs(pool.maturityTs)}</li>
                <li>{formatTimeToMaturity(pool)}</li>
                {pool.resolved && (
                  <li>
                    结算值: {formatResolvedValue(pool, market?.kind)}
                  </li>
                )}
              </ul>
            </div>
            <div>
              <h3>当前参数</h3>
              <ul className="pos-meta">
                {paramLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            {ivLatest && (
              <div>
                <h3>IV（Indexer）</h3>
                <ul className="pos-meta">
                  <li>IV σ tenths: {ivLatest.iv_tenths}</li>
                  <li>τ: {((ivLatest.tau_bps ?? 0) / 100).toFixed(1)}%</li>
                  <li>Vol Crush: {ivLatest.vol_crush_bps} bps</li>
                </ul>
              </div>
            )}
          </div>
          <div className="positions-market-panel-actions">
            {market && (
              <Link href={`/markets/${market.id}`} className="secondary btn-link">
                去交易 →
              </Link>
            )}
            <Link href="/oracle" className="secondary btn-link">
              Oracle 结算 →
            </Link>
            {groupSummary.claimableCount > 0 && (
              <span className="positions-claimable-chip">
                可领 {formatUsdcAmount(groupSummary.claimableUsdc)}
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
                  ? "领取中…"
                  : `批量领取 (${toClaim.length})`}
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
