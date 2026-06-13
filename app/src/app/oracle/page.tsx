"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GLOBAL_CONFIG_ID,
  ORACLE_ARBITRATOR_ID,
  ORACLE_CONFIG_ID,
  ORACLE_MARKETS,
  VERDICT_DISPUTER_WINS,
  VERDICT_PROPOSER_WINS,
  VERDICT_UNRESOLVED,
  ADAPTER_UMA_DVM,
  appendApproveVerdict,
  appendDisputeAndRequestArbitration,
  appendExecuteArbitration,
  fetchArbitratorAdapterType,
  appendFinalizeAssertion,
  appendNullifyFeed,
  appendProposeData,
  appendProposeVerdict,
  appendRegisterDataFeedForPool,
  assertionStatusLabel,
  bytesIdentifier,
  claimedValueHint,
  decodeBytes,
  deriveOracleWorkflowStep,
  discoverArbitrationCaseForAssertion,
  discoverFeedForPool,
  extractCreatedObjectIdFromTx,
  feedStatusLabel,
  formatCountdown,
  formatUnixTs,
  livenessRemainingSecs,
  marketKindFromPoolFields,
  normalizePoolObjectId,
  resolveFeedRegistryId,
  verdictLabel,
  workflowStepLabel,
} from "@/lib/oracle";
import { PACKAGE_ID, type MarketKind } from "@/lib/markets";
import { usdcType } from "@/lib/usdc";
import { ArbitrationCasesPanel } from "@/components/ArbitrationCasesPanel";
import { OracleMarketPicker } from "@/components/OracleMarketPicker";
import { PageHeader } from "@/components/PageHeader";
import { fetchIndexerMarket, fetchIndexerOracleQueue, indexerEnabled } from "@/lib/indexer";

const ARBITRATION_CASE_TYPE = `${PACKAGE_ID}::oracle_arbitrator::ArbitrationCase`;

const FLOW_STEPS = [
  { key: "propose", label: "1. 提议" },
  { key: "liveness", label: "2. 争议窗口" },
  { key: "settle", label: "3. 市场结算" },
  { key: "claim", label: "4. 领取赔付" },
] as const;

function flowStepIndex(
  step: ReturnType<typeof deriveOracleWorkflowStep>,
): number {
  switch (step) {
    case "register_feed":
    case "propose":
      return 0;
    case "liveness":
      return 1;
    case "finalize_or_dispute":
    case "arbitration":
      return 2;
    case "settled":
      return 3;
    default:
      return 0;
  }
}
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

function initialPoolId(
  urlPool: string | null,
  seedPools: string[],
): string {
  const fromUrl = urlPool ? normalizePoolObjectId(urlPool) : null;
  if (fromUrl) return fromUrl;
  if (!indexerEnabled()) return seedPools[0] ?? "";
  return "";
}

export default function OraclePage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader
            title="Oracle 结算"
            subtitle="乐观预言机：提议 → 争议窗口 → 委员会终裁或 Finalize → 市场结算 → 领取"
          />
          <p className="hint">加载中…</p>
        </>
      }
    >
      <OraclePageInner />
    </Suspense>
  );
}

