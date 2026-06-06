"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSignPersonalMessage,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import Link from "next/link";
import { Transaction } from "@mysten/sui/transactions";
import {
  PROPHET_FLOW_STEPS,
  PROPHET_MARKETS,
  PROPHET_REGISTRY_ID,
  PROPHECY_STATUS_CHEAT,
  PROPHECY_STATUS_OPEN,
  appendAuditProphecy,
  appendCommitPrivateProphecy,
  appendUnlockProphecy,
  auditOutcomeLabel,
  buildProphecyPayload,
  buildSettlementPreview,
  canonicalProphecyJson,
  canAuditProphecy,
  canSealDecryptProphecy,
  computeBuyerRefundPerBuyer,
  decryptProphecyContent,
  deriveProphetWorkflowStep,
  discoverPropheciesForPool,
  extractProphecyIdFromTx,
  fetchLeaderboard,
  fetchProphetRegistry,
  fetchProphetStats,
  fetchProphecy,
  formatAccuracyPercent,
  formatScorePercent,
  formatUsdcBaseUnits,
  hashProphecyPlaintext,
  loadStoredProphecyPlaintext,
  parseProphecyFields,
  parseUsdcAmount,
  previewAuditOutcome,
  prophecyStatusLabel,
  storeProphecyPlaintext,
  verifyProphecyPlaintextHash,
  type LeaderboardEntry,
  type ProphetRegistryView,
  type ProphetStatsView,
  type ProphetWorkflowStep,
  type ProphecyView,
  workflowStepLabel,
} from "@/lib/prophet";
import {
  encryptProphecyPayload,
  generateSealId,
  sealIdHex,
} from "@/lib/seal-prophet";
import { uploadBlobToWalrus } from "@/lib/walrus";

function parseMoveFields(content: unknown): Record<string, unknown> | undefined {
  if (!content || typeof content !== "object") return undefined;
  const c = content as { dataType?: string; fields?: Record<string, unknown> };
  if (c.dataType === "moveObject" && c.fields) return c.fields;
  return undefined;
}

const UNLOCK_CUTOFF_SECS = 300;

function flowStepIndex(step: ProphetWorkflowStep): number {
  switch (step) {
    case "commit":
      return 0;
    case "unlock":
      return 1;
    case "decrypt":
      return 2;
    case "audit":
      return 3;
    case "done":
      return 4;
  }
}

