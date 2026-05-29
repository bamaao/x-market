import { notFound } from "next/navigation";
import { AuctionPanel } from "@/components/AuctionPanel";
import { IvPanel } from "@/components/IvPanel";
import { LpDepositPanel } from "@/components/LpDepositPanel";
import { TradePanel } from "@/components/TradePanel";
import { SEED_MARKETS } from "@/lib/markets";

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
      <h1>{market.title}</h1>
      <p className="sub">{market.description}</p>
      <div className="market-panels">
        <TradePanel market={market} />
        <LpDepositPanel market={market} />
        <AuctionPanel market={market} />
        <IvPanel market={market} />
      </div>
    </>
  );
}
