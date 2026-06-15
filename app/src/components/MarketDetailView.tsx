"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuctionPanel } from "@/components/AuctionPanel";
import { CommentPanel } from "@/components/CommentPanel";
import { IvPanel } from "@/components/IvPanel";
import { LpDepositPanel } from "@/components/LpDepositPanel";
import { TradePanel } from "@/components/TradePanel";
import { MarketCover } from "@/components/MarketCover";
import { MarketTagList } from "@/components/MarketTagList";
import { resolveMarketById } from "@/lib/market-catalog";
import type { SeedMarket } from "@/lib/markets";
import { useI18n, useT } from "@/i18n/context";
import { localizeSeedMarket } from "@/i18n/markets";

const KIND_LABELS: Record<string, string> = {
  poisson: "Poisson",
  dirichlet: "Dirichlet",
  normal: "Normal",
  beta: "Beta",
};

type Props = { id: string };

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
        <MarketTagList tags={displayMarket.tags} className="market-header-tags" />
        <h1>{displayMarket.title}</h1>
        <p className="sub" style={{ marginBottom: 0 }}>
          {displayMarket.description}
        </p>
        {displayMarket.params.poolId ? (
          <p className="hint" style={{ marginTop: "0.75rem" }}>
            Pool ID:{" "}
            <code className="mono">{String(displayMarket.params.poolId)}</code>
          </p>
        ) : null}
      </div>
      <div className="market-panels">
        <TradePanel market={displayMarket} />
        <LpDepositPanel market={displayMarket} />
        <AuctionPanel market={displayMarket} />
        <IvPanel market={displayMarket} />
        <CommentPanel market={displayMarket} />
      </div>
    </>
  );
}