export default function ProphetPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const markets = PROPHET_MARKETS.filter((m) => m.poolId);
  const [poolId, setPoolId] = useState(markets[0]?.poolId ?? "");
  const [prophecyIds, setProphecyIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [predictedValue, setPredictedValue] = useState("7");
  const [analysis, setAnalysis] = useState("");
  const [unlockPrice, setUnlockPrice] = useState("1");
  const [msg, setMsg] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [storedPlaintext, setStoredPlaintext] = useState("");
  const [decryptedAnalysis, setDecryptedAnalysis] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [registryView, setRegistryView] = useState<ProphetRegistryView | null>(
    null,
  );
  const [prophetStats, setProphetStats] = useState<ProphetStatsView | null>(
    null,
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const market = markets.find((m) => m.poolId === poolId);

  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!poolId) {
      setProphecyIds([]);
      setSelectedId("");
      return;
    }
    let cancelled = false;
    setLoadingList(true);
    void discoverPropheciesForPool(client, poolId, PROPHET_REGISTRY_ID).then(
      (ids) => {
        if (cancelled) return;
        setProphecyIds(ids);
        setSelectedId((prev) => (prev && ids.includes(prev) ? prev : ids[0] ?? ""));
        setLoadingList(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, poolId]);

  const { data: poolObj } = useSuiClientQuery(
    "getObject",
    { id: poolId, options: { showContent: true } },
    { enabled: poolId.length > 0 },
  );
  const poolFields = parseMoveFields(poolObj?.data?.content);
  const maturityTs = Number(poolFields?.maturity_ts ?? 0);
  const poolResolved = Boolean(poolFields?.resolved);
  const resolvedValue =
    poolFields?.resolved_value != null
      ? Number(poolFields.resolved_value)
      : null;

  const { data: prophecyObj, refetch: refetchProphecy } = useSuiClientQuery(
    "getObject",
    { id: selectedId, options: { showContent: true } },
    { enabled: selectedId.length > 0 },
  );
  const prophecy: ProphecyView | null = useMemo(() => {
    const fields = parseMoveFields(prophecyObj?.data?.content);
    if (!fields || !selectedId) return null;
    return parseProphecyFields(selectedId, fields);
  }, [prophecyObj, selectedId]);

  const isProphet =
    account?.address && prophecy?.prophet === account.address;
  const isPaid = Boolean(
    account?.address && prophecy?.paidBuyers.includes(account.address),
  );
  const canUnlock = Boolean(
    prophecy &&
      prophecy.status === 0 &&
      !isPaid &&
      !isProphet &&
      nowSec + UNLOCK_CUTOFF_SECS < prophecy.lockTime,
  );
  const canSealDecrypt = Boolean(
    prophecy &&
      account?.address &&
      canSealDecryptProphecy(prophecy, account.address, nowSec),
  );
  const decrypted = decryptedAnalysis !== null;
  const canAudit = Boolean(
    prophecy && canAuditProphecy(prophecy, poolResolved, nowSec),
  );
  const protocolFeeBps = registryView?.protocolFeeBps ?? 500;
  const settlementPreview = useMemo(() => {
    if (!prophecy) return null;
    return buildSettlementPreview(prophecy, protocolFeeBps);
  }, [prophecy, protocolFeeBps]);
  const auditPreview = useMemo(() => {
    if (!prophecy || !storedPlaintext.trim()) return null;
    return previewAuditOutcome(prophecy, resolvedValue, storedPlaintext);
  }, [prophecy, resolvedValue, storedPlaintext]);
  const hashVerification = useMemo(() => {
    if (!prophecy || !storedPlaintext.trim()) return null;
    return verifyProphecyPlaintextHash(storedPlaintext, prophecy);
  }, [prophecy, storedPlaintext]);
  const isAudited = prophecy != null && prophecy.status !== PROPHECY_STATUS_OPEN;

  const workflowStep = deriveProphetWorkflowStep({
    prophecy,
    isPaid,
    canUnlock,
    canSealDecrypt,
    decrypted,
    poolResolved,
  });
  const activeFlowIdx = flowStepIndex(workflowStep);

  const predictedHint = useMemo(() => {
    if (!market) return "预测值（链上 slot / tenths）";
    if (market.kind === "dirichlet") return "Dirichlet bucket 0–2";
    if (market.kind === "poisson") return "Poisson outcome slot 0–14";
    return "Normal 宏观值（tenths，如 28 = 2.8%）";
  }, [market]);

  useEffect(() => {
    if (!PROPHET_REGISTRY_ID) return;
    void fetchProphetRegistry(client, PROPHET_REGISTRY_ID).then(setRegistryView);
  }, [client]);

  useEffect(() => {
    if (!PROPHET_REGISTRY_ID) return;
    setLoadingLeaderboard(true);
    void fetchLeaderboard(client, PROPHET_REGISTRY_ID).then((rows) => {
      setLeaderboard(rows);
      setLoadingLeaderboard(false);
    });
  }, [client]);

  const refreshLeaderboard = useCallback(() => {
    if (!PROPHET_REGISTRY_ID) return;
    void fetchLeaderboard(client, PROPHET_REGISTRY_ID).then(setLeaderboard);
  }, [client]);

  useEffect(() => {
    setDecryptedAnalysis(null);
    if (!prophecy?.sealIdHex) {
      setStoredPlaintext("");
      setProphetStats(null);
      return;
    }
    const saved = loadStoredProphecyPlaintext(prophecy.sealIdHex);
    setStoredPlaintext(saved ?? "");
    void fetchProphetStats(client, PROPHET_REGISTRY_ID, prophecy.prophet).then(
      setProphetStats,
    );
  }, [client, prophecy?.id, prophecy?.prophet, prophecy?.sealIdHex]);

  const signForSeal = useCallback(
    async (message: Uint8Array) => {
      const { signature } = await signPersonalMessage({ message });
      return signature;
    },
    [signPersonalMessage],
  );

  async function runDecrypt(
    target: ProphecyView,
    successMsg = "Seal 解密成功",
  ) {
    if (!account?.address) return;
    setDecrypting(true);
    setMsg("Walrus 拉取密文 → Seal 会话签名 → 解密…");
    try {
      const content = await decryptProphecyContent(
        target,
        account.address,
        signForSeal,
        nowSec,
      );
      setDecryptedAnalysis(content.analysis);
      setStoredPlaintext(content.json);
      setMsg(successMsg);
    } catch (e) {
      setMsg((e as Error).message ?? "解密失败");
    } finally {
      setDecrypting(false);
    }
  }

  function runTx(
    build: (tx: Transaction) => void | Promise<void>,
    successMsg = "交易已提交",
    onDone?: () => void | Promise<void>,
  ) {
    if (!account) {
      setMsg("请先连接钱包");
      return;
    }
    setMsg(null);
    const tx = new Transaction();
    void Promise.resolve(build(tx))
      .then(() => {
        signAndExecute(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { transaction: tx as any },
          {
            onSuccess: async () => {
              setMsg(successMsg);
              if (poolId) {
                const ids = await discoverPropheciesForPool(
                  client,
                  poolId,
                  PROPHET_REGISTRY_ID,
                );
                setProphecyIds(ids);
              }
              refetchProphecy();
              await onDone?.();
            },
            onError: (e) => setMsg(e.message ?? "交易失败"),
          },
        );
      })
      .catch((e: Error) => setMsg(e.message));
  }

  async function onCommit() {
    if (!PROPHET_REGISTRY_ID) {
      setMsg("请配置 NEXT_PUBLIC_PROPHET_REGISTRY_ID");
      return;
    }
    if (!poolId || !maturityTs) {
      setMsg("无法读取市场 maturity_ts");
      return;
    }
    if (!account) {
      setMsg("请先连接钱包");
      return;
    }
    setCommitting(true);
    setMsg("Seal 加密 → Walrus 上传 → 链上 Commit…");
    try {
      const pv = Number(predictedValue);
      const payload = buildProphecyPayload(poolId, pv, analysis.trim());
      const hash = hashProphecyPlaintext(payload);
      const json = canonicalProphecyJson(payload);
      const sealId = generateSealId();
      const encrypted = await encryptProphecyPayload(
        sealId,
        new TextEncoder().encode(json),
      );
      let blobId: string;
      try {
        blobId = await uploadBlobToWalrus(encrypted);
      } catch (walrusErr) {
        throw new Error(
          `Walrus 上传失败（需 Testnet 网络）：${(walrusErr as Error).message}`,
        );
      }
      storeProphecyPlaintext(sealIdHex(sealId), json);
      setStoredPlaintext(json);

      const price = parseUsdcAmount(unlockPrice);
      const tx = new Transaction();
      appendCommitPrivateProphecy(tx, {
        registryId: PROPHET_REGISTRY_ID,
        poolId,
        blobId,
        sealId,
        plaintextHash: hash,
        predictedValue: pv,
        unlockPrice: price,
        lockTime: maturityTs,
      });
      signAndExecute(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { transaction: tx as any },
        {
          onSuccess: async (result) => {
            setMsg("已 Commit：密文在 Walrus，链上锁定 hash + seal_id");
            const ids = await discoverPropheciesForPool(
              client,
              poolId,
              PROPHET_REGISTRY_ID,
            );
            setProphecyIds(ids);
            let newId: string | null = null;
            if (result.digest) {
              newId = await extractProphecyIdFromTx(client, result.digest);
            }
            if (newId) {
              setSelectedId(newId);
            } else if (ids[0]) {
              setSelectedId(ids[0]);
            }
            refetchProphecy();
          },
          onError: (e) => setMsg(e.message ?? "Commit 失败"),
        },
      );
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setCommitting(false);
    }
  }

  function onUnlock() {
    if (!prophecy || !account || !PROPHET_REGISTRY_ID) return;
    const prophecyId = prophecy.id;
    runTx(
      async (tx) => {
        await appendUnlockProphecy(tx, client, account.address, {
          registryId: PROPHET_REGISTRY_ID,
          prophecyId,
          unlockPrice: prophecy.unlockPrice,
        });
      },
      "解锁成功，正在自动 Seal 解密…",
      async () => {
        const updated = await fetchProphecy(client, prophecyId);
        if (updated) {
          await runDecrypt(updated, "解锁并完成 Seal 解密");
        }
      },
    );
  }

  function onAudit() {
    if (!prophecy || !poolId || !PROPHET_REGISTRY_ID) return;
    const plaintext = storedPlaintext.trim();
    if (!plaintext) {
      setMsg("请提供与 Commit 时一致的明文 JSON");
      return;
    }
    const hashCheck = verifyProphecyPlaintextHash(plaintext, prophecy);
    if (!hashCheck.ok) {
      setMsg(hashCheck.reason ?? "明文 Hash 校验失败");
      return;
    }
    const preview = previewAuditOutcome(prophecy, resolvedValue, plaintext);
    const settlement = buildSettlementPreview(prophecy, protocolFeeBps);
    runTx(
      (tx) => {
        appendAuditProphecy(tx, {
          registryId: PROPHET_REGISTRY_ID,
          prophecyId: prophecy.id,
          poolId,
          plaintext,
        });
      },
      preview.outcome === "cheat"
        ? "审计：作弊判定，托管款将退还买家"
        : `审计：${auditOutcomeLabel(preview.outcome)} · 预言家实收 ${formatUsdcBaseUnits(settlement.prophetPayout)} USDC · 协议费 ${formatUsdcBaseUnits(settlement.protocolFee)} USDC`,
      async () => {
        if (prophecy) {
          const stats = await fetchProphetStats(
            client,
            PROPHET_REGISTRY_ID,
            prophecy.prophet,
          );
          setProphetStats(stats);
        }
        refreshLeaderboard();
      },
    );
  }

  if (!PROPHET_REGISTRY_ID) {
    return (
      <div>
        <h1>SuiProphet Network</h1>
        <p className="sub">
          知识付费预言模块 — 私密预测 Commit、USDC 解锁、Oracle 审计战绩。
        </p>
        <div className="card">
          <p>
            部署后调用 <code>create_prophet_registry</code>，并配置{" "}
            <code>NEXT_PUBLIC_PROPHET_REGISTRY_ID</code>。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>SuiProphet Network</h1>
      <p className="sub">
        Seal 加密 · Walrus 存储 · 双重 OR 解密 · 共用 L0 Oracle 审计（PRD §11）
      </p>

      <div className="oracle-flow" aria-label="Prophet 流程">
        {PROPHET_FLOW_STEPS.map((s, i) => {
          const done = i < activeFlowIdx;
          const active = i === activeFlowIdx;
          return (
            <div
              key={s.id}
              className={`oracle-flow-step${active ? " active" : ""}${done ? " done" : ""}`}
            >
              {s.label}
            </div>
          );
        })}
      </div>
      <p className="hint">
        当前阶段：<strong>{workflowStepLabel(workflowStep)}</strong>
        {prophecy && (
          <>
            {" "}
            · 预测 <code>{prophecy.id.slice(0, 10)}…</code>
          </>
        )}
      </p>

      {!account && <p className="hint">连接钱包后发布预测、解锁或解密。</p>}

      <div className="card">
        <h2>市场</h2>
        <label>选择 Pool</label>
        <select
          value={poolId}
          onChange={(e) => setPoolId(e.target.value)}
        >
          {markets.map((m) => (
            <option key={m.poolId} value={m.poolId}>
              {m.title}
            </option>
          ))}
        </select>
        <p className="hint">
          lock_time = Pool maturity · 解锁截止前 5 分钟关闭 paid_buyers
          {maturityTs > 0 && (
            <> · 到期 {new Date(maturityTs * 1000).toLocaleString()}</>
          )}
        </p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <h2>1. Seal → Walrus → Commit（预言家）</h2>
          <label>{predictedHint}</label>
          <input
            value={predictedValue}
            onChange={(e) => setPredictedValue(e.target.value)}
          />
          <label>独家分析</label>
          <textarea
            rows={4}
            value={analysis}
            onChange={(e) => setAnalysis(e.target.value)}
            placeholder="链上大户筹码、宏观路径…"
          />
          <label>解锁价 (USDC)</label>
          <input
            value={unlockPrice}
            onChange={(e) => setUnlockPrice(e.target.value)}
          />
          <div className="btn-row">
            <button
              type="button"
              className="primary"
              disabled={isPending || committing || !analysis.trim()}
              onClick={() => void onCommit()}
            >
              Seal 加密 → Walrus → Commit
            </button>
          </div>
          {isProphet && storedPlaintext && (
            <p className="hint">已本地保存 Commit 明文（审计用）。</p>
          )}
        </div>

        <div className="card">
          <h2>预测详情</h2>
          {loadingList ? (
            <p className="hint">链上发现中…</p>
          ) : prophecyIds.length === 0 ? (
            <p className="hint">该市场暂无私密预测 — 请先 Commit</p>
          ) : (
            <>
              <label>选择预测</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {prophecyIds.map((id) => (
                  <option key={id} value={id}>
                    {id.slice(0, 10)}…{id.slice(-6)}
                  </option>
                ))}
              </select>
            </>
          )}

          {prophecy && (
            <dl className="meta">
              <dt>状态</dt>
              <dd>{prophecyStatusLabel(prophecy.status)}</dd>
              <dt>预言家</dt>
              <dd>
                <code>{prophecy.prophet.slice(0, 8)}…</code>
                {isProphet ? "（你）" : ""}
              </dd>
              <dt>预测值</dt>
              <dd>{prophecy.predictedValue}</dd>
              <dt>解锁价</dt>
              <dd>{formatUsdcBaseUnits(prophecy.unlockPrice)} USDC</dd>
              <dt>锁定至</dt>
              <dd>{new Date(prophecy.lockTime * 1000).toLocaleString()}</dd>
              <dt>已解锁人数</dt>
              <dd>{prophecy.unlockCount}</dd>
              <dt>Walrus</dt>
              <dd>
                <code className="mono">{prophecy.blobId.slice(0, 24)}…</code>
              </dd>
              <dt>Seal 解密</dt>
              <dd>
                {canSealDecrypt
                  ? isPaid
                    ? "条件 A：已付费"
                    : prophecy.isPublic
                      ? "条件 B：已公开"
                      : nowSec > prophecy.lockTime
                        ? "条件 B：lock_time 已过"
                        : "可解密"
                  : "需 unlock 或等待 lock_time"}
              </dd>
            </dl>
          )}

          <div className="btn-row">
            {prophecy && canUnlock && (
              <button
                type="button"
                className="primary"
                disabled={isPending}
                onClick={onUnlock}
              >
                2. 解锁 {formatUsdcBaseUnits(prophecy.unlockPrice)} USDC
              </button>
            )}
            {prophecy && canSealDecrypt && !decrypted && (
              <button
                type="button"
                className="secondary"
                disabled={decrypting || isPending}
                onClick={() => void runDecrypt(prophecy)}
              >
                3. Seal 解密阅读分析
              </button>
            )}
          </div>

          {prophecy && isPaid && !decrypted && canSealDecrypt && (
            <p className="hint">已满足 Seal 条件 A，可点击解密或等待自动解密。</p>
          )}

          {decryptedAnalysis && (
            <div className="card" style={{ marginTop: "0.75rem" }}>
              <h3>解密内容</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{decryptedAnalysis}</p>
            </div>
          )}

          {prophecy && !poolResolved && nowSec >= prophecy.lockTime && (
            <p className="hint">
              Pool 尚未结算 — 请先在{" "}
              <Link href="/oracle">Oracle 页</Link> 完成提议 / 争议 / Finalize。
            </p>
          )}

          {(canAudit || isAudited) && prophecy && (
            <div className="card" style={{ marginTop: "0.75rem" }}>
              <h3>4. 审计 → 战绩 → 分账</h3>
              <dl className="meta">
                <dt>Oracle 结果</dt>
                <dd>
                  {resolvedValue != null ? (
                    <code>{resolvedValue}</code>
                  ) : (
                    "待结算"
                  )}
                </dd>
                <dt>预测值</dt>
                <dd>
                  <code>{prophecy.predictedValue}</code>
                </dd>
                <dt>托管总额</dt>
                <dd>
                  {settlementPreview
                    ? `${formatUsdcBaseUnits(settlementPreview.escrowTotal)} USDC（${prophecy.unlockCount} 人解锁）`
                    : "—"}
                </dd>
                <dt>协议费率</dt>
                <dd>{(protocolFeeBps / 100).toFixed(1)}%</dd>
              </dl>

              {isAudited && settlementPreview && (
                <dl className="meta">
                  <dt>审计结果</dt>
                  <dd>{prophecyStatusLabel(prophecy.status)}</dd>
                  {prophecy.status === PROPHECY_STATUS_CHEAT ? (
                    <>
                      <dt>买家退款</dt>
                      <dd>
                        每人{" "}
                        {formatUsdcBaseUnits(
                          computeBuyerRefundPerBuyer(
                            settlementPreview.escrowTotal,
                            prophecy.paidBuyers.length,
                          ),
                        )}{" "}
                        USDC（均分托管）
                      </dd>
                    </>
                  ) : (
                    <>
                      <dt>协议收入</dt>
                      <dd>
                        {formatUsdcBaseUnits(settlementPreview.protocolFee)} USDC
                        → Registry treasury
                      </dd>
                      <dt>预言家实收</dt>
                      <dd>
                        {formatUsdcBaseUnits(settlementPreview.prophetPayout)}{" "}
                        USDC
                      </dd>
                    </>
                  )}
                </dl>
              )}

              {!isAudited && (
                <>
                  {hashVerification && (
                    <p className="hint">
                      Hash 校验：{hashVerification.ok ? "通过" : hashVerification.reason}
                    </p>
                  )}
                  {auditPreview && hashVerification?.ok && (
                    <p className="hint">
                      预判：{auditOutcomeLabel(auditPreview.outcome)}
                      {settlementPreview && auditPreview.outcome !== "cheat" && (
                        <>
                          {" "}
                          · 分账：预言家{" "}
                          {formatUsdcBaseUnits(settlementPreview.prophetPayout)} /
                          协议 {formatUsdcBaseUnits(settlementPreview.protocolFee)}{" "}
                          USDC
                        </>
                      )}
                    </p>
                  )}
                  <label>审计明文 JSON（须与 Commit 时一致）</label>
                  <textarea
                    rows={3}
                    value={storedPlaintext}
                    onChange={(e) => setStoredPlaintext(e.target.value)}
                    placeholder="预言家本地明文或 Seal 解密后的 JSON"
                  />
                  <div className="btn-row">
                    <button
                      type="button"
                      className="primary"
                      disabled={isPending || !storedPlaintext.trim()}
                      onClick={onAudit}
                    >
                      audit_prophecy（Hash → 战绩 → 分账）
                    </button>
                    {canSealDecrypt && !decrypted && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={decrypting}
                        onClick={() => void runDecrypt(prophecy)}
                      >
                        先解密获取明文
                      </button>
                    )}
                  </div>
                </>
              )}

              {prophetStats && (
                <dl className="meta">
                  <dt>预言家战绩</dt>
                  <dd>
                    {prophetStats.wins} 胜 / {prophetStats.losses} 负
                    {prophetStats.cheats > 0 && ` / ${prophetStats.cheats} 作弊`}
                  </dd>
                  <dt>胜率</dt>
                  <dd>{formatAccuracyPercent(prophetStats)}</dd>
                  <dt>连红</dt>
                  <dd>
                    当前 {prophetStats.currentStreak} · 最高 {prophetStats.maxStreak}
                  </dd>
                  <dt>Prophet Score</dt>
                  <dd>{formatScorePercent(prophetStats.scoreBps)} / 100</dd>
                  <dt>累计解锁收入</dt>
                  <dd>
                    {formatUsdcBaseUnits(prophetStats.totalUnlockRevenue)} USDC
                  </dd>
                </dl>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2>全链战绩排行榜</h2>
        <p className="hint">
          Prophet Score = 60% 胜率 + 20% 经验(log N) + 20% 收入；数据来自
          Registry 动态字段。
        </p>
        {loadingLeaderboard ? (
          <p className="hint">加载中…</p>
        ) : leaderboard.length === 0 ? (
          <p className="hint">暂无审计战绩 — 完成首笔 audit_prophecy 后出现。</p>
        ) : (
          <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                <th style={{ padding: "0.35rem 0" }}>#</th>
                <th>预言家</th>
                <th>胜/负</th>
                <th>胜率</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row) => (
                <tr key={row.prophet} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 0" }}>{row.rank}</td>
                  <td>
                    <code>
                      {row.prophet.slice(0, 8)}…
                      {account?.address === row.prophet ? "（你）" : ""}
                    </code>
                  </td>
                  <td>
                    {row.wins}/{row.losses}
                  </td>
                  <td>{formatAccuracyPercent(row)}</td>
                  <td>{formatScorePercent(row.scoreBps)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {msg && <p className="msg">{msg}</p>}
    </div>
  );
}
