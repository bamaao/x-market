"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSignPersonalMessage,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { useSponsoredTransaction } from "@/hooks/useSponsoredTransaction";
import { EVENT_ROOT_BY_POOL } from "@/lib/event-root";
import Link from "next/link";
import { Transaction } from "@mysten/sui/transactions";
import {
  PROPHET_FLOW_STEPS,
  PROPHET_REGISTRY_ID,
  PROPHECY_STATUS_CHEAT,
  PROPHECY_STATUS_OPEN,
  appendAuditProphecy,
  appendCommitPrivateProphecy,
  appendUnlockProphecy,
  auditOutcomeLabel,
  buildNormalIntervalPayload,
  buildProphecyPayload,
  buildSettlementPreview,
  canonicalProphecyJson,
  canAuditProphecy,
  canSealDecryptProphecy,
  computeBuyerRefundPerBuyer,
  decryptProphecyContent,
  decryptFromIndexerCache,
  deriveProphetWorkflowStep,
  discoverPropheciesForPoolWithIndexer,
  extractProphecyIdFromTx,
  fetchProphetRegistry,
  fetchProphetStats,
  fetchProphecy,
  fetchPublicProphecyContent,
  formatAccuracyPercent,
  formatProphecyPrediction,
  formatScorePercent,
  formatUsdcBaseUnits,
  hashProphecyPlaintext,
  intervalPrecisionBps,
  isPaidUnlockEligible,
  isPublicProphecy,
  loadStoredProphecyPlaintext,
  MIN_AUDITED_FOR_PAID,
  MIN_SCORE_BPS_FOR_PAID,
  paidUnlockEligibilityHint,
  parseProphecyFields,
  parseUsdcAmount,
  previewAuditOutcome,
  prophecyIntervalWidth,
  prophecyStatusLabel,
  storeProphecyPlaintext,
  verifyProphecyPlaintextHash,
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
import { uploadProphecyBlob } from "@/lib/prophet-blob-upload";
import { PageHeader } from "@/components/PageHeader";
import { ProphetMarketPicker } from "@/components/ProphetMarketPicker";
import {
  assessProphetMarketEligibility,
  parsePoolSnapshotFromFields,
  PROPHET_UNLOCK_CUTOFF_SECS,
  type ProphetPoolOption,
} from "@/lib/prophet-market-eligibility";

function parseMoveFields(content: unknown): Record<string, unknown> | undefined {
  if (!content || typeof content !== "object") return undefined;
  const c = content as { dataType?: string; fields?: Record<string, unknown> };
  if (c.dataType === "moveObject" && c.fields) return c.fields;
  return undefined;
}

const UNLOCK_CUTOFF_SECS = PROPHET_UNLOCK_CUTOFF_SECS;

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
  const { mutate: signAndExecute, isPending: walletPending } =
    useSignAndExecuteTransaction();
  const {
    executeSponsored,
    isPending: sponsorPending,
    enabled: gasStationEnabled,
  } = useSponsoredTransaction();
  const isPending = walletPending || sponsorPending;
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [selectedMarket, setSelectedMarket] = useState<ProphetPoolOption | null>(
    null,
  );
  const [poolId, setPoolId] = useState("");
  const [prophecyIds, setProphecyIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [predictedValue, setPredictedValue] = useState("7");
  const [normalLow, setNormalLow] = useState("25");
  const [normalHigh, setNormalHigh] = useState("27");
  const [analysis, setAnalysis] = useState("");
  const [unlockPrice, setUnlockPrice] = useState("0");
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
  const [myStats, setMyStats] = useState<ProphetStatsView | null>(null);

  const market = selectedMarket?.market ?? null;

  const handlePoolSelect = useCallback((option: ProphetPoolOption | null) => {
    const nextPoolId = option?.poolId ?? "";
    setPoolId((prev) => (prev === nextPoolId ? prev : nextPoolId));
    setSelectedMarket((prev) => {
      if (!option && !prev) return prev;
      if (option && prev?.poolId === option.poolId) return prev;
      return option;
    });
    if (!nextPoolId) {
      setProphecyIds([]);
      setSelectedId("");
      setDecryptedAnalysis(null);
      setStoredPlaintext("");
      setProphetStats(null);
      setMsg(null);
    }
  }, []);

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
    void discoverPropheciesForPoolWithIndexer(client, poolId, PROPHET_REGISTRY_ID).then(
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
  const poolSnapshot = parsePoolSnapshotFromFields(poolId, poolFields);
  const poolEligibility = assessProphetMarketEligibility(nowSec, poolSnapshot);
  const maturityTs = poolSnapshot.maturityTs;
  const poolResolved = poolSnapshot.resolved;
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
      prophecy.unlockPrice > 0n &&
      prophecy.status === 0 &&
      !isPaid &&
      !isProphet &&
      nowSec + UNLOCK_CUTOFF_SECS < prophecy.lockTime,
  );
  const canReadContent = Boolean(
    prophecy &&
      (isPublicProphecy(prophecy) && prophecy.sealIdHex.length === 0
        ? prophecy.blobId.length > 0
        : account?.address &&
          canSealDecryptProphecy(prophecy, account.address, nowSec)),
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
    return previewAuditOutcome(
      prophecy,
      resolvedValue,
      storedPlaintext,
      market?.kind,
    );
  }, [prophecy, resolvedValue, storedPlaintext, market?.kind]);
  const hashVerification = useMemo(() => {
    if (!prophecy || !storedPlaintext.trim()) return null;
    return verifyProphecyPlaintextHash(storedPlaintext, prophecy);
  }, [prophecy, storedPlaintext]);
  const isAudited = prophecy != null && prophecy.status !== PROPHECY_STATUS_OPEN;
  const paidEligible = isPaidUnlockEligible(myStats);
  const unlockPriceNum = parseUsdcAmount(unlockPrice);
  const paidUnlockBlocked = unlockPriceNum > 0n && !paidEligible;

  const workflowStep = deriveProphetWorkflowStep({
    prophecy,
    isPaid,
    canUnlock,
    canSealDecrypt: canReadContent,
    decrypted,
    poolResolved,
  });
  const activeFlowIdx = flowStepIndex(workflowStep);

  const predictedHint = useMemo(() => {
    if (!market) return "预测值（链上 slot / tenths）";
    if (market.kind === "dirichlet") return "Dirichlet bucket 0–2";
    if (market.kind === "poisson") return "Poisson outcome slot 0–14";
    return "Normal 宏观区间（tenths，如 25–27 = 2.5%–2.7%）";
  }, [market]);

  const isNormalMarket = market?.kind === "normal";
  const normalIntervalValid = useMemo(() => {
    if (!isNormalMarket) return true;
    const lo = Number(normalLow);
    const hi = Number(normalHigh);
    return Number.isFinite(lo) && Number.isFinite(hi) && lo <= hi;
  }, [isNormalMarket, normalLow, normalHigh]);

  useEffect(() => {
    if (!PROPHET_REGISTRY_ID) return;
    void fetchProphetRegistry(client, PROPHET_REGISTRY_ID).then(setRegistryView);
  }, [client]);

  useEffect(() => {
    if (!PROPHET_REGISTRY_ID || !account?.address) {
      setMyStats(null);
      return;
    }
    void fetchProphetStats(
      client,
      PROPHET_REGISTRY_ID,
      account.address,
    ).then(setMyStats);
  }, [client, account?.address]);

  useEffect(() => {
    setDecryptedAnalysis(null);
    if (!prophecy) {
      setStoredPlaintext("");
      setProphetStats(null);
      return;
    }
    const saved = prophecy.sealIdHex
      ? loadStoredProphecyPlaintext(prophecy.sealIdHex)
      : loadStoredProphecyPlaintext(`public:${prophecy.id}`);
    setStoredPlaintext(saved ?? "");
    void fetchProphetStats(client, PROPHET_REGISTRY_ID, prophecy.prophet).then(
      setProphetStats,
    );
    if (isPublicProphecy(prophecy) && prophecy.sealIdHex.length === 0) {
      let cancelled = false;
      void (async () => {
        const cached = await decryptFromIndexerCache(prophecy.id);
        const content = cached ?? (await fetchPublicProphecyContent(prophecy));
        if (cancelled || !content) return;
        setDecryptedAnalysis(content.analysis);
        setStoredPlaintext(content.json);
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [client, prophecy?.id, prophecy?.prophet, prophecy?.sealIdHex, prophecy?.blobId, prophecy?.unlockPrice, prophecy?.isPublic]);

  const signForSeal = useCallback(
    async (message: Uint8Array) => {
      const { signature } = await signPersonalMessage({ message });
      return signature;
    },
    [signPersonalMessage],
  );

  async function runDecrypt(
    target: ProphecyView,
    successMsg = "内容读取成功",
  ) {
    setDecrypting(true);
    setMsg("尝试 Indexer 明文缓存 → blob 存储…");
    try {
      const cached = await decryptFromIndexerCache(target.id);
      const publicContent =
        cached ??
        (isPublicProphecy(target) && target.sealIdHex.length === 0
          ? await fetchPublicProphecyContent(target)
          : null);
      const content =
        publicContent ??
        (account?.address
          ? await decryptProphecyContent(
              target,
              account.address,
              signForSeal,
              nowSec,
            )
          : null);
      if (!content) {
        throw new Error("无法读取预测内容，请连接钱包或稍后重试");
      }
      setDecryptedAnalysis(content.analysis);
      setStoredPlaintext(content.json);
      setMsg(successMsg);
    } catch (e) {
      setMsg((e as Error).message ?? "读取失败");
    } finally {
      setDecrypting(false);
    }
  }

  async function afterTxSuccess(successMsg: string, onDone?: () => void | Promise<void>) {
    setMsg(successMsg);
    if (poolId) {
      const ids = await discoverPropheciesForPoolWithIndexer(
        client,
        poolId,
        PROPHET_REGISTRY_ID,
      );
      setProphecyIds(ids);
    }
    refetchProphecy();
    await onDone?.();
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
      .then(async () => {
        if (gasStationEnabled) {
          try {
            await executeSponsored(tx);
            await afterTxSuccess(
              `${successMsg}（Gas 由协议代付）`,
              onDone,
            );
          } catch (e) {
            setMsg((e as Error).message ?? "赞助交易失败");
          }
          return;
        }
        signAndExecute(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { transaction: tx as any },
          {
            onSuccess: async () => {
              await afterTxSuccess(successMsg, onDone);
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
    if (!poolEligibility.canCommit) {
      setMsg(poolEligibility.reason);
      return;
    }
    if (!account) {
      setMsg("请先连接钱包");
      return;
    }
    const price = parseUsdcAmount(unlockPrice);
    if (price > 0n && !isPaidUnlockEligible(myStats)) {
      setMsg(paidUnlockEligibilityHint(myStats));
      return;
    }
    setCommitting(true);
    const isPublicCommit = price === 0n;
    setMsg(
      isPublicCommit
        ? "Indexer 上传明文 → 链上 Commit（公开预测）…"
        : "Seal 加密 → Indexer 上传 → 链上 Commit…",
    );
    try {
      const analysisText = analysis.trim();
      let payload;
      let predictedLow: number;
      let predictedHigh: number;
      if (isNormalMarket) {
        const lo = Number(normalLow);
        const hi = Number(normalHigh);
        if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) {
          throw new Error("Normal 区间无效：下限须 ≤ 上限（tenths）");
        }
        payload = buildNormalIntervalPayload(poolId, lo, hi, analysisText);
        predictedLow = payload.predicted_low!;
        predictedHigh = payload.predicted_high!;
      } else {
        const pv = Number(predictedValue);
        payload = buildProphecyPayload(poolId, pv, analysisText);
        predictedLow = pv;
        predictedHigh = pv;
      }
      const hash = hashProphecyPlaintext(payload);
      const json = canonicalProphecyJson(payload);
      let blobId: string;
      let sealId: Uint8Array;
      if (isPublicCommit) {
        const uploaded = await uploadProphecyBlob(
          poolId,
          new TextEncoder().encode(json),
        );
        if (!uploaded.ok) {
          throw new Error(`Indexer 上传失败：${uploaded.error}`);
        }
        blobId = uploaded.blobId;
        sealId = new Uint8Array(0);
        storeProphecyPlaintext(`public:${poolId}-${Date.now()}`, json);
      } else {
        sealId = generateSealId();
        const encrypted = await encryptProphecyPayload(
          sealId,
          new TextEncoder().encode(json),
        );
        const uploaded = await uploadProphecyBlob(poolId, encrypted);
        if (!uploaded.ok) {
          throw new Error(`Indexer 上传失败：${uploaded.error}`);
        }
        blobId = uploaded.blobId;
        storeProphecyPlaintext(sealIdHex(sealId), json);
      }
      setStoredPlaintext(json);

      const tx = new Transaction();
      appendCommitPrivateProphecy(tx, {
        registryId: PROPHET_REGISTRY_ID,
        poolId,
        blobId,
        sealId,
        plaintextHash: hash,
        predictedValue: payload.predicted_value,
        predictedLow,
        predictedHigh,
        unlockPrice: price,
        lockTime: maturityTs,
      });

      const onCommitSuccess = async (digest?: string) => {
        setMsg(
          isPublicCommit
            ? gasStationEnabled
              ? "已 Commit 公开预测（Gas 代付）：分析明文存 Indexer/IPFS，链上 is_public=true"
              : "已 Commit 公开预测：分析明文存 Indexer/IPFS，链上 is_public=true"
            : gasStationEnabled
              ? "已 Commit（Gas 代付）：密文在 Indexer/IPFS，链上锁定 hash + seal_id"
              : "已 Commit：密文在 Indexer/IPFS，链上锁定 hash + seal_id",
        );
        const ids = await discoverPropheciesForPoolWithIndexer(
          client,
          poolId,
          PROPHET_REGISTRY_ID,
        );
        setProphecyIds(ids);
        let newId: string | null = null;
        if (digest) {
          newId = await extractProphecyIdFromTx(client, digest);
        }
        if (newId) {
          setSelectedId(newId);
          if (isPublicCommit) {
            storeProphecyPlaintext(`public:${newId}`, json);
          }
        } else if (ids[0]) {
          setSelectedId(ids[0]);
        }
        refetchProphecy();
      };

      if (gasStationEnabled) {
        const result = await executeSponsored(tx);
        await onCommitSuccess(result.digest);
      } else {
        signAndExecute(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { transaction: tx as any },
          {
            onSuccess: async (result) => {
              await onCommitSuccess(result.digest);
            },
            onError: (e) => setMsg(e.message ?? "Commit 失败"),
          },
        );
      }
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
    const preview = previewAuditOutcome(
      prophecy,
      resolvedValue,
      plaintext,
      market?.kind,
    );
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
        if (account?.address) {
          void fetchProphetStats(
            client,
            PROPHET_REGISTRY_ID,
            account.address,
          ).then(setMyStats);
        }
      },
    );
  }

  if (!PROPHET_REGISTRY_ID) {
    return (
      <div>
        <PageHeader
          title="SuiProphet Network"
          subtitle="知识付费预言模块 — 私密预测 Commit、USDC 解锁、Oracle 审计战绩"
        />
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
      <PageHeader
        title="SuiProphet Network"
        subtitle="Seal 加密 · Indexer/IPFS 存储 · 双重 OR 解密 · 共用 L0 Oracle 审计（PRD §11）"
      />

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
        {poolId ? (
          <>
            当前阶段：<strong>{workflowStepLabel(workflowStep)}</strong>
            {prophecy && (
              <>
                {" "}
                · 预测 <code>{prophecy.id.slice(0, 10)}…</code>
              </>
            )}
          </>
        ) : (
          <>请先在市场列表中选择一项，或调整筛选条件。</>
        )}
      </p>

      {!account && poolId && (
        <p className="hint">连接钱包后发布预测、解锁或解密。</p>
      )}

      <div className="card">
        <h2>市场</h2>
        <ProphetMarketPicker
          poolId={poolId}
          nowSec={nowSec}
          onSelect={handlePoolSelect}
        />
        {poolId && (
          <p className="hint">
            lock_time = Pool maturity · 解锁截止前 {UNLOCK_CUTOFF_SECS / 60} 分钟关闭
            paid_buyers 与新预测提交
            {maturityTs > 0 && (
              <> · 到期 {new Date(maturityTs * 1000).toLocaleString()}</>
            )}
            {EVENT_ROOT_BY_POOL[poolId] && (
              <>
                {" "}
                · EventRoot <code>{EVENT_ROOT_BY_POOL[poolId].slice(0, 10)}…</code>
              </>
            )}
          </p>
        )}
        {!poolEligibility.canCommit && poolId && (
          <p className="hint" style={{ color: "var(--warn, #c9a227)" }}>
            {poolEligibility.reason} — 仍可查看该市场已有预测，但无法 Commit。
          </p>
        )}
        {gasStationEnabled ? (
          <p className="hint">
            Gas Station 已启用 — Commit / 解锁 / 审计由协议代付 SUI Gas，钱包仅变动
            USDC。
          </p>
        ) : (
          <p className="hint">
            未配置 <code>NEXT_PUBLIC_GAS_STATION_URL</code>，交易将自付 SUI Gas。
          </p>
        )}
      </div>

      {!poolId ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <p className="hint" style={{ margin: 0 }}>
            当前筛选下无已选市场 — 请切换主题/分布，或从列表中选择一项后继续。
          </p>
        </div>
      ) : (
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <h2>1. {unlockPriceNum === 0n ? "Indexer → Commit（公开预测）" : "Seal → Indexer → Commit（私密付费）"}</h2>
          {isNormalMarket ? (
            <>
              <label>{predictedHint}</label>
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label>下限 (tenths)</label>
                  <input
                    value={normalLow}
                    onChange={(e) => setNormalLow(e.target.value)}
                    placeholder="25"
                  />
                </div>
                <div>
                  <label>上限 (tenths)</label>
                  <input
                    value={normalHigh}
                    onChange={(e) => setNormalHigh(e.target.value)}
                    placeholder="27"
                  />
                </div>
              </div>
              {normalIntervalValid && (
                <p className="hint">
                  区间宽度 {Math.max(0, Number(normalHigh) - Number(normalLow))} tenths
                  · 命中精度贡献约{" "}
                  {formatScorePercent(
                    intervalPrecisionBps(
                      Math.max(0, Number(normalHigh) - Number(normalLow)),
                    ),
                  )}
                  /100（越窄越高）
                </p>
              )}
              {!normalIntervalValid && (
                <p className="hint" style={{ color: "var(--warn, #c9a227)" }}>
                  请填写有效区间：下限 ≤ 上限
                </p>
              )}
            </>
          ) : (
            <>
              <label>{predictedHint}</label>
              <input
                value={predictedValue}
                onChange={(e) => setPredictedValue(e.target.value)}
              />
            </>
          )}
          <label>独家分析</label>
          <textarea
            rows={4}
            value={analysis}
            onChange={(e) => setAnalysis(e.target.value)}
            placeholder="链上大户筹码、宏观路径…"
          />
          <label>解锁价 (USDC，0 = 公开预测)</label>
          <input
            value={unlockPrice}
            onChange={(e) => setUnlockPrice(e.target.value)}
          />
          <p className="hint">
            付费开通：≥{MIN_AUDITED_FOR_PAID} 场审计 · Score ≥{" "}
            {MIN_SCORE_BPS_FOR_PAID / 100} · 零作弊（链上强制）。{" "}
            {paidUnlockEligibilityHint(myStats)}
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="primary"
              disabled={
                isPending ||
                committing ||
                !analysis.trim() ||
                paidUnlockBlocked ||
                !poolEligibility.canCommit ||
                !normalIntervalValid
              }
              onClick={() => void onCommit()}
            >
              {unlockPriceNum === 0n
                ? "Indexer 上传 → Commit 公开预测"
                : "Seal 加密 → Indexer → Commit 私密预测"}
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
              <dd>{formatProphecyPrediction(prophecy, market?.kind)}</dd>
              <dt>解锁价</dt>
              <dd>{formatUsdcBaseUnits(prophecy.unlockPrice)} USDC</dd>
              <dt>锁定至</dt>
              <dd>{new Date(prophecy.lockTime * 1000).toLocaleString()}</dd>
              <dt>已解锁人数</dt>
              <dd>{prophecy.unlockCount}</dd>
              <dt>Blob</dt>
              <dd>
                <code className="mono">{prophecy.blobId.slice(0, 24)}…</code>
              </dd>
              <dt>{isPublicProphecy(prophecy) ? "可见性" : "Seal 解密"}</dt>
              <dd>
                {isPublicProphecy(prophecy) && prophecy.sealIdHex.length === 0
                  ? "公开预测（提交即可阅读）"
                  : canReadContent
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
            {prophecy && canReadContent && !decrypted && (
              <button
                type="button"
                className="secondary"
                disabled={decrypting || isPending}
                onClick={() => void runDecrypt(prophecy)}
              >
                {isPublicProphecy(prophecy) && prophecy.sealIdHex.length === 0
                  ? "3. 阅读公开分析"
                  : "3. Seal 解密阅读分析"}
              </button>
            )}
          </div>

          {prophecy && isPaid && !decrypted && canReadContent && (
            <p className="hint">已满足 Seal 条件 A，可点击解密或等待自动解密。</p>
          )}

          {decryptedAnalysis && (
            <div className="card" style={{ marginTop: "0.75rem" }}>
              <h3>{prophecy && isPublicProphecy(prophecy) ? "预测分析" : "解密内容"}</h3>
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
                  <code>{formatProphecyPrediction(prophecy, market?.kind)}</code>
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
                      {auditPreview.outcome === "win" &&
                        auditPreview.precisionBps != null && (
                          <>
                            {" "}
                            · 精度贡献{" "}
                            {formatScorePercent(auditPreview.precisionBps)}/100
                            {prophecyIntervalWidth(prophecy) > 0 && (
                              <>
                                {" "}
                                （宽度 {prophecyIntervalWidth(prophecy)} tenths）
                              </>
                            )}
                          </>
                        )}
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
                    {canReadContent && !decrypted && (
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
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2>战绩与排行</h2>
        <p className="hint">
          排行数据直读链上 <code>ProphetStats</code>，无需本地统计服务。详见{" "}
          <Link href="/leaderboard">排行榜页</Link>。
        </p>
      </div>

      {msg && <p className="msg">{msg}</p>}
    </div>
  );
}
