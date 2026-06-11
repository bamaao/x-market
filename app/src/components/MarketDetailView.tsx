"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuctionPanel } from "@/components/AuctionPanel";
import { IvPanel } from "@/components/IvPanel";
import { LpDepositPanel } from "@/components/LpDepositPanel";
import { TradePanel } from "@/components/TradePanel";
import { MarketCover } from "@/components/MarketCover";
import { resolveMarketById } from "@/lib/market-catalog";
import type { SeedMarket } from "@/lib/markets";

const KIND_LABELS: Record<string, string> = {
  poisson: "Poisson",
  dirichlet: "Dirichlet",
  normal: "Normal",
  beta: "Beta",
};

type Props = { id: string };

export function MarketDetailView({ id }: Props) {
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

  if (market === undefined) {
    return <p className="hint">加载市场中…</p>;
  }

  if (!market) {
    return (
      <div className="panel">
        <h1>市场不存在</h1>
        <p className="sub">未找到 ID 为 <code className="mono">{id}</code> 的市场。</p>
        <Link href="/" className="hero-link secondary">
          返回市场列表
        </Link>
      </div>
    );
  }

  return (
    <>
      <MarketCover
        id={market.id}
        imageUrl={market.imageUrl}
        title={market.title}
        kind={market.kind}
        variant="hero"
        priority
      />
      <div className="market-header">
        <span className={`badge badge-${market.kind}`}>
          {KIND_LABELS[market.kind] ?? market.kind}
        </span>
        <h1>{market.title}</h1>
        <p className="sub" style={{ marginBottom: 0 }}>
          {market.description}
        </p>
        {market.params.poolId ? (
          <p className="hint" style={{ marginTop: "0.75rem" }}>
            Pool ID:{" "}
            <code className="mono">{String(market.params.poolId)}</code>
          </p>
        ) : null}
      </div>
      <div className="market-panels">
        <TradePanel market={market} />
        <LpDepositPanel market={market} />
        <AuctionPanel market={market} />
        <IvPanel market={market} />
      </div>
    </>
  );
}
