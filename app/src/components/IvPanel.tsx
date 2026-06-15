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

import { useEffect, useState } from "react";
import { useSuiClientQuery } from "@mysten/dapp-kit";
import { defaultPoolId } from "@/lib/markets";
import type { SeedMarket } from "@/lib/markets";
import {
  fetchIndexerIvHistory,
  indexerEnabled,
  type IndexerIvPoint,
} from "@/lib/indexer";
import { useT } from "@/i18n/context";

type Props = { market: SeedMarket };

export function IvPanel({ market }: Props) {
  const t = useT();
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
      <h2>{t("iv.title")}</h2>
      <label>{t("iv.poolId")}</label>
      <input value={poolId} onChange={(e) => setPoolId(e.target.value)} />
      <button type="button" className="secondary" onClick={() => refetch()}>
        {t("common.refresh")}
      </button>
      {isPending && <p className="hint">{t("common.loading")}</p>}
      {!isPending && fields && (
        <ul className="pos-meta">
          <li>{t("iv.sigmaBase")}: {sigmaBase}</li>
          <li>{t("iv.sigmaVirtual")}: +{sigmaVirtual}</li>
          <li>{t("iv.sigmaEffective")}: {sigmaBase + sigmaVirtual}</li>
          <li>{t("iv.feeBase")}: {feeBase} bps</li>
          <li>{t("iv.feeMult")}: +{feeMult} bps</li>
          <li>{t("iv.feeEffective")}: {feeEff} bps</li>
        </ul>
      )}
      {indexerEnabled() && ivHistory.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h3 style={{ fontSize: "0.9rem" }}>{t("iv.volCrushTitle")}</h3>
          <p className="hint">{t("iv.volCrushHint", { count: ivHistory.length })}</p>
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
            <li>{t("iv.latestIv")}: {ivHistory[0]?.iv_tenths ?? t("common.dash")}</li>
            <li>{t("iv.latestTau")}: {((ivHistory[0]?.tau_bps ?? 0) / 100).toFixed(1)}%</li>
            <li>{t("iv.latestVolCrush")}: {ivHistory[0]?.vol_crush_bps ?? t("common.dash")} bps</li>
          </ul>
        </div>
      )}
    </div>
  );
}
