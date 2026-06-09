import { notFound } from "next/navigation";
import { AuctionPanel } from "@/components/AuctionPanel";
import { IvPanel } from "@/components/IvPanel";
import { LpDepositPanel } from "@/components/LpDepositPanel";
import { TradePanel } from "@/components/TradePanel";
import { SEED_MARKETS } from "@/lib/markets";

const KIND_LABELS: Record<string, string> = {
  poisson: "Poisson",
  dirichlet: "Dirichlet",
  normal: "Normal",
  beta: "Beta",
};

export default async function MarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const market = SEED_MARKETS.find((m) => m.id === id);
  if (!market) notFound();

  return (
    <>
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
