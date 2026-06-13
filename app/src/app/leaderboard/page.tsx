"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import {
  MIN_AUDITED_FOR_PAID,
  MIN_SCORE_BPS_FOR_PAID,
  PROPHET_REGISTRY_ID,
  fetchLeaderboard,
  formatAccuracyPercent,
  formatScorePercent,
  formatUsdcBaseUnits,
  isPaidUnlockEligible,
  paidUnlockEligibilityHint,
  prophetProfilePath,
  shortAddress,
  type LeaderboardEntry,
} from "@/lib/prophet";
import {
  fetchIndexerLeaderboard,
  indexerEnabled,
  type IndexerProphetStats,
} from "@/lib/indexer";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";

export default function LeaderboardPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const load = async () => {
      if (indexerEnabled()) {
        const indexed = await fetchIndexerLeaderboard(50);
        if (indexed.length) {
          setRows(
            indexed.map((r: IndexerProphetStats) => ({
              prophet: r.prophet,
              wins: r.wins,
              losses: r.losses,
              cheats: r.cheats,
              currentStreak: r.current_streak,
              maxStreak: r.max_streak,
              totalAudited: r.total_audited,
              totalUnlockRevenue: BigInt(r.total_unlock_revenue),
              scoreBps: r.score_bps,
              rank: r.rank,
            })),
          );
          setLoading(false);
          return;
        }
      }
      if (!PROPHET_REGISTRY_ID) {
        setLoading(false);
        return;
      }
      const data = await fetchLeaderboard(client, PROPHET_REGISTRY_ID, 50);
      setRows(data);
      setLoading(false);
    };
    void load();
  }, [client]);

  const myRow = rows.find((r) => r.prophet === account?.address);

  return (
    <div>
      <PageHeader
        title="Prophet 排行榜"
        subtitle={
          <>
            优先读 Indexer 缓存排行；回退链上 <code>ProphetRegistry</code>{" "}
            动态字段（权威真相源仍在链上）。
          </>
        }
      />

      {!PROPHET_REGISTRY_ID && (
        <div className="card">
          <p>
            请配置 <code>NEXT_PUBLIC_PROPHET_REGISTRY_ID</code> 后查看排行榜。
          </p>
        </div>
      )}

      {account && (
        <div className="card">
          <h2>我的战绩</h2>
          {myRow ? (
            <>
              <dl className="meta">
                <dt>排名</dt>
                <dd>#{myRow.rank}</dd>
                <dt>胜 / 负</dt>
                <dd>
                  {myRow.wins} / {myRow.losses}
                </dd>
                <dt>胜率</dt>
                <dd>{formatAccuracyPercent(myRow)}</dd>
                <dt>Prophet Score</dt>
                <dd>{formatScorePercent(myRow.scoreBps)} / 100</dd>
                <dt>付费开通</dt>
                <dd>
                  {isPaidUnlockEligible(myRow) ? "已开通" : "未开通"}
                  {!isPaidUnlockEligible(myRow) && (
                    <span className="hint"> — {paidUnlockEligibilityHint(myRow)}</span>
                  )}
                </dd>
              </dl>
              <p style={{ marginTop: "0.75rem" }}>
                <Link href={prophetProfilePath(account.address)} className="hero-link">
                  查看我的主页 →
                </Link>
              </p>
            </>
          ) : (
            <p className="hint">
              尚无链上战绩。前往{" "}
              <Link href="/prophet">Prophet</Link> 发布免费练手预测（unlock_price =
              0）。
            </p>
          )}
        </div>
      )}

      <div className="card">
        <h2>全链排行</h2>
        <p className="hint">
          Score = 60% 胜率 + 20% 经验(log N) + 20% 收入 · 付费门槛：≥
          {MIN_AUDITED_FOR_PAID} 场审计且 Score ≥ {MIN_SCORE_BPS_FOR_PAID / 100} ·
          零作弊
        </p>
        {loading ? (
          <p className="hint">从链上事件 + 动态字段加载…</p>
        ) : rows.length === 0 ? (
          <p className="hint">暂无数据 — 完成首笔 audit_prophecy 后出现。</p>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>#</th>
                <th>预言家</th>
                <th>胜/负/作弊</th>
                <th>胜率</th>
                <th>连红</th>
                <th>Score</th>
                <th>收入</th>
                <th>付费</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.prophet}>
                  <td>{row.rank}</td>
                  <td>
                    <Link href={prophetProfilePath(row.prophet)}>
                      <code>{shortAddress(row.prophet)}</code>
                      {account?.address === row.prophet ? "（你）" : ""}
                    </Link>
                  </td>
                  <td>
                    {row.wins}/{row.losses}/{row.cheats}
                  </td>
                  <td>{formatAccuracyPercent(row)}</td>
                  <td>
                    {row.currentStreak} (max {row.maxStreak})
                  </td>
                  <td>{formatScorePercent(row.scoreBps)}</td>
                  <td>{formatUsdcBaseUnits(row.totalUnlockRevenue)}</td>
                  <td>{isPaidUnlockEligible(row) ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        <p className="hint" style={{ marginTop: "1rem" }}>
          生产环境可选部署 <strong>Indexer</strong> 缓存排行与订阅者 ROI，但链上{" "}
          <code>ProphetStats</code> 已是唯一真相源。
        </p>
      </div>

      <div className="btn-row">
        <Link href="/prophet" className="card" style={{ padding: "0.75rem 1rem" }}>
          发布 / 解锁预测 →
        </Link>
      </div>

    </div>
  );
}
