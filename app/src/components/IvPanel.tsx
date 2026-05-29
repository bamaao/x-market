"use client";

import { useState } from "react";
import { useSuiClientQuery } from "@mysten/dapp-kit";
import { defaultPoolId } from "@/lib/markets";
import type { SeedMarket } from "@/lib/markets";

type Props = { market: SeedMarket };

export function IvPanel({ market }: Props) {
  const [poolId, setPoolId] = useState(() => defaultPoolId(market.id));
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
    </div>
  );
}
