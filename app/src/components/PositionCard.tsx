"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID } from "@/lib/markets";
import {
  contractKindLabel,
  formatEntryProbability,
  formatOutcomeDescription,
  formatUsdcAmount,
  getSettlementDisplay,
  poolKindLabel,
  type MarketRef,
  type PoolView,
  type PositionView,
} from "@/lib/position-display";

type Props = {
  objectId: string;
  position: PositionView;
  market?: MarketRef;
  pool?: PoolView;
  showMarketHeader?: boolean;
  onClaimSuccess?: () => void;
};

export function PositionCard({
  objectId,
  position,
  market,
  pool,
  showMarketHeader = true,
  onClaimSuccess,
}: Props) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [msg, setMsg] = useState<string | null>(null);

  const poolId = position.marketId;
  const settlement = getSettlementDisplay(position, pool);
  const maxPayout = estimateDisplayMaxPayout(position, pool, settlement);
  const marketKind = market?.kind;
  const outcome = formatOutcomeDescription(position, marketKind, pool?.kind);
  const canClaim =
    account &&
    !position.claimed &&
    settlement.state === "hit" &&
    poolId.length > 0;

  const claim = () => {
    if (!poolId) {
      setMsg("缺少 MarketPool ID");
      return;
    }
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::settlement::claim_position`,
      arguments: [tx.object(poolId), tx.object(objectId)],
    });
    signAndExecute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { transaction: tx as any },
      {
        onSuccess: (r) => {
          setMsg(`已领取: ${r.digest?.slice(0, 16)}…`);
          onClaimSuccess?.();
        },
        onError: (e) => setMsg(e.message),
      },
    );
  };

  return (
    <article className="card position-card">
      {showMarketHeader && (
        <div className="position-card-head">
          <div>
            {market ? (
              <Link href={`/markets/${market.id}`} className="position-market-link">
                <h3>{market.title}</h3>
              </Link>
            ) : (
              <h3 className="position-market-unknown">未知市场</h3>
            )}
            <p className="hint position-market-desc">
              {market?.description ?? `Pool ${poolId.slice(0, 10)}…`}
            </p>
          </div>
          <div className="position-badges">
            <span className={`badge badge-${marketKind ?? "poisson"}`}>
              {pool ? poolKindLabel(pool.kind) : marketKind ?? "—"}
            </span>
            <span className="badge">{contractKindLabel(position.contractKind)}</span>
          </div>
        </div>
      )}

      {!showMarketHeader && (
        <div className="position-card-head position-card-head--compact">
          <span className="badge">{contractKindLabel(position.contractKind)}</span>
          <span className="hint">{outcome}</span>
        </div>
      )}

      <dl className="position-facts">
        {showMarketHeader && (
          <div className="position-facts-full">
            <dt>预测方向</dt>
            <dd>{outcome}</dd>
          </div>
        )}
        <div>
          <dt>成本</dt>
          <dd>{formatUsdcAmount(position.stakeUsdc)}</dd>
        </div>
        <div>
          <dt>买入概率</dt>
          <dd>{formatEntryProbability(position.entryProbPpb)}</dd>
        </div>
        <div>
          <dt>{pool?.resolved ? "兑付" : "潜在兑付"}</dt>
          <dd>{maxPayout}</dd>
        </div>
      </dl>

      <div className={`position-settlement position-settlement--${settlement.state}`}>
        <span className="position-settlement-label">{settlement.label}</span>
        {settlement.state === "hit" && settlement.payoutUsdc != null && (
          <span className="position-settlement-payout">
            {formatUsdcAmount(settlement.payoutUsdc)}
          </span>
        )}
      </div>

      {canClaim && (
        <button
          type="button"
          className="secondary"
          disabled={isPending}
          onClick={claim}
        >
          {isPending ? "领取中…" : "领取赔付"}
        </button>
      )}

      {settlement.state === "miss" && !position.claimed && (
        <p className="hint">结算结果未覆盖本头寸区间，无需 claim。</p>
      )}

      <p className="mono position-object-id">{objectId}</p>
      {msg && <p className="hint">{msg}</p>}
    </article>
  );
}

function estimateDisplayMaxPayout(
  position: PositionView,
  pool: PoolView | undefined,
  settlement: ReturnType<typeof getSettlementDisplay>,
): string {
  if (settlement.state === "hit" && settlement.payoutUsdc != null) {
    return formatUsdcAmount(settlement.payoutUsdc);
  }
  if (settlement.state === "miss") {
    return "0 USDC";
  }
  if (position.contractKind >= 2) {
    return "衍生品 · 依结算值";
  }
  if (position.entryProbPpb <= 0n) return "—";
  const est = (position.stakeUsdc * 1_000_000_000n) / position.entryProbPpb;
  return `≈ ${formatUsdcAmount(est)}`;
}
