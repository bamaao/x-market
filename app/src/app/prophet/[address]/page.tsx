"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import {
  MIN_AUDITED_FOR_PAID,
  MIN_SCORE_BPS_FOR_PAID,
  PROPHET_REGISTRY_ID,
  discoverPropheciesByProphet,
  fetchProphetStats,
  fetchProphecy,
  formatAccuracyPercent,
  formatScorePercent,
  formatUsdcBaseUnits,
  isPaidUnlockEligible,
  isPublicProphecy,
  isValidSuiAddress,
  normalizeSuiAddress,
  paidUnlockEligibilityHint,
  prophecyStatusLabel,
  shortAddress,
  type LeaderboardEntry,
  type ProphecyView,
} from "@/lib/prophet";
import {
  fetchIndexerProphetHistory,
  fetchIndexerProphetStats,
  fetchIndexerProphecies,
  indexerEnabled,
  type IndexerProphetStatsHistoryPoint,
  type IndexerProphecyRow,
} from "@/lib/indexer";
import { DataTable } from "@/components/DataTable";
import { FollowButton } from "@/components/FollowButton";
import { PageHeader } from "@/components/PageHeader";

function indexerStatsToEntry(
  stats: NonNullable<Awaited<ReturnType<typeof fetchIndexerProphetStats>>>,
): LeaderboardEntry {
  return {
    prophet: stats.prophet,
    wins: stats.wins,
    losses: stats.losses,
    cheats: stats.cheats,
    currentStreak: stats.current_streak,
    maxStreak: stats.max_streak,
    totalAudited: stats.total_audited,
    totalUnlockRevenue: BigInt(stats.total_unlock_revenue),
    scoreBps: stats.score_bps,
    rank: stats.rank,
  };
}

function chainStatsToEntry(
  stats: NonNullable<Awaited<ReturnType<typeof fetchProphetStats>>>,
): LeaderboardEntry {
  return { ...stats, rank: 0 };
}

function formatTimestamp(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number") {
    return new Date(value * 1000).toLocaleString();
  }
  const asNum = Number(value);
  if (Number.isFinite(asNum) && asNum > 1_000_000_000) {
    return new Date(asNum * 1000).toLocaleString();
  }
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return new Date(parsed).toLocaleString();
  return String(value);
}

function prophecyRowFromChain(p: ProphecyView): IndexerProphecyRow {
  return {
    prophecy_id: p.id,
    pool_id: p.marketId,
    prophet: p.prophet,
    lock_time: p.lockTime,
    unlock_price: p.unlockPrice.toString(),
    predicted_value: String(p.predictedValue),
    status: p.status,
    is_public: isPublicProphecy(p),
    unlock_count: p.unlockCount,
    committed_at: null,
  };
}

function unlockPriceLabel(unlockPrice: string): string {
  const n = BigInt(unlockPrice || "0");
  if (n === 0n) return "免费";
  return formatUsdcBaseUnits(n);
}

