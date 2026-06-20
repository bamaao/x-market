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
import { useSuiClientQuery } from "@mysten/dapp-kit";
import { AuctionPanel } from "@/components/AuctionPanel";
import { CommentPanel } from "@/components/CommentPanel";
import { IvPanel } from "@/components/IvPanel";
import { LpDepositPanel } from "@/components/LpDepositPanel";
import { TradePanel } from "@/components/TradePanel";
import { MarketCover } from "@/components/MarketCover";
import { MarketTagList } from "@/components/MarketTagList";
import { localizedPoolStatusLabel } from "@/i18n/domain";
import { resolveMarketById } from "@/lib/market-catalog";
import { defaultPoolId, type SeedMarket } from "@/lib/markets";
import {
  canAuctionBid,
  canDepositLp,
  canTrade,
  parseMoveObjectFields,
  parsePoolView,
  poolNeedsLiquidity,
  STATUS_SETTLED,
  type PoolView,
} from "@/lib/position-display";
import { formatUsdcBaseUnits } from "@/lib/usdc";
import { useI18n, useT } from "@/i18n/context";
import { localizeSeedMarket } from "@/i18n/markets";

const KIND_LABELS: Record<string, string> = {
  poisson: "Poisson",
  dirichlet: "Dirichlet",
  normal: "Normal",
  beta: "Beta",
};

type Props = { id: string };

function isPoolSettled(pool: PoolView | undefined): boolean {
  if (!pool) return false;
  return pool.resolved || pool.status === STATUS_SETTLED;
}

export function MarketDetailView({ id }: Props) {
  const t = useT();
  const { locale } = useI18n();
  const [market, setMarket] = useState<SeedMarket | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void resolveMarketById(id).then((m) => {
      if (!cancelled) setMarket(m);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const displayMarket = useMemo(
    () => (market ? localizeSeedMarket(market, locale, t) : null),
    [market, locale, t],
  );

  const poolId =
    typeof displayMarket?.params.poolId === "string" && displayMarket.params.poolId
      ? displayMarket.params.poolId
      : displayMarket
        ? defaultPoolId(displayMarket)
        : "";

  const { data: poolObj, isPending: poolLoading } = useSuiClientQuery(
    "getObject",
    {
      id: poolId,
      options: { showContent: true },
    },
    { enabled: Boolean(poolId) },
  );

  const pool = useMemo(() => {
    if (!poolId || poolObj?.error) return undefined;
    const fields = parseMoveObjectFields(poolObj?.data?.content);
    return parsePoolView(poolId, fields) ?? undefined;
  }, [poolId, poolObj]);

  const showAuction = canAuctionBid(pool, displayMarket?.kind);
  const showTrade = canTrade(pool);
  const showLp = canDepositLp(pool);
  const showIv = showTrade || isPoolSettled(pool);
  const settled = isPoolSettled(pool);
  const vaultEmpty = poolNeedsLiquidity(pool);

  const lifecycleHint = (() => {
    if (!poolId) return t("markets.lifecycleHint.noPool");
    if (poolLoading) return t("markets.poolStatusLoading");
    if (!pool) return null;
    if (settled) return t("markets.lifecycleHint.settled");
    if (vaultEmpty) return t("markets.lifecycleHint.emptyVault");
    if (showAuction) return t("markets.lifecycleHint.auctionUseAuction");
    if (showTrade) return t("markets.lifecycleHint.tradingUseTrade");
    return null;
  })();

  if (market === undefined) {
    return <p className="hint">{t("markets.loading")}</p>;
  }

  if (!market || !displayMarket) {
    return (
      <div className="panel">
        <h1>{t("markets.notFound")}</h1>
        <p className="sub">
          {t("markets.notFoundSub", { id })}
        </p>
        <Link href="/" className="hero-link secondary">
          {t("common.backToMarkets")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <MarketCover
        id={displayMarket.id}
        imageUrl={displayMarket.imageUrl}
        title={displayMarket.title}
        kind={displayMarket.kind}
        variant="hero"
        priority
      />
      <div className="market-header">
        <span className={`badge badge-${displayMarket.kind}`}>
          {KIND_LABELS[displayMarket.kind] ?? displayMarket.kind}
        </span>
        {pool ? (
          <span className="badge badge-status">
            {localizedPoolStatusLabel(pool, t)}
          </span>
        ) : null}
        <MarketTagList tags={displayMarket.tags} className="market-header-tags" />
        <h1>{displayMarket.title}</h1>
        <p className="sub" style={{ marginBottom: 0 }}>
          {displayMarket.description}
        </p>
        {poolId ? (
          <p className="hint" style={{ marginTop: "0.75rem" }}>
            Pool ID:{" "}
            <code className="mono">{poolId}</code>
            {pool ? (
              <>
                {" · "}
                {t("trade.vaultLabel", {
                  amount: formatUsdcBaseUnits(pool.collateralUsdc),
                })}
              </>
            ) : null}
          </p>
        ) : null}
        {lifecycleHint ? (
          <p className="hint" style={{ marginTop: "0.5rem" }}>
            {lifecycleHint}
          </p>
        ) : null}
      </div>
      <div className="market-panels">
        {showLp ? <LpDepositPanel market={displayMarket} pool={pool} /> : null}
        {showTrade ? <TradePanel market={displayMarket} pool={pool} /> : null}
        {showAuction ? <AuctionPanel market={displayMarket} /> : null}
        {showIv ? <IvPanel market={displayMarket} /> : null}
        <CommentPanel market={displayMarket} />
      </div>
    </>
  );
}
