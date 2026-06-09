"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SEED_MARKETS, type MarketKind, type SeedMarket } from "@/lib/markets";
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

const KIND_LABELS: Record<MarketKind, string> = {
  poisson: "Poisson",
  dirichlet: "Dirichlet",
  normal: "Normal",
  beta: "Beta",
};

function kindBadgeClass(kind: MarketKind): string {
  return `badge badge-${kind}`;
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
      <div className="stats-row">
        <div className="stat-card">
          <div className="label">市场数量</div>
          <div className="value accent">{markets.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">分布类型</div>
          <div className="value">4</div>
        </div>
        {indexerEnabled() && (
          <div className="stat-card">
            <div className="label">数据源</div>
            <div className="value" style={{ fontSize: "0.95rem" }}>
              {source === "indexer" ? "Indexer" : "Env"}
            </div>
          </div>
        )}
      </div>

      {indexerEnabled() && (
        <p style={{ marginBottom: "1rem" }}>
          <span className="source-badge">
            <span className={`dot${source === "indexer" ? "" : " offline"}`} />
            {source === "indexer" ? "Indexer API 实时同步" : "环境变量种子市场（Indexer 回退）"}
          </span>
        </p>
      )}

      <div className="grid grid-markets">
        {markets.map((m) => (
          <Link
            key={m.id}
            href={`/markets/${m.id}`}
            className="card card-interactive"
            style={{ display: "flex", flexDirection: "column", textDecoration: "none" }}
          >
            <span className={kindBadgeClass(m.kind)}>{KIND_LABELS[m.kind]}</span>
            <h2 style={{ color: "var(--text)" }}>{m.title}</h2>
            <p>{m.description}</p>
            <div className="card-footer">
              {m.params.poolId ? (
                <span className="hint" style={{ margin: 0, fontSize: "0.72rem" }}>
                  Pool {String(m.params.poolId).slice(0, 8)}…
                </span>
              ) : (
                <span />
              )}
              <span className="card-cta">交易 →</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
