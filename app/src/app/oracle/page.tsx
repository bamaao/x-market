"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import {
  GLOBAL_CONFIG_ID,
  ORACLE_ARBITRATOR_ID,
  ORACLE_CONFIG_ID,
  ORACLE_FEEDS,
  VERDICT_DISPUTER_WINS,
  VERDICT_PROPOSER_WINS,
  VERDICT_UNRESOLVED,
  appendApproveVerdict,
  appendDisputeAndRequestArbitration,
  appendExecuteArbitration,
  appendFinalizeAssertion,
  appendNullifyFeed,
  appendProposeData,
  appendProposeVerdict,
  assertionStatusLabel,
  claimedValueHint,
  decodeBytes,
  feedStatusLabel,
  formatCountdown,
  formatUnixTs,
  livenessRemainingSecs,
  verdictLabel,
} from "@/lib/oracle";
import { PACKAGE_ID } from "@/lib/markets";

function parseMoveFields(content: unknown): Record<string, unknown> | undefined {
  if (!content || typeof content !== "object") return undefined;
  const c = content as { dataType?: string; fields?: Record<string, unknown> };
  if (c.dataType === "moveObject" && c.fields) return c.fields;
  return undefined;
}

function parseObjectId(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    return String((value as { id: string }).id);
  }
  return "";
}

const NULLIFY_AFTER_SECS = 72 * 3600;

