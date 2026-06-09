"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchIndexerProphetGmv,
  indexerEnabled,
  type IndexerProphetGmvDay,
  type IndexerProphetGmvTotals,
} from "@/lib/indexer";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";

function formatUsdc(mist: string): string {
  return `${(Number(mist) / 1e6).toFixed(2)} USDC`;
}

export default function MetricsPage() {
  const [daily, setDaily] = useState<IndexerProphetGmvDay[]>([]);
  const [totals, setTotals] = useState<IndexerProphetGmvTotals | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!indexerEnabled()) return;
    setLoading(true);
    void fetchIndexerProphetGmv(30).then(({ daily: d, totals: t }) => {
      setDaily(d);
      setTotals(t);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Prophet 运营指标"
        subtitle={
          <>
            付费解锁 GMV 与审计量（Indexer <code>prophet_gmv_daily</code>，P4.4）。
          </>
        }
      />

      {!indexerEnabled() && (
        <div className="card">
          <p>
            请配置 <code>NEXT_PUBLIC_INDEXER_URL</code> 后查看 GMV 指标。
          </p>
        </div>
      )}

      {indexerEnabled() && (
        <div className="card">
          <h2>近 30 日汇总</h2>
          {loading ? (
            <p className="hint">加载中…</p>
          ) : totals ? (
            <dl className="meta">
              <dt>解锁 GMV</dt>
              <dd>{formatUsdc(totals.total_gmv)}</dd>
              <dt>解锁笔数</dt>
              <dd>{totals.total_unlocks}</dd>
              <dt>已审计预测</dt>
              <dd>{totals.total_audited}</dd>
            </dl>
          ) : (
            <p className="hint">暂无数据。</p>
          )}
        </div>
      )}

      {indexerEnabled() && daily.length > 0 && (
        <div className="card">
          <h2>日明细</h2>
          <DataTable>
            <thead>
              <tr>
                <th>日期</th>
                <th>解锁 GMV</th>
                <th>笔数</th>
                <th>审计</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((row) => (
                <tr key={row.day}>
                  <td>{row.day.slice(0, 10)}</td>
                  <td>{formatUsdc(row.unlock_gmv)}</td>
                  <td>{row.unlock_count}</td>
                  <td>{row.prophecies_audited}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}

      <div className="btn-row">
        <Link href="/prophet" className="card" style={{ padding: "0.75rem 1rem" }}>
          Prophet 主页
        </Link>
        <Link href="/leaderboard" className="card" style={{ padding: "0.75rem 1rem" }}>
          排行榜
        </Link>
      </div>
    </div>
  );
}
