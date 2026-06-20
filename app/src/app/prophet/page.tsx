// Copyright (c) 2026 zouyc zouyccq@gmail.com.
// All rights reserved.
//
// Licensed under the Business Source License 1.1 (BSL 1.1).
// You may not use this file except in compliance with the License.
//
// Change Date: 2031-01-01
// On the Change Date, or the fourth anniversary of the first publicly available
// distribution of the code under the BSL, whichever comes first, the code
// automatically becomes available under the Apache License 2.0.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSignPersonalMessage,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { EVENT_ROOT_BY_POOL } from "@/lib/event-root";
import Link from "next/link";
import { Transaction } from "@mysten/sui/transactions";
import {
  PROPHET_REGISTRY_ID,
  PROPHECY_STATUS_CHEAT,
  PROPHECY_STATUS_OPEN,
  appendAuditProphecy,
  appendCommitPrivateProphecy,
  appendUnlockProphecy,
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
  isPredictionHidden,
  buildAuditPlaintextBytes,
  encodePaidProphecyPlain,
  formatScorePercent,
  formatUsdcBaseUnits,
  hashProphecyPlaintext,
  intervalPrecisionBps,
  isPaidUnlockEligible,
  isPublicProphecy,
  loadStoredProphecyPlaintext,
  MIN_AUDITED_FOR_PAID,
  MIN_SCORE_BPS_FOR_PAID,
  parseProphecyFields,
  parseUsdcAmount,
  previewAuditOutcome,
  prophecyIntervalWidth,
  storeProphecyPlaintext,
  verifyProphecyPlaintextHash,
  type ProphetRegistryView,
  type ProphetStatsView,
  type ProphetWorkflowStep,
  type ProphecyView,
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
import {
  localizedAuditOutcome,
  localizedPaidUnlockEligibilityHint,
  localizedProphecyStatus,
  localizedProphecyVerifyReason,
  localizedProphetEligibilityReason,
  localizedProphetWorkflowStep,
} from "@/i18n/domain";
import { formatCaughtError, localizeLibMessage } from "@/i18n/core";
import { useT } from "@/i18n/context";

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
  const t = useT();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
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
    if (!market) return t("prophet.predictedSlot");
    if (market.kind === "dirichlet") return t("prophet.predictedHintDirichlet");
    if (market.kind === "poisson") return t("prophet.predictedHintPoisson");
    return t("prophet.normalInterval");
  }, [market, t]);

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
    successMsg?: string,
  ) {
    setDecrypting(true);
    setMsg(t("prophet.uploading"));
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
        throw new Error(t("prophet.errReadContent"));
      }
      setDecryptedAnalysis(content.analysis);
      setStoredPlaintext(content.json);
      setMsg(successMsg ?? t("prophet.readSuccess"));
    } catch (e) {
      setMsg(formatCaughtError(e, t));
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
    successMsg?: string,
    onDone?: () => void | Promise<void>,
  ) {
    if (!account) {
      setMsg(t("common.connectWallet"));
      return;
    }
    setMsg(null);
    const tx = new Transaction();
    const msg = successMsg ?? t("prophet.txSubmitted");
    void Promise.resolve(build(tx))
      .then(async () => {
        signAndExecute(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { transaction: tx as any },
          {
            onSuccess: async () => {
              await afterTxSuccess(msg, onDone);
            },
            onError: (e) => setMsg(formatCaughtError(e, t)),
          },
        );
      })
      .catch((e: unknown) => setMsg(formatCaughtError(e, t)));
  }

  async function onCommit() {
    if (!PROPHET_REGISTRY_ID) {
      setMsg(t("prophet.errRegistry"));
      return;
    }
    if (!poolId || !maturityTs) {
      setMsg(t("prophet.errMaturity"));
      return;
    }
    if (!poolEligibility.canCommit) {
      setMsg(localizedProphetEligibilityReason(poolEligibility, t));
      return;
    }
    if (!account) {
      setMsg(t("common.connectWallet"));
      return;
    }
    const price = parseUsdcAmount(unlockPrice);
    if (price > 0n && !isPaidUnlockEligible(myStats)) {
      setMsg(localizedPaidUnlockEligibilityHint(myStats, t));
      return;
    }
    setCommitting(true);
    const isPublicCommit = price === 0n;
    setMsg(
      isPublicCommit ? t("prophet.committingPublic") : t("prophet.committingPrivate"),
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
          throw new Error(t("prophet.errNormalInterval"));
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
      const hash = hashProphecyPlaintext(payload, poolId, price);
      const json = canonicalProphecyJson(payload);
      const paidPlainBytes = encodePaidProphecyPlain(poolId, payload);
      let blobId: string;
      let sealId: Uint8Array;
      if (isPublicCommit) {
        const uploaded = await uploadProphecyBlob(
          poolId,
          new TextEncoder().encode(json),
        );
        if (!uploaded.ok) {
          throw new Error(
            t("prophet.errIndexerUpload", {
              error: localizeLibMessage(uploaded.error, t),
            }),
          );
        }
        blobId = uploaded.blobId;
        sealId = new Uint8Array(0);
        storeProphecyPlaintext(`public:${poolId}-${Date.now()}`, json);
      } else {
        sealId = generateSealId();
        const encrypted = await encryptProphecyPayload(sealId, paidPlainBytes);
        const uploaded = await uploadProphecyBlob(poolId, encrypted);
        if (!uploaded.ok) {
          throw new Error(
            t("prophet.errIndexerUpload", {
              error: localizeLibMessage(uploaded.error, t),
            }),
          );
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
        predictedValue: isPublicCommit ? payload.predicted_value : 0,
        predictedLow: isPublicCommit ? predictedLow : 0,
        predictedHigh: isPublicCommit ? predictedHigh : 0,
        unlockPrice: price,
        lockTime: maturityTs,
      });

      const onCommitSuccess = async (digest?: string) => {
        setMsg(
          isPublicCommit
            ? t("prophet.committedPublic")
            : t("prophet.committedPrivate"),
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

      signAndExecute(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { transaction: tx as any },
        {
          onSuccess: async (result) => {
            await onCommitSuccess(result.digest);
          },
          onError: (e) => setMsg(formatCaughtError(e, t)),
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
      t("prophet.unlockSuccess"),
      async () => {
        const updated = await fetchProphecy(client, prophecyId);
        if (updated) {
          await runDecrypt(updated, t("prophet.auditUnlockDecrypt"));
        }
      },
    );
  }

  function onAudit() {
    if (!prophecy || !poolId || !PROPHET_REGISTRY_ID) return;
    const plaintext = storedPlaintext.trim();
    if (!plaintext) {
      setMsg(t("prophet.errPlaintextJson"));
      return;
    }
    const auditBytes = buildAuditPlaintextBytes(prophecy, plaintext);
    if (!auditBytes) {
      setMsg(t("prophet.errPlaintextJson"));
      return;
    }
    const hashCheck = verifyProphecyPlaintextHash(auditBytes, prophecy);
    if (!hashCheck.ok) {
      setMsg(
        hashCheck.reasonKey
          ? localizedProphecyVerifyReason(hashCheck.reasonKey, t)
          : t("prophet.errHashCheck"),
      );
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
          plaintext: auditBytes,
        });
      },
      preview.outcome === "cheat"
        ? t("prophet.auditCheat")
        : t("prophet.auditResultDetail", {
            outcome: localizedAuditOutcome(preview.outcome, t),
            prophet: formatUsdcBaseUnits(settlement.prophetPayout),
            fee: formatUsdcBaseUnits(settlement.protocolFee),
          }),
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
          title={t("prophet.title")}
          subtitle={t("prophet.subtitle")}
        />
        <div className="card">
          <p>{t("prophet.registryDeployHint")}</p>
        </div>
      </div>
    );
  }

  const flowSteps = [
    t("prophet.flowCommit"),
    t("prophet.flowUnlock"),
    t("prophet.flowDecrypt"),
    t("prophet.flowAudit"),
  ];

  return (
    <div>
      <PageHeader
        title={t("prophet.title")}
        subtitle={t("prophet.subtitle")}
      />

      <div className="oracle-flow" aria-label={t("prophet.flowAria")}>
        {flowSteps.map((label, i) => {
          const done = i < activeFlowIdx;
          const active = i === activeFlowIdx;
          return (
            <div
              key={label}
              className={`oracle-flow-step${active ? " active" : ""}${done ? " done" : ""}`}
            >
              {label}
            </div>
          );
        })}
      </div>
      <p className="hint">
        {poolId ? (
          <>
            {t("prophet.currentStep", {
              step: localizedProphetWorkflowStep(workflowStep, t),
            })}
            {prophecy && (
              <>
                {t("prophet.prophecyId", { id: prophecy.id.slice(0, 10) })}
              </>
            )}
          </>
        ) : (
          t("prophet.selectMarket")
        )}
      </p>

      {!account && poolId && (
        <p className="hint">{t("prophet.connectHint")}</p>
      )}

      <div className="card">
        <h2>{t("prophet.marketSection")}</h2>
        <ProphetMarketPicker
          poolId={poolId}
          nowSec={nowSec}
          onSelect={handlePoolSelect}
        />
        {poolId && (
          <p className="hint">
            {t("prophet.lockTimeHint", { minutes: UNLOCK_CUTOFF_SECS / 60 })}
            {maturityTs > 0 && (
              <> · {new Date(maturityTs * 1000).toLocaleString()}</>
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
            {t("prophet.stillView", {
              reason: localizedProphetEligibilityReason(poolEligibility, t),
            })}
          </p>
        )}
        <p className="hint">{t("prophet.gasDisabled")}</p>
      </div>

      {!poolId ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <p className="hint" style={{ margin: 0 }}>
            {t("prophet.noMarketSelected")}
          </p>
        </div>
      ) : (
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <h2>
            1.{" "}
            {unlockPriceNum === 0n
              ? t("prophet.commitPublicTitle")
              : t("prophet.commitPrivateTitle")}
          </h2>
          {isNormalMarket ? (
            <>
              <label>{predictedHint}</label>
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label>{t("prophet.lowerTenths")}</label>
                  <input
                    value={normalLow}
                    onChange={(e) => setNormalLow(e.target.value)}
                    placeholder="25"
                  />
                </div>
                <div>
                  <label>{t("prophet.upperTenths")}</label>
                  <input
                    value={normalHigh}
                    onChange={(e) => setNormalHigh(e.target.value)}
                    placeholder="27"
                  />
                </div>
              </div>
              {normalIntervalValid && (
                <p className="hint">
                  {t("prophet.intervalWidth", {
                    width: Math.max(0, Number(normalHigh) - Number(normalLow)),
                    bps: formatScorePercent(
                      intervalPrecisionBps(
                        Math.max(0, Number(normalHigh) - Number(normalLow)),
                      ),
                    ),
                  })}
                </p>
              )}
              {!normalIntervalValid && (
                <p className="hint" style={{ color: "var(--warn, #c9a227)" }}>
                  {t("prophet.invalidInterval")}
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
          <label>{t("prophet.analysis")}</label>
          <textarea
            rows={4}
            value={analysis}
            onChange={(e) => setAnalysis(e.target.value)}
            placeholder={t("prophet.analysisPlaceholder")}
          />
          <label>{t("prophet.unlockPrice")}</label>
          <input
            value={unlockPrice}
            onChange={(e) => setUnlockPrice(e.target.value)}
          />
          <p className="hint">
            {t("prophet.paidUnlockRule", {
              min: MIN_AUDITED_FOR_PAID,
              score: MIN_SCORE_BPS_FOR_PAID / 100,
            })}{" "}
            {localizedPaidUnlockEligibilityHint(myStats, t)}
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
                ? t("prophet.commitPublicBtn")
                : t("prophet.commitPrivateBtn")}
            </button>
          </div>
          {isProphet && storedPlaintext && (
            <p className="hint">{t("prophet.savedPlaintext")}</p>
          )}
        </div>

        <div className="card">
          <h2>{t("prophet.prophecyDetail")}</h2>
          {loadingList ? (
            <p className="hint">{t("prophet.discovering")}</p>
          ) : prophecyIds.length === 0 ? (
            <p className="hint">{t("prophet.noProphecies")}</p>
          ) : (
            <>
              <label>{t("prophet.selectProphecy")}</label>
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
              <dt>{t("prophet.status")}</dt>
              <dd>{localizedProphecyStatus(prophecy.status, t)}</dd>
              <dt>{t("prophet.prophet")}</dt>
              <dd>
                <code>{prophecy.prophet.slice(0, 8)}…</code>
                {isProphet ? t("common.you") : ""}
              </dd>
              <dt>{t("prophet.predictedValueLabel")}</dt>
              <dd>
                {formatProphecyPrediction(
                  prophecy,
                  market?.kind,
                  t("prophet.predictionHidden"),
                )}
              </dd>
              <dt>{t("prophet.unlockPriceLabel")}</dt>
              <dd>{formatUsdcBaseUnits(prophecy.unlockPrice)} USDC</dd>
              <dt>{t("prophet.lockUntil")}</dt>
              <dd>{new Date(prophecy.lockTime * 1000).toLocaleString()}</dd>
              <dt>{t("prophet.unlockCount")}</dt>
              <dd>{prophecy.unlockCount}</dd>
              <dt>{t("prophet.blob")}</dt>
              <dd>
                <code className="mono">{prophecy.blobId.slice(0, 24)}…</code>
              </dd>
              <dt>{isPublicProphecy(prophecy) ? t("prophet.visibility") : t("prophet.sealDecrypt")}</dt>
              <dd>
                {isPublicProphecy(prophecy) && prophecy.sealIdHex.length === 0
                  ? t("prophet.publicReadable")
                  : canReadContent
                    ? isPaid
                      ? t("prophet.conditionPaid")
                      : prophecy.isPublic
                        ? t("prophet.conditionPublic")
                        : nowSec > prophecy.lockTime
                          ? t("prophet.conditionLockTime")
                          : t("prophet.canDecrypt")
                    : t("prophet.needUnlock")}
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
                {t("prophet.unlockBtn", {
                  price: formatUsdcBaseUnits(prophecy.unlockPrice),
                })}
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
                  ? t("prophet.readPublic")
                  : t("prophet.readDecrypt")}
              </button>
            )}
          </div>

          {prophecy && isPaid && !decrypted && canReadContent && (
            <p className="hint">{t("prophet.autoDecryptHint")}</p>
          )}

          {decryptedAnalysis && (
            <div className="card" style={{ marginTop: "0.75rem" }}>
              <h3>
                {prophecy && isPublicProphecy(prophecy)
                  ? t("prophet.analysisTitle")
                  : t("prophet.decryptedContent")}
              </h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{decryptedAnalysis}</p>
            </div>
          )}

          {prophecy && !poolResolved && nowSec >= prophecy.lockTime && (
            <p className="hint">
              {t("prophet.poolNotSettled")}{" "}
              <Link href="/oracle">Oracle</Link>
            </p>
          )}

          {(canAudit || isAudited) && prophecy && (
            <div className="card" style={{ marginTop: "0.75rem" }}>
              <h3>{t("prophet.auditSection")}</h3>
              <dl className="meta">
                <dt>{t("prophet.oracleResult")}</dt>
                <dd>
                  {resolvedValue != null ? (
                    <code>{resolvedValue}</code>
                  ) : (
                    t("prophet.pendingSettlement")
                  )}
                </dd>
                <dt>{t("prophet.predictedValueLabel")}</dt>
                <dd>
                  <code>
                    {formatProphecyPrediction(
                      prophecy,
                      market?.kind,
                      t("prophet.predictionHidden"),
                    )}
                  </code>
                </dd>
                <dt>{t("prophet.escrowTotal")}</dt>
                <dd>
                  {settlementPreview
                    ? t("prophet.escrowDetail", {
                        total: formatUsdcBaseUnits(settlementPreview.escrowTotal),
                        count: prophecy.unlockCount,
                      })
                    : t("common.dash")}
                </dd>
                <dt>{t("prophet.protocolFee")}</dt>
                <dd>{(protocolFeeBps / 100).toFixed(1)}%</dd>
              </dl>

              {isAudited && settlementPreview && (
                <dl className="meta">
                  <dt>{t("prophet.auditResult")}</dt>
                  <dd>{localizedProphecyStatus(prophecy.status, t)}</dd>
                  {prophecy.status === PROPHECY_STATUS_CHEAT ? (
                    <>
                      <dt>{t("prophet.buyerRefund")}</dt>
                      <dd>
                        {t("prophet.refundEach", {
                          amount: formatUsdcBaseUnits(
                            computeBuyerRefundPerBuyer(
                              settlementPreview.escrowTotal,
                              prophecy.paidBuyers.length,
                            ),
                          ),
                        })}
                      </dd>
                    </>
                  ) : (
                    <>
                      <dt>{t("prophet.protocolRevenue")}</dt>
                      <dd>
                        {formatUsdcBaseUnits(settlementPreview.protocolFee)} USDC
                        → Registry treasury
                      </dd>
                      <dt>{t("prophet.prophetPayout")}</dt>
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
                      {t("prophet.hashCheck", {
                        result: hashVerification.ok
                          ? t("prophet.hashPass")
                          : localizedProphecyVerifyReason(
                              hashVerification.reasonKey,
                              t,
                            ),
                      })}
                    </p>
                  )}
                  {auditPreview && hashVerification?.ok && (
                    <p className="hint">
                      {t("prophet.auditPreview", {
                        outcome: localizedAuditOutcome(auditPreview.outcome, t),
                      })}
                      {auditPreview.outcome === "win" &&
                        auditPreview.precisionBps != null && (
                          <>
                            {t("prophet.precisionContrib", {
                              bps: formatScorePercent(auditPreview.precisionBps),
                              width: prophecyIntervalWidth(prophecy),
                            })}
                          </>
                        )}
                      {settlementPreview && auditPreview.outcome !== "cheat" && (
                        <>
                          {t("prophet.splitPreview", {
                            prophet: formatUsdcBaseUnits(settlementPreview.prophetPayout),
                            protocol: formatUsdcBaseUnits(settlementPreview.protocolFee),
                          })}
                        </>
                      )}
                    </p>
                  )}
                  <label>{t("prophet.auditPlaintext")}</label>
                  <textarea
                    rows={3}
                    value={storedPlaintext}
                    onChange={(e) => setStoredPlaintext(e.target.value)}
                    placeholder={t("prophet.auditPlaintextPlaceholder")}
                  />
                  <div className="btn-row">
                    <button
                      type="button"
                      className="primary"
                      disabled={isPending || !storedPlaintext.trim()}
                      onClick={onAudit}
                    >
                      {t("prophet.auditBtn")}
                    </button>
                    {canReadContent && !decrypted && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={decrypting}
                        onClick={() => void runDecrypt(prophecy)}
                      >
                        {t("prophet.decryptFirst")}
                      </button>
                    )}
                  </div>
                </>
              )}

              {prophetStats && (
                <dl className="meta">
                  <dt>{t("prophet.prophetStats")}</dt>
                  <dd>
                    {t("prophet.winsLosses", {
                      wins: prophetStats.wins,
                      losses: prophetStats.losses,
                    })}
                    {prophetStats.cheats > 0 &&
                      t("prophet.cheats", { n: prophetStats.cheats })}
                  </dd>
                  <dt>{t("prophet.winRate")}</dt>
                  <dd>{formatAccuracyPercent(prophetStats)}</dd>
                  <dt>{t("prophet.streak")}</dt>
                  <dd>
                    {t("prophet.streakDetail", {
                      current: prophetStats.currentStreak,
                      max: prophetStats.maxStreak,
                    })}
                  </dd>
                  <dt>Prophet Score</dt>
                  <dd>{formatScorePercent(prophetStats.scoreBps)} / 100</dd>
                  <dt>{t("prophet.unlockRevenue")}</dt>
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
        <h2>{t("prophet.statsSection")}</h2>
        <p className="hint">
          {t("prophet.statsHint")}{" "}
          <Link href="/leaderboard">{t("nav.leaderboard")}</Link>.
        </p>
      </div>

      {msg && <p className="msg">{msg}</p>}
    </div>
  );
}