function OraclePageInner() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const marketsWithPool = ORACLE_MARKETS.filter((m) => m.poolId);
  const seedPoolIds = marketsWithPool.map((m) => m.poolId);
  const [selectedPoolId, setSelectedPoolId] = useState(() =>
    initialPoolId(searchParams.get("pool"), seedPoolIds),
  );
  const [poolInput, setPoolInput] = useState(() =>
    initialPoolId(searchParams.get("pool"), seedPoolIds),
  );
  const [poolInputError, setPoolInputError] = useState<string | null>(null);
  const [indexerMarketTitle, setIndexerMarketTitle] = useState<string | null>(null);
  const [selectedFeedId, setSelectedFeedId] = useState("");
  const [registryId, setRegistryId] = useState("");
  const [feedDiscovering, setFeedDiscovering] = useState(false);
  const [feedIdentifier, setFeedIdentifier] = useState("EVENT_FEED");
  const [ancillaryData, setAncillaryData] = useState("official first release only");
  const [assertionId, setAssertionId] = useState("");
  const [caseId, setCaseId] = useState("");
  const [claimedValue, setClaimedValue] = useState("7");
  const [arbitrationValue, setArbitrationValue] = useState("7");
  const [bondMist, setBondMist] = useState("10000000");
  const [msg, setMsg] = useState<string | null>(null);
  const [arbitratorAdapter, setArbitratorAdapter] = useState(0);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const isUmaDvmAdapter = arbitratorAdapter === ADAPTER_UMA_DVM;

  const marketMeta = marketsWithPool.find((m) => m.poolId === selectedPoolId);
  const poolId = selectedPoolId;

  const applyPool = useCallback(
    (raw: string, updateUrl = true): boolean => {
      const normalized = normalizePoolObjectId(raw);
      if (!normalized) {
        setPoolInputError("请输入有效的 Pool 对象 ID（0x + 64 位十六进制）");
        return false;
      }
      setPoolInputError(null);
      setSelectedPoolId(normalized);
      setPoolInput(normalized);
      if (updateUrl) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("pool", normalized);
        router.replace(`/oracle?${params.toString()}`, { scroll: false });
      }
      return true;
    },
    [router, searchParams],
  );

  useEffect(() => {
    const fromUrl = searchParams.get("pool");
    if (!fromUrl) return;
    const normalized = normalizePoolObjectId(fromUrl);
    if (normalized && normalized !== selectedPoolId) {
      setSelectedPoolId(normalized);
      setPoolInput(normalized);
      setPoolInputError(null);
    }
  }, [searchParams, selectedPoolId]);

  useEffect(() => {
    if (searchParams.get("pool") || selectedPoolId) return;
    if (!indexerEnabled()) return;
    void fetchIndexerOracleQueue({ status: "actionable", limit: 1 }).then(
      ({ items }) => {
        const first = items[0]?.pool_id;
        if (first) applyPool(first);
      },
    );
  }, [searchParams, selectedPoolId, applyPool]);

  useEffect(() => {
    if (!poolId || marketMeta) {
      setIndexerMarketTitle(null);
      return;
    }
    if (!indexerEnabled()) return;
    let cancelled = false;
    void fetchIndexerMarket(poolId).then((m) => {
      if (cancelled) return;
      setIndexerMarketTitle(m?.title ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [poolId, marketMeta]);

  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ORACLE_ARBITRATOR_ID) return;
    void fetchArbitratorAdapterType(client, ORACLE_ARBITRATOR_ID).then(
      setArbitratorAdapter,
    );
  }, [client]);

  useEffect(() => {
    if (!ORACLE_CONFIG_ID) return;
    void resolveFeedRegistryId(client, ORACLE_CONFIG_ID).then((id) => {
      if (id) setRegistryId(id);
    });
  }, [client]);

  useEffect(() => {
    if (!poolId) {
      setSelectedFeedId("");
      return;
    }
    let cancelled = false;
    setFeedDiscovering(true);
    void discoverFeedForPool(client, poolId, ORACLE_CONFIG_ID).then((feedId) => {
      if (cancelled) return;
      setSelectedFeedId(feedId ?? "");
      setFeedDiscovering(false);
    });
    return () => {
      cancelled = true;
    };
  }, [client, poolId]);

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
  const effectiveMarketKind: MarketKind | undefined =
    marketMeta?.kind ?? marketKindFromPoolFields(poolFields);

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

  const workflowStep = deriveOracleWorkflowStep({
    hasFeed: selectedFeedId.length > 0,
    poolResolved,
    feedStatus,
    assertionStatus,
    hasActiveAssertion: effectiveAssertionId.length > 0,
    livenessRemain,
  });
  const activeFlowIdx = flowStepIndex(workflowStep);

  useEffect(() => {
    if (assertionStatus !== 1 || !effectiveAssertionId || caseId) return;
    let cancelled = false;
    void discoverArbitrationCaseForAssertion(client, effectiveAssertionId).then(
      (id) => {
        if (cancelled || !id) return;
        setCaseId(id);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, assertionStatus, effectiveAssertionId, caseId]);

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
      coinType: usdcType(),
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

  const poolAuthority = String(poolFields?.authority ?? "");
  const isPoolAuthority =
    !!account?.address && poolAuthority === account.address;

  const refreshFeedDiscovery = async () => {
    if (!poolId) return;
    setFeedDiscovering(true);
    const feedId = await discoverFeedForPool(client, poolId, ORACLE_CONFIG_ID);
    setSelectedFeedId(feedId ?? "");
    setFeedDiscovering(false);
    if (feedId) void refetchFeed();
  };

  return (
    <>
      <PageHeader
        title="Oracle 结算"
        subtitle="乐观预言机：提议 → 争议窗口 → 委员会终裁或 Finalize → 市场结算 → 领取"
      />

      <div className="oracle-flow" aria-label="结算流程">
        {FLOW_STEPS.map((s, i) => {
          const done = i < activeFlowIdx;
          const active = i === activeFlowIdx;
          const settleHint =
            s.key === "settle" && workflowStep === "arbitration"
              ? "（委员会）"
              : s.key === "settle" && workflowStep === "finalize_or_dispute"
                ? "（Finalize）"
                : "";
          return (
            <div
              key={s.key}
              className={`oracle-flow-step${active ? " active" : ""}${done ? " done" : ""}`}
            >
              {s.label}
              {settleHint}
            </div>
          );
        })}
      </div>
      <p className="hint">
        当前阶段：<strong>{workflowStepLabel(workflowStep)}</strong>
      </p>

      {!account && <p className="hint">连接钱包后参与提议/争议/委员会投票。</p>}

      {!ORACLE_CONFIG_ID && (
        <p className="hint">
          请配置 <code>NEXT_PUBLIC_ORACLE_CONFIG_ID</code>（含 FeedRegistry）。
        </p>
      )}

      <div className="card panel">
        <label htmlFor="oracle-pool-id">Pool 对象 ID</label>
        <div className="oracle-pool-row">
          <input
            id="oracle-pool-id"
            className="mono"
            value={poolInput}
            placeholder="0x… 粘贴 MarketPool 对象 ID"
            onChange={(e) => {
              setPoolInput(e.target.value);
              if (poolInputError) setPoolInputError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyPool(poolInput);
            }}
          />
          <button
            type="button"
            className="secondary"
            onClick={() => applyPool(poolInput)}
          >
            加载
          </button>
        </div>
        {poolInputError && <p className="hint oracle-pool-error">{poolInputError}</p>}
        <p className="hint">
          支持 URL 深链 <code>/oracle?pool=0x…</code>；Feed 将按 Pool 链上自动发现。
        </p>

        <OracleMarketPicker poolId={poolId} onSelectPool={(id) => applyPool(id)} />

        {selectedPoolId && (
          <p className="hint">
            当前 Pool: <code className="mono">{selectedPoolId}</code>
            {marketMeta ? (
              <>
                {" "}
                · <strong>{marketMeta.title}</strong>
              </>
            ) : indexerMarketTitle ? (
              <>
                {" "}
                · <strong>{indexerMarketTitle}</strong>
              </>
            ) : poolObj?.data ? (
              " · 链上 Pool"
            ) : poolId ? (
              " · 查询中…"
            ) : null}
          </p>
        )}

        <p className="hint">
          Feed:{" "}
          {feedDiscovering
            ? "链上查询中…"
            : selectedFeedId
              ? `${selectedFeedId.slice(0, 18)}…`
              : "未注册（请用 create_*_with_feed 或下方补登记）"}
        </p>

        {!selectedFeedId && selectedPoolId && isPoolAuthority && registryId && (
          <>
            <label>补登记 Feed（市场创建者）</label>
            <input
              value={feedIdentifier}
              onChange={(e) => setFeedIdentifier(e.target.value)}
            />
            <input
              value={ancillaryData}
              onChange={(e) => setAncillaryData(e.target.value)}
            />
            <button
              type="button"
              className="secondary"
              disabled={!account || isPending}
              onClick={() => {
                const tx = new Transaction();
                appendRegisterDataFeedForPool(
                  tx,
                  ORACLE_CONFIG_ID,
                  registryId,
                  poolId,
                  bytesIdentifier(feedIdentifier),
                  0n,
                  0n,
                  0n,
                  bytesIdentifier(ancillaryData),
                );
                signAndExecute(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  { transaction: tx as any },
                  {
                    onSuccess: (r) => {
                      setMsg(`已注册 Feed: ${r.digest?.slice(0, 18)}…`);
                      void refreshFeedDiscovery();
                    },
                    onError: (e) => setMsg(`失败: ${e.message}`),
                  },
                );
              }}
            >
              注册结算 Feed
            </button>
          </>
        )}

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
          {effectiveMarketKind && (
            <span className="hint"> — {claimedValueHint(effectiveMarketKind)}</span>
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
            {isInArbitration &&
              (isUmaDvmAdapter ? " · 等待 UMA DVM Relayer 终裁" : " · 等待委员会终裁")}
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
                    onSuccess: async (r) => {
                      let discovered: string | null = null;
                      if (r.digest) {
                        discovered = await extractCreatedObjectIdFromTx(
                          client,
                          r.digest,
                          ARBITRATION_CASE_TYPE,
                        );
                        if (!discovered) {
                          discovered = await discoverArbitrationCaseForAssertion(
                            client,
                            effectiveAssertionId,
                          );
                        }
                      }
                      if (discovered) setCaseId(discovered);
                      setMsg(
                        discovered
                          ? `已争议并立案，Case: ${discovered.slice(0, 18)}…`
                          : `已争议并立案: ${r.digest?.slice(0, 18)}…（Case 自动发现中）`,
                      );
                      void refetchAssertion();
                      void refetchFeed();
                      if (discovered) void refetchCase();
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
        <h2>{isUmaDvmAdapter ? "UMA DVM 终裁" : "委员会终裁"}</h2>
        <p className="hint">
          {isUmaDvmAdapter
            ? "争议已出站至 UMA DVM；allowlisted Relayer 在投票完成后调用 execute_uma_dvm_arbitration。委员多签按钮已禁用。"
            : "委员多签投票 → 达阈值后执行回调。非 Admin 单方裁决。"}
        </p>
        <label>ArbitrationCase ID</label>
        <input
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          placeholder={
            isInArbitration
              ? "争议后自动发现，也可手动粘贴"
              : "争议交易返回的 Case 对象 ID"
          }
        />
        {isInArbitration && !caseId && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              void discoverArbitrationCaseForAssertion(
                client,
                effectiveAssertionId,
              ).then((id) => {
                if (id) {
                  setCaseId(id);
                  void refetchCase();
                } else setMsg("未找到 Case，请稍后重试或粘贴 ID");
              });
            }}
          >
            按 Assertion 重新发现 Case
          </button>
        )}
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
          {effectiveMarketKind && (
            <span className="hint"> — {claimedValueHint(effectiveMarketKind)}</span>
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
              isUmaDvmAdapter ||
              !account ||
              isPending ||
              !caseId ||
              !ORACLE_ARBITRATOR_ID ||
              caseExecuted
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
              isUmaDvmAdapter ||
              !account ||
              isPending ||
              !caseId ||
              !ORACLE_ARBITRATOR_ID ||
              caseExecuted
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
              isUmaDvmAdapter ||
              !account ||
              isPending ||
              !caseId ||
              !ORACLE_ARBITRATOR_ID ||
              caseExecuted
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
              isUmaDvmAdapter ||
              !account ||
              isPending ||
              !caseId ||
              !ORACLE_ARBITRATOR_ID ||
              caseExecuted
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
              isUmaDvmAdapter ||
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

      {poolResolved && (
        <div className="oracle-claim-banner">
          <p>
            市场已结算
            {poolFields?.resolved_value != null && (
              <>
                ，结果 slot/值:{" "}
                <code>{String(poolFields.resolved_value)}</code>
              </>
            )}
            。获胜方可前往持仓页领取赔付。
          </p>
          <p style={{ marginTop: "0.75rem" }}>
            <Link href="/positions">前往持仓领取 →</Link>
          </p>
        </div>
      )}

      {msg && <p className="hint">{msg}</p>}

      <p className="hint">
        新产品路径：<code>create_*_pool_with_feed</code> 同一 PTB 自动注册；
        旧池可由创建者 <code>register_data_feed_for_pool</code> 补登。
        Feed 通过 <code>FeedRegistry</code> 按 <code>market_id</code> 链上发现，无需{" "}
        <code>ORACLE_FEED_*</code> env。
      </p>

      <ArbitrationCasesPanel />
    </>
  );
}
