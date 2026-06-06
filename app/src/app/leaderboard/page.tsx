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
  type LeaderboardEntry,
} from "@/lib/prophet";

export default function LeaderboardPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!PROPHET_REGISTRY_ID) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchLeaderboard(client, PROPHET_REGISTRY_ID, 50).then((data) => {
      setRows(data);
      setLoading(false);
    });
  }, [client]);

  const myRow = rows.find((r) => r.prophet === account?.address);

  return (
    <div>
      <h1>Prophet 排行榜</h1>
      <p className="sub">
        数据直接来自链上 <code>ProphetRegistry</code> 动态字段；无需本地统计服务即可展示权威战绩。
      </p>

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
          <table
            style={{
              width: "100%",
              fontSize: "0.85rem",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                <th style={{ padding: "0.35rem 0" }}>#</th>
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
                <tr
                  key={row.prophet}
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "0.5rem 0" }}>{row.rank}</td>
                  <td>
                    <code>
                      {row.prophet.slice(0, 10)}…
                      {account?.address === row.prophet ? "（你）" : ""}
                    </code>
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
          </table>
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
