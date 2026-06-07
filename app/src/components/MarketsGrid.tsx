"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SEED_MARKETS, type SeedMarket } from "@/lib/markets";
import { fetchIndexerMarkets, indexerEnabled, type IndexerMarket } from "@/lib/indexer";

function indexerToSeed(m: IndexerMarket): SeedMarket {
  const slug = m.slug ?? m.pool_id;
  return {
    id: slug,
    title: m.title,
    description: m.description,
    kind: m.kind as SeedMarket["kind"],
    params: {
      poolId: m.pool_id,
      fee_bps: m.fee_bps,
      ...(m.lambda_tenths != null ? { lambda_tenths: m.lambda_tenths } : {}),
      ...(m.mu_tenths != null ? { mu_tenths: m.mu_tenths } : {}),
      ...(m.sigma_tenths != null ? { sigma_tenths: m.sigma_tenths } : {}),
    },
  };
}

export function MarketsGrid() {
  const [markets, setMarkets] = useState<SeedMarket[]>(SEED_MARKETS);
  const [source, setSource] = useState<"env" | "indexer">("env");

  useEffect(() => {
    if (!indexerEnabled()) return;
    void fetchIndexerMarkets().then((rows) => {
      if (rows.length) {
        setMarkets(rows.map(indexerToSeed));
        setSource("indexer");
      }
    });
  }, []);

  return (
    <>
      {indexerEnabled() && (
        <p className="hint">
          市场列表来源：{source === "indexer" ? "Indexer API" : "环境变量（Indexer 回退）"}
        </p>
      )}
      <div className="grid">
        {markets.map((m) => (
          <article key={m.id} className="card">
            <span className="badge">{m.kind}</span>
            <h2>{m.title}</h2>
            <p>{m.description}</p>
            {m.params.poolId ? (
              <p className="hint" style={{ fontSize: "0.75rem" }}>
                Pool: {String(m.params.poolId).slice(0, 10)}…
              </p>
            ) : null}
            <Link href={`/markets/${m.id}`}>交易 →</Link>
          </article>
        ))}
      </div>
    </>
  );
}
