"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  fetchIndexerBuyerRoi,
  fetchIndexerBuyerRoiSummary,
  indexerEnabled,
  type IndexerBuyerRoi,
  type IndexerBuyerRoiSummary,
} from "@/lib/indexer";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";

function formatUsdc(mist: string | number | null | undefined): string {
  if (mist == null || mist === "") return "—";
  const n = Number(mist) / 1e6;
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(4)} USDC`;
}

function roiLabel(bps: number | string | null | undefined): string {
  if (bps == null || bps === "") return "—";
  const n = Number(bps);
  if (!Number.isFinite(n)) return "—";
  return `${(n / 100).toFixed(2)}%`;
}

function shortId(value: string | null | undefined, len = 10): string {
  if (!value) return "—";
  return value.length > len ? `${value.slice(0, len)}…` : value;
}

export default function RoiPage() {
  const account = useCurrentAccount();
  const [summary, setSummary] = useState<IndexerBuyerRoiSummary | null>(null);
  const [rows, setRows] = useState<IndexerBuyerRoi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account?.address || !indexerEnabled()) {
      setSummary(null);
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      fetchIndexerBuyerRoiSummary(account.address),
      fetchIndexerBuyerRoi(account.address),
    ])
      .then(([s, r]) => {
        if (cancelled) return;
        setSummary(s);
        setRows(r);
      })
      .catch((e) => {
        if (cancelled) return;
        setSummary(null);
        setRows([]);
        setError(e instanceof Error ? e.message : "加载跟单数据失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account?.address]);

  return (
    <div>
      <PageHeader
        title="跟单 ROI"
        subtitle={
          <>
            订阅者解锁 Prophet 预测后的收益聚合（Indexer <code>buyer_roi</code>）。
          </>
        }
      />

      {!indexerEnabled() && (
        <div className="card">
          <p>
            请配置 <code>NEXT_PUBLIC_INDEXER_URL</code> 后查看跟单收益。
          </p>
        </div>
      )}

      {!account && indexerEnabled() && (
        <div className="card">
          <p>连接钱包以查看您的跟单记录。</p>
        </div>
      )}

      {account && indexerEnabled() && (
        <>
          {error && (
            <div className="card">
              <p className="hint oracle-pool-error">{error}</p>
              <p className="hint">
                请确认 Indexer 已启动且已执行迁移（含 <code>buyer_roi_summary</code> 表）。
              </p>
            </div>
          )}

          <div className="card">
            <h2>汇总</h2>
            {loading ? (
              <p className="hint">加载中…</p>
            ) : summary ? (
              <dl className="meta">
                <dt>总解锁成本</dt>
                <dd>{formatUsdc(summary.total_unlock_cost)}</dd>
                <dt>跟单笔数</dt>
                <dd>{summary.total_positions ?? 0}</dd>
                <dt>胜 / 负 / 作弊 / 待审计</dt>
                <dd>
                  {summary.wins ?? 0} / {summary.losses ?? 0} / {summary.cheats ?? 0} /{" "}
                  {summary.pending ?? 0}
                </dd>
                <dt>平均 ROI</dt>
                <dd>{roiLabel(summary.aggregate_roi_bps)}</dd>
              </dl>
            ) : (
              <p className="hint">
                尚无跟单记录。前往 <Link href="/prophet">Prophet</Link> 解锁预测。
              </p>
            )}
          </div>

          <div className="card">
            <h2>明细</h2>
            {loading ? (
              <p className="hint">加载中…</p>
            ) : rows.length === 0 ? (
              <p className="hint">无明细</p>
            ) : (
              <DataTable>
                <thead>
                  <tr>
                    <th>预言</th>
                    <th>预言家</th>
                    <th>成本</th>
                    <th>结果</th>
                    <th>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.prophecy_id ? `${r.buyer}-${r.prophecy_id}` : `row-${i}`}>
                      <td>
                        <code>{shortId(r.prophecy_id)}</code>
                      </td>
                      <td>
                        <code>{shortId(r.prophet, 8)}</code>
                      </td>
                      <td>{formatUsdc(r.unlock_cost)}</td>
                      <td>{r.outcome || "—"}</td>
                      <td>{roiLabel(r.roi_bps)}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </div>
        </>
      )}
    </div>
  );
}
