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
import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID } from "@/lib/markets";
import {
  formatEntryProbability,
  formatUsdcAmount,
  poolKindLabel,
  type MarketRef,
  type PoolView,
  type PositionView,
} from "@/lib/position-display";
import { appendClaimPositionRefund } from "@/lib/emergency-cancel";
import {
  localizedContractKind,
  localizedFormatOutcomeDescription,
  localizedSettlementDisplay,
} from "@/i18n/domain";
import { useT } from "@/i18n/context";
import { formatCaughtError } from "@/i18n/core";

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
  const t = useT();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [msg, setMsg] = useState<string | null>(null);

  const poolId = position.marketId;
  const settlement = localizedSettlementDisplay(position, pool, t);
  const maxPayout = estimateDisplayMaxPayout(position, pool, settlement, t);
  const marketKind = market?.kind;
  const outcome = localizedFormatOutcomeDescription(position, marketKind, pool?.kind, t);
  const canClaim =
    account &&
    !position.claimed &&
    settlement.state === "hit" &&
    poolId.length > 0;
  const canRefund =
    account &&
    !position.claimed &&
    settlement.state === "refundable" &&
    poolId.length > 0;

  const claim = () => {
    if (!poolId) {
      setMsg(t("positions.missingPoolId"));
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
          setMsg(t("positions.claimSuccess", { digest: r.digest?.slice(0, 16) ?? "" }));
          onClaimSuccess?.();
        },
        onError: (e) => setMsg(formatCaughtError(e, t)),
      },
    );
  };

  const refund = () => {
    if (!poolId) {
      setMsg(t("positions.missingPoolId"));
      return;
    }
    const tx = new Transaction();
    appendClaimPositionRefund(tx, poolId, objectId);
    signAndExecute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { transaction: tx as any },
      {
        onSuccess: (r) => {
          setMsg(t("positions.refundSuccess", { digest: r.digest?.slice(0, 16) ?? "" }));
          onClaimSuccess?.();
        },
        onError: (e) => setMsg(formatCaughtError(e, t)),
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
              <h3 className="position-market-unknown">{t("positions.unknownMarket")}</h3>
            )}
            <p className="hint position-market-desc">
              {market?.description ?? `Pool ${poolId.slice(0, 10)}…`}
            </p>
          </div>
          <div className="position-badges">
            <span className={`badge badge-${marketKind ?? "poisson"}`}>
              {pool ? poolKindLabel(pool.kind) : marketKind ?? t("common.dash")}
            </span>
            <span className="badge">{localizedContractKind(position.contractKind, t)}</span>
          </div>
        </div>
      )}

      {!showMarketHeader && (
        <div className="position-card-head position-card-head--compact">
          <span className="badge">{localizedContractKind(position.contractKind, t)}</span>
          <span className="hint">{outcome}</span>
        </div>
      )}

      <dl className="position-facts">
        {showMarketHeader && (
          <div className="position-facts-full">
            <dt>{t("positions.direction")}</dt>
            <dd>{outcome}</dd>
          </div>
        )}
        <div>
          <dt>{t("positions.cost")}</dt>
          <dd>{formatUsdcAmount(position.stakeUsdc)}</dd>
        </div>
        <div>
          <dt>{t("positions.entryProb")}</dt>
          <dd>{formatEntryProbability(position.entryProbPpb)}</dd>
        </div>
        <div>
          <dt>{pool?.resolved ? t("positions.payout") : t("positions.potentialPayout")}</dt>
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
        {settlement.state === "refundable" && (
          <span className="position-settlement-payout">
            {formatUsdcAmount(settlement.refundUsdc)}
          </span>
        )}
      </div>

      {canRefund && (
        <button
          type="button"
          className="secondary"
          disabled={isPending}
          onClick={refund}
        >
          {isPending ? t("positions.refunding") : t("positions.refund")}
        </button>
      )}

      {canClaim && (
        <button
          type="button"
          className="secondary"
          disabled={isPending}
          onClick={claim}
        >
          {isPending ? t("positions.claiming") : t("positions.claim")}
        </button>
      )}

      {settlement.state === "miss" && !position.claimed && (
        <p className="hint">{t("positions.missHint")}</p>
      )}

      <p className="mono position-object-id">{objectId}</p>
      {msg && <p className="hint">{msg}</p>}
    </article>
  );
}

function estimateDisplayMaxPayout(
  position: PositionView,
  pool: PoolView | undefined,
  settlement: ReturnType<typeof localizedSettlementDisplay>,
  t: ReturnType<typeof useT>,
): string {
  if (settlement.state === "hit" && settlement.payoutUsdc != null) {
    return formatUsdcAmount(settlement.payoutUsdc);
  }
  if (settlement.state === "miss") {
    return "0 USDC";
  }
  if (position.contractKind >= 2) {
    return t("positions.derivativePayout");
  }
  if (position.entryProbPpb <= 0n) return t("common.dash");
  const est = (position.stakeUsdc * 1_000_000_000n) / position.entryProbPpb;
  return `≈ ${formatUsdcAmount(est)}`;
}
