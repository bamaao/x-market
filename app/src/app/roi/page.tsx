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

function formatUsdc(mist: string): string {
  const n = Number(mist) / 1e6;
  return `${n.toFixed(4)} USDC`;
}

function roiLabel(bps: number | null | undefined): string {
  if (bps == null) return "—";
  return `${(bps / 100).toFixed(2)}%`;
}

export default function RoiPage() {
  const account = useCurrentAccount();
  const [summary, setSummary] = useState<IndexerBuyerRoiSummary | null>(null);
  const [rows, setRows] = useState<IndexerBuyerRoi[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!account?.address || !indexerEnabled()) return;
    setLoading(true);
    void Promise.all([
      fetchIndexerBuyerRoiSummary(account.address),
      fetchIndexerBuyerRoi(account.address),
    ]).then(([s, r]) => {
      setSummary(s);
      setRows(r);
      setLoading(false);
    });
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
          <div className="card">
            <h2>汇总</h2>
            {loading ? (
              <p className="hint">加载中…</p>
            ) : summary ? (
              <dl className="meta">
                <dt>总解锁成本</dt>
                <dd>{formatUsdc(summary.total_unlock_cost)}</dd>
                <dt>跟单笔数</dt>
                <dd>{summary.total_positions}</dd>
                <dt>胜 / 负 / 作弊 / 待审计</dt>
                <dd>
                  {summary.wins} / {summary.losses} / {summary.cheats} / {summary.pending}
                </dd>
                <dt>平均 ROI</dt>
                <dd>{roiLabel(summary.aggregate_roi_bps)}</dd>
              </dl>
            ) : (
              <p className="hint">尚无跟单记录。前往 <Link href="/prophet">Prophet</Link> 解锁预测。</p>
            )}
          </div>

          <div className="card">
            <h2>明细</h2>
            {rows.length === 0 ? (
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
                  {rows.map((r) => (
                    <tr key={`${r.buyer}-${r.prophecy_id}`}>
                      <td>
                        <code>{r.prophecy_id.slice(0, 10)}…</code>
                      </td>
                      <td>
                        <code>{r.prophet.slice(0, 8)}…</code>
                      </td>
                      <td>{formatUsdc(r.unlock_cost)}</td>
                      <td>{r.outcome}</td>
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