export default function ProphetProfilePage() {
  const params = useParams<{ address: string }>();
  const account = useCurrentAccount();
  const client = useSuiClient();

  const prophetAddress = useMemo(() => {
    const raw = params?.address ?? "";
    try {
      return normalizeSuiAddress(decodeURIComponent(raw));
    } catch {
      return normalizeSuiAddress(raw);
    }
  }, [params?.address]);

  const addressValid = isValidSuiAddress(prophetAddress);
  const isSelf = account?.address
    ? normalizeSuiAddress(account.address) === prophetAddress
    : false;

  const [stats, setStats] = useState<LeaderboardEntry | null>(null);
  const [history, setHistory] = useState<IndexerProphetStatsHistoryPoint[]>([]);
  const [prophecies, setProphecies] = useState<IndexerProphecyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsSource, setStatsSource] = useState<"indexer" | "chain" | null>(
    null,
  );

  useEffect(() => {
    if (!addressValid) {
      setStats(null);
      setHistory([]);
      setProphecies([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      let loadedStats: LeaderboardEntry | null = null;
      let source: "indexer" | "chain" | null = null;
      let loadedProphecies: IndexerProphecyRow[] = [];
      let loadedHistory: IndexerProphetStatsHistoryPoint[] = [];

      if (indexerEnabled()) {
        const [indexed, hist, rows] = await Promise.all([
          fetchIndexerProphetStats(prophetAddress),
          fetchIndexerProphetHistory(prophetAddress, 30),
          fetchIndexerProphecies({ prophet: prophetAddress, limit: 50 }),
        ]);
        loadedHistory = hist;
        loadedProphecies = rows;
        if (indexed) {
          loadedStats = indexerStatsToEntry(indexed);
          source = "indexer";
        }
      }

      if (!loadedStats && PROPHET_REGISTRY_ID) {
        const chainStats = await fetchProphetStats(
          client,
          PROPHET_REGISTRY_ID,
          prophetAddress,
        );
        if (chainStats) {
          loadedStats = chainStatsToEntry(chainStats);
          source = "chain";
        }
      }

      if (loadedProphecies.length === 0) {
        const ids = await discoverPropheciesByProphet(client, prophetAddress, 50);
        const views = await Promise.all(ids.map((id) => fetchProphecy(client, id)));
        loadedProphecies = views
          .filter((p): p is ProphecyView => p !== null)
          .map(prophecyRowFromChain);
      }

      if (!cancelled) {
        setStats(loadedStats);
        setStatsSource(source);
        setHistory(loadedHistory);
        setProphecies(loadedProphecies);
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [addressValid, client, prophetAddress]);

  if (!addressValid) {
    return (
      <div>
        <PageHeader title="预言家主页" subtitle="无效的 Sui 地址。" />
        <div className="card">
          <p>
            地址格式应为 <code>0x</code> 加 64 位十六进制字符。
          </p>
          <Link href="/leaderboard" className="hero-link secondary">
            返回排行榜
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isSelf ? "预言家主页（你）" : "预言家主页"}
        subtitle={
          <>
            链上战绩与预测记录 ·{" "}
            <code className="mono">{shortAddress(prophetAddress, 8, 6)}</code>
          </>
        }
      >
        <p className="mono" style={{ fontSize: "0.75rem", margin: "0.5rem 0 0" }}>
          {prophetAddress}
        </p>
      </PageHeader>

      <div className="btn-row" style={{ marginBottom: "1rem" }}>
        <Link href="/leaderboard" className="hero-link secondary">
          ← 排行榜
        </Link>
        {isSelf ? (
          <Link href="/prophet" className="hero-link">
            发布 / 管理预测 →
          </Link>
        ) : (
          <Link href="/prophet" className="hero-link">
            解锁预测 →
          </Link>
        )}
        {isSelf && (
          <Link href="/following" className="hero-link secondary">
            我的关注 →
          </Link>
        )}
      </div>

      {!isSelf && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <FollowButton prophetAddress={prophetAddress} />
        </div>
      )}

      <div className="card">
        <h2>战绩摘要</h2>
        {loading ? (
          <p className="hint">加载战绩…</p>
        ) : !stats ? (
          <p className="hint">
            尚无链上战绩。
            {isSelf && (
              <>
                {" "}
                前往 <Link href="/prophet">Prophet</Link>{" "}
                发布免费练手预测（unlock_price = 0）。
              </>
            )}
          </p>
        ) : (
          <>
            <dl className="meta">
              <dt>排名</dt>
              <dd>{stats.rank > 0 ? `#${stats.rank}` : "—"}</dd>
              <dt>胜 / 负 / 作弊</dt>
              <dd>
                {stats.wins} / {stats.losses} / {stats.cheats}
              </dd>
              <dt>胜率</dt>
              <dd>{formatAccuracyPercent(stats)}</dd>
              <dt>审计场次</dt>
              <dd>{stats.totalAudited}</dd>
              <dt>连红</dt>
              <dd>
                {stats.currentStreak}（最高 {stats.maxStreak}）
              </dd>
              <dt>Prophet Score</dt>
              <dd>{formatScorePercent(stats.scoreBps)} / 100</dd>
              <dt>解锁收入</dt>
              <dd>{formatUsdcBaseUnits(stats.totalUnlockRevenue)}</dd>
              <dt>付费开通</dt>
              <dd>
                {isPaidUnlockEligible(stats) ? "已开通" : "未开通"}
                {!isPaidUnlockEligible(stats) && (
                  <span className="hint"> — {paidUnlockEligibilityHint(stats)}</span>
                )}
              </dd>
              <dt>数据来源</dt>
              <dd>
                {statsSource === "indexer"
                  ? "Indexer 缓存（链上 ProphetStats 为真相源）"
                  : "链上 ProphetRegistry 动态字段"}
              </dd>
            </dl>
            <p className="hint">
              付费门槛：≥ {MIN_AUDITED_FOR_PAID} 场审计 · Score ≥{" "}
              {MIN_SCORE_BPS_FOR_PAID / 100} · 零作弊
            </p>
          </>
        )}
      </div>

      {history.length > 0 && (
        <div className="card">
          <h2>Score 历史</h2>
          <p className="hint">Indexer 快照，最近 {history.length} 条</p>
          <DataTable>
            <thead>
              <tr>
                <th>时间</th>
                <th>Score</th>
                <th>排名</th>
                <th>胜/负</th>
              </tr>
            </thead>
            <tbody>
              {history.map((point) => (
                <tr key={point.snapshot_at}>
                  <td>{formatTimestamp(point.snapshot_at)}</td>
                  <td>{formatScorePercent(point.score_bps)}</td>
                  <td>{point.rank != null ? `#${point.rank}` : "—"}</td>
                  <td>
                    {point.wins}/{point.losses}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}

      <div className="card">
        <h2>预测记录</h2>
        {loading ? (
          <p className="hint">加载预测列表…</p>
        ) : prophecies.length === 0 ? (
          <p className="hint">暂无预测记录。</p>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>预测 ID</th>
                <th>市场</th>
                <th>预测值</th>
                <th>解锁价</th>
                <th>状态</th>
                <th>解锁次数</th>
                <th>锁定时间</th>
              </tr>
            </thead>
            <tbody>
              {prophecies.map((row) => (
                <tr key={row.prophecy_id}>
                  <td>
                    <code>{shortAddress(row.prophecy_id, 8, 6)}</code>
                  </td>
                  <td>
                    <Link href={`/markets/${row.pool_id}`}>
                      <code>{shortAddress(row.pool_id, 8, 4)}</code>
                    </Link>
                  </td>
                  <td>{row.predicted_value ?? "—"}</td>
                  <td>{unlockPriceLabel(row.unlock_price)}</td>
                  <td>{prophecyStatusLabel(row.status)}</td>
                  <td>{row.unlock_count}</td>
                  <td>{formatTimestamp(row.lock_time)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        <p className="hint" style={{ marginTop: "1rem" }}>
          付费预测需在 <Link href="/prophet">Prophet</Link> 页解锁后阅读全文；结算后公开预测可审计。
        </p>
      </div>
    </div>
  );
}
