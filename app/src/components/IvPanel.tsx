"use client";

import { useEffect, useState } from "react";
import { useSuiClientQuery } from "@mysten/dapp-kit";
import { defaultPoolId } from "@/lib/markets";
import type { SeedMarket } from "@/lib/markets";
import {
  fetchIndexerIvHistory,
  indexerEnabled,
  type IndexerIvPoint,
} from "@/lib/indexer";

type Props = { market: SeedMarket };

export function IvPanel({ market }: Props) {
  const [poolId, setPoolId] = useState(() => defaultPoolId(market));
  const { data, isPending, refetch } = useSuiClientQuery(
    "getObject",
    {
      id: poolId || "0x0",
      options: { showContent: true },
    },
    { enabled: !!poolId },
  );

  const fields =
    data?.data?.content &&
    typeof data.data.content === "object" &&
    "fields" in data.data.content
      ? (data.data.content.fields as Record<string, unknown>)
      : undefined;

  const sigmaBase = Number(fields?.sigma_tenths ?? fields?.sigma_units ?? 0);
  const sigmaVirtual = Number(fields?.sigma_virtual_tenths ?? 0);
  const feeBase = Number(fields?.fee_bps ?? 0);
  const feeMult = Number(fields?.fee_multiplier_bps ?? 0);
  const feeEff = Math.floor((feeBase * (10_000 + feeMult)) / 10_000);
  const [ivHistory, setIvHistory] = useState<IndexerIvPoint[]>([]);

  useEffect(() => {
    if (!indexerEnabled() || !poolId) return;
    void fetchIndexerIvHistory(poolId, 48).then(setIvHistory);
  }, [poolId]);

  return (
    <div className="card panel">
      <h2>IV / LP Guard 面板（Phase 2）</h2>
      <label>Pool ID</label>
      <input value={poolId} onChange={(e) => setPoolId(e.target.value)} />
      <button type="button" className="secondary" onClick={() => refetch()}>
        刷新
      </button>
      {isPending && <p className="hint">加载中…</p>}
      {!isPending && fields && (
        <ul className="pos-meta">
          <li>基础 sigma: {sigmaBase}</li>
          <li>虚拟 sigma: +{sigmaVirtual}</li>
          <li>有效 sigma: {sigmaBase + sigmaVirtual}</li>
          <li>基础费率: {feeBase} bps</li>
          <li>费率乘数: +{feeMult} bps</li>
          <li>有效费率: {feeEff} bps</li>
        </ul>
      )}
      {indexerEnabled() && ivHistory.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h3 style={{ fontSize: "0.9rem" }}>Vol Crush 曲线（Indexer）</h3>
          <p className="hint">τ→0 时 vol_crush_bps 收敛；最近 {ivHistory.length} 个采样点</p>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 2,
              height: 80,
              marginTop: 8,
            }}
          >
            {[...ivHistory].reverse().map((p) => {
              const h = Math.max(4, Math.min(76, Math.round(p.vol_crush_bps / 200)));
              return (
                <div
                  key={`${p.snapshot_ts}-${p.vol_crush_bps}`}
                  title={`τ=${(p.tau_bps / 100).toFixed(1)}% crush=${p.vol_crush_bps}`}
                  style={{
                    flex: 1,
                    height: h,
                    background: "var(--accent, #3b82f6)",
                    opacity: 0.35 + (p.tau_bps / 10_000) * 0.65,
                    borderRadius: 2,
                  }}
                />
              );
            })}
          </div>
          <ul className="pos-meta" style={{ marginTop: 8 }}>
            <li>最新 IV tenths: {ivHistory[0]?.iv_tenths ?? "—"}</li>
            <li>最新 τ: {((ivHistory[0]?.tau_bps ?? 0) / 100).toFixed(1)}%</li>
            <li>最新 Vol Crush: {ivHistory[0]?.vol_crush_bps ?? "—"} bps</li>
          </ul>
        </div>
      )}
    </div>
  );
}