export default function OraclePage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [selectedFeedId, setSelectedFeedId] = useState(ORACLE_FEEDS[0]?.feedId ?? "");
  const [assertionId, setAssertionId] = useState("");
  const [caseId, setCaseId] = useState("");
  const [claimedValue, setClaimedValue] = useState("7");
  const [arbitrationValue, setArbitrationValue] = useState("7");
  const [bondMist, setBondMist] = useState("10000000");
  const [msg, setMsg] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const feedMeta = ORACLE_FEEDS.find((f) => f.feedId === selectedFeedId);

  const { data: feedObj, refetch: refetchFeed } = useSuiClientQuery(
    "getObject",
    {
      id: selectedFeedId,
      options: { showContent: true },
    },
    { enabled: selectedFeedId.length > 0 },
  );

  const feedFields = parseMoveFields(feedObj?.data?.content);
  const activeAssertionId = parseObjectId(feedFields?.active_assertion);

  const effectiveAssertionId = assertionId || activeAssertionId;

  const { data: assertionObj, refetch: refetchAssertion } = useSuiClientQuery(
    "getObject",
    {
      id: effectiveAssertionId,
      options: { showContent: true },
    },
    { enabled: effectiveAssertionId.length > 0 },
  );

  const assertionFields = parseMoveFields(assertionObj?.data?.content);

  const { data: caseObj, refetch: refetchCase } = useSuiClientQuery(
    "getObject",
    {
      id: caseId,
      options: { showContent: true },
    },
    { enabled: caseId.length > 0 },
  );
  const caseFields = parseMoveFields(caseObj?.data?.content);

  const poolId = feedMeta?.poolId ?? parseObjectId(feedFields?.market_id);

  const { data: poolObj, refetch: refetchPool } = useSuiClientQuery(
    "getObject",
    {
      id: poolId,
      options: { showContent: true },
    },
    { enabled: poolId.length > 0 },
  );
  const poolFields = parseMoveFields(poolObj?.data?.content);
  const poolResolved = poolFields?.resolved === true;

  const assertionStatus = Number(assertionFields?.status ?? -1);
  const livenessEnd = Number(assertionFields?.liveness_end_at ?? 0);
  const livenessRemain = livenessRemainingSecs(livenessEnd, nowSec);
  const canFinalize =
    assertionStatus === 0 && nowSec > livenessEnd && !poolResolved;
  const canDispute =
    assertionStatus === 0 &&
    nowSec <= livenessEnd &&
    !poolResolved &&
    ORACLE_CONFIG_ID.length > 0 &&
    ORACLE_ARBITRATOR_ID.length > 0;
  const isInArbitration = assertionStatus === 1;

  const eventTs = Number(feedFields?.event_ts ?? 0);
  const feedStatus = Number(feedFields?.feed_status ?? 0);
  const canNullify =
    feedStatus === 0 &&
    !activeAssertionId &&
    !poolResolved &&
    nowSec >= eventTs + NULLIFY_AFTER_SECS;

  const caseVerdict = Number(caseFields?.verdict_type ?? 0);
  const caseApprovals = (caseFields?.approvals as unknown[] | undefined)?.length ?? 0;
  const caseThreshold = Number(caseFields?.required_approvals ?? 0);
  const caseExecuted = Number(caseFields?.status ?? 0) === 1;

  const runTx = async (build: (tx: Transaction) => void, ok: string) => {
    const tx = new Transaction();
    build(tx);
    signAndExecute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { transaction: tx as any },
      {
        onSuccess: (r) => {
          setMsg(`${ok}: ${r.digest?.slice(0, 18)}…`);
          void refetchFeed();
          void refetchAssertion();
          void refetchPool();
          void refetchCase();
        },
        onError: (e) => setMsg(`失败: ${e.message}`),
      },
    );
  };

  const splitUsdcBond = async (tx: Transaction, amount: bigint) => {
    if (!account?.address) throw new Error("请先连接钱包");
    const coins = await client.getCoins({
      owner: account.address,
      coinType: `${PACKAGE_ID}::usdc::USDC`,
    });
    if (!coins.data.length) throw new Error("钱包无 USDC");
    const [primary, ...rest] = coins.data;
    if (rest.length) {
      tx.mergeCoins(
        tx.object(primary.coinObjectId),
        rest.map((c) => tx.object(c.coinObjectId)),
      );
    }
    const [bond] = tx.splitCoins(tx.object(primary.coinObjectId), [
      tx.pure.u64(amount),
    ]);
    return bond;
  };

  const propose = async () => {
    if (!selectedFeedId || !poolId) return setMsg("请选择已注册的 Feed");
    try {
      const tx = new Transaction();
      const bond = await splitUsdcBond(tx, BigInt(bondMist));
      appendProposeData(
        tx,
        selectedFeedId,
        poolId,
        bond,
        BigInt(claimedValue),
      );
      signAndExecute(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { transaction: tx as any },
        {
          onSuccess: (r) => {
            setMsg(`已提议: ${r.digest?.slice(0, 18)}…`);
            void refetchFeed();
          },
          onError: (e) => setMsg(`失败: ${e.message}`),
        },
      );
    } catch (e) {
      setMsg(`失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const feedSummary = useMemo(() => {
    if (!feedFields) return null;
    return {
      identifier: decodeBytes(feedFields.identifier),
      status: Number(feedFields.feed_status ?? 0),
      finalizedValue: String(feedFields.finalized_value ?? "0"),
      eventTs: Number(feedFields.event_ts ?? 0),
      bondRequired: String(feedFields.bond_required ?? "0"),
      livenessSecs: Number(feedFields.liveness_secs ?? 0),
      ancillary: decodeBytes(feedFields.ancillary_data),
    };
  }, [feedFields]);

  const configuredFeeds = ORACLE_FEEDS.filter((f) => f.feedId);

  return (
    <>
      <h1>Oracle 结算</h1>
      <p className="sub">
        乐观预言机：任何人提议 → 争议期 → 委员会终裁（有争议时）→ 市场结算
      </p>

      {!account && <p className="hint">连接钱包后参与提议/争议/委员会投票。</p>}

      {configuredFeeds.length === 0 && (
        <p className="hint">
          未配置 Feed：请在 <code>app/.env</code> 设置{" "}
          <code>NEXT_PUBLIC_ORACLE_FEED_*</code>、<code>ORACLE_CONFIG_ID</code>、
          <code>ORACLE_ARBITRATOR_ID</code>。详见 <code>docs/oracle-playbook.md</code>。
        </p>
      )}

      <div className="card panel">
        <label>Data Feed</label>
        <select
          value={selectedFeedId}
          onChange={(e) => setSelectedFeedId(e.target.value)}
        >
          <option value="">选择 Feed</option>
          {configuredFeeds.map((f) => (
            <option key={f.feedId} value={f.feedId}>
              {f.title}
            </option>
          ))}
        </select>

        {feedSummary && (
          <div className="hint">
            <p>标识: {feedSummary.identifier || "—"}</p>
            <p>状态: {feedStatusLabel(feedSummary.status)}</p>
            <p>事件时间: {formatUnixTs(feedSummary.eventTs)}</p>
            <p>争议窗口: {feedSummary.livenessSecs / 3600}h</p>
            <p>所需押金: {Number(feedSummary.bondRequired) / 1e6} USDC</p>
            <p>固化值: {feedSummary.finalizedValue}</p>
            <p>Pool 已结算: {poolResolved ? "是" : "否"}</p>
            {activeAssertionId && (
              <p>
                活跃 Assertion: <code>{activeAssertionId.slice(0, 16)}…</code>
              </p>
            )}
          </div>
        )}

        <label>
          提议结果
          {feedMeta && (
            <span className="hint"> — {claimedValueHint(feedMeta.kind)}</span>
          )}
        </label>
        <input value={claimedValue} onChange={(e) => setClaimedValue(e.target.value)} />
        <label>提议押金 (USDC base units)</label>
        <input value={bondMist} onChange={(e) => setBondMist(e.target.value)} />

        <div className="btn-row">
          <button
            type="button"
            className="secondary"
            disabled={
              !account || isPending || !selectedFeedId || poolResolved || feedStatus !== 0
            }
            onClick={() => void propose()}
          >
            提议结果
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!account || isPending || !selectedFeedId || !canNullify}
            onClick={() =>
              void runTx(
                (tx) => appendNullifyFeed(tx, selectedFeedId),
                "已熔断 Feed",
              )
            }
          >
            熔断（72h 无提议）
          </button>
        </div>
      </div>

      <div className="card panel">
        <h2>争议 / Finalize</h2>
        <label>Assertion ID</label>
        <input
          value={assertionId}
          onChange={(e) => setAssertionId(e.target.value)}
          placeholder={activeAssertionId || "0x…"}
        />
        {assertionFields && (
          <p className="hint">
            状态: {assertionStatusLabel(assertionStatus)} · 提议值:{" "}
            {String(assertionFields.claimed_value ?? "—")} · 截止:{" "}
            {formatUnixTs(livenessEnd)}
            {assertionStatus === 0 && (
              <> · 剩余: {formatCountdown(livenessRemain)}</>
            )}
            {canFinalize && " · 可 finalize"}
            {isInArbitration && " · 等待委员会终裁"}
          </p>
        )}
        <div className="btn-row">
          <button
            type="button"
            className="secondary"
            disabled={!account || isPending || !effectiveAssertionId || !canDispute}
            onClick={async () => {
              try {
                const tx = new Transaction();
                const bond = await splitUsdcBond(
                  tx,
                  BigInt(feedSummary?.bondRequired ?? bondMist),
                );
                appendDisputeAndRequestArbitration(
                  tx,
                  ORACLE_CONFIG_ID,
                  selectedFeedId,
                  poolId,
                  effectiveAssertionId,
                  ORACLE_ARBITRATOR_ID,
                  bond,
                );
                signAndExecute(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  { transaction: tx as any },
                  {
                    onSuccess: (r) => {
                      setMsg(
                        `已争议并立案: ${r.digest?.slice(0, 18)}…（从交易中复制 ArbitrationCase ID）`,
                      );
                      void refetchAssertion();
                      void refetchFeed();
                    },
                    onError: (e) => setMsg(`失败: ${e.message}`),
                  },
                );
              } catch (e) {
                setMsg(`失败: ${e instanceof Error ? e.message : String(e)}`);
              }
            }}
          >
            争议并立案
          </button>
          <button
            type="button"
            className="secondary"
            disabled={
              !account || isPending || !effectiveAssertionId || !canFinalize
            }
            onClick={() =>
              void runTx(
                (tx) =>
                  appendFinalizeAssertion(
                    tx,
                    selectedFeedId,
                    poolId,
                    effectiveAssertionId,
                  ),
                "已 finalize 并结算市场",
              )
            }
          >
            Finalize（无争议）
          </button>
        </div>
      </div>

      <div className="card panel">
        <h2>委员会终裁</h2>
        <p className="hint">
          委员多签投票 → 达阈值后执行回调。非 Admin 单方裁决。
        </p>
        <label>ArbitrationCase ID</label>
        <input
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          placeholder="争议交易返回的 Case 对象 ID"
        />
        {caseFields && (
          <p className="hint">
            裁决: {verdictLabel(caseVerdict)} · 采纳值:{" "}
            {String(caseFields.resolved_value ?? "—")} · 票数: {caseApprovals}/
            {caseThreshold}
            {caseExecuted ? " · 已执行" : ""}
          </p>
        )}
        <label>
          挑战者胜诉时的采纳值
          {feedMeta && (
            <span className="hint"> — {claimedValueHint(feedMeta.kind)}</span>
          )}
        </label>
        <input
          value={arbitrationValue}
          onChange={(e) => setArbitrationValue(e.target.value)}
        />
        <div className="btn-row">
          <button
            type="button"
            className="secondary"
            disabled={
              !account || isPending || !caseId || !ORACLE_ARBITRATOR_ID || caseExecuted
            }
            onClick={() =>
              void runTx(
                (tx) =>
                  appendProposeVerdict(
                    tx,
                    ORACLE_ARBITRATOR_ID,
                    caseId,
                    VERDICT_PROPOSER_WINS,
                    0n,
                  ),
                "委员：提议者胜诉",
              )
            }
          >
            提案·提议者胜
          </button>
          <button
            type="button"
            className="secondary"
            disabled={
              !account || isPending || !caseId || !ORACLE_ARBITRATOR_ID || caseExecuted
            }
            onClick={() =>
              void runTx(
                (tx) =>
                  appendProposeVerdict(
                    tx,
                    ORACLE_ARBITRATOR_ID,
                    caseId,
                    VERDICT_DISPUTER_WINS,
                    BigInt(arbitrationValue),
                  ),
                "委员：挑战者胜诉",
              )
            }
          >
            提案·挑战者胜
          </button>
          <button
            type="button"
            className="secondary"
            disabled={
              !account || isPending || !caseId || !ORACLE_ARBITRATOR_ID || caseExecuted
            }
            onClick={() =>
              void runTx(
                (tx) =>
                  appendProposeVerdict(
                    tx,
                    ORACLE_ARBITRATOR_ID,
                    caseId,
                    VERDICT_UNRESOLVED,
                    0n,
                  ),
                "委员：无法裁决",
              )
            }
          >
            提案·无法裁决
          </button>
          <button
            type="button"
            className="secondary"
            disabled={
              !account || isPending || !caseId || !ORACLE_ARBITRATOR_ID || caseExecuted
            }
            onClick={() =>
              void runTx(
                (tx) => appendApproveVerdict(tx, ORACLE_ARBITRATOR_ID, caseId),
                "委员：附议",
              )
            }
          >
            附议
          </button>
          <button
            type="button"
            className="secondary"
            disabled={
              !account ||
              isPending ||
              !caseId ||
              !effectiveAssertionId ||
              !ORACLE_ARBITRATOR_ID ||
              !ORACLE_CONFIG_ID ||
              caseExecuted ||
              caseApprovals < caseThreshold
            }
            onClick={() =>
              void runTx(
                (tx) =>
                  appendExecuteArbitration(
                    tx,
                    ORACLE_ARBITRATOR_ID,
                    ORACLE_CONFIG_ID,
                    caseId,
                    selectedFeedId,
                    poolId,
                    effectiveAssertionId,
                  ),
                "委员会终裁已上链",
              )
            }
          >
            执行终裁
          </button>
        </div>
      </div>

      {msg && <p className="hint">{msg}</p>}

      <p className="hint">
        Feed 注册（<code>register_data_feed</code>）属协议运营配置，与委员会终裁无关。
        有争议时仅授权 <code>OracleArbitrator</code> 委员会可回调{" "}
        <code>callback_arbitration_result</code>。
      </p>
    </>
  );
}
