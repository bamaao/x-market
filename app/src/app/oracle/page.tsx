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
  bytesIdentifier,
  decodeBytes,
  deriveOracleWorkflowStep,
  discoverArbitrationCaseForAssertion,
  discoverFeedForPool,
  extractCreatedObjectIdFromTx,
  livenessRemainingSecs,
  marketKindFromPoolFields,
  normalizePoolObjectId,
  resolveFeedRegistryId,
} from "@/lib/oracle";
import { PACKAGE_ID, type MarketKind } from "@/lib/markets";
import { usdcType } from "@/lib/usdc";
import { ArbitrationCasesPanel } from "@/components/ArbitrationCasesPanel";
import { OracleMarketPicker } from "@/components/OracleMarketPicker";
import { PageHeader } from "@/components/PageHeader";
import { fetchIndexerMarket, fetchIndexerOracleQueue, indexerEnabled } from "@/lib/indexer";
import {
  localizedAssertionStatus,
  localizedClaimedValueHint,
  localizedCountdown,
  localizedFeedStatus,
  localizedFormatUnixTs,
  localizedOracleWorkflowStep,
  localizedVerdictLabel,
} from "@/i18n/domain";
import { useI18n, useT } from "@/i18n/context";

const ARBITRATION_CASE_TYPE = `${PACKAGE_ID}::oracle_arbitrator::ArbitrationCase`;

const FLOW_STEPS = [
  { key: "propose", labelKey: "oracle.flow.propose" },
  { key: "liveness", labelKey: "oracle.flow.liveness" },
  { key: "settle", labelKey: "oracle.flow.settle" },
  { key: "claim", labelKey: "oracle.flow.claim" },
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

function OraclePageFallback() {
  const t = useT();
  return (
    <>
      <PageHeader
        title={t("oracle.pageTitle")}
        subtitle={t("oracle.pageSubtitle")}
      />
      <p className="hint">{t("common.loading")}</p>
    </>
  );
}

export default function OraclePage() {
  return (
    <Suspense fallback={<OraclePageFallback />}>
      <OraclePageInner />
    </Suspense>
  );
}

function OraclePageInner() {
  const t = useT();
  const { locale } = useI18n();
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
  const [nowSec, setNowSec] = useState(0);
  const isUmaDvmAdapter = arbitratorAdapter === ADAPTER_UMA_DVM;

  const marketMeta = marketsWithPool.find((m) => m.poolId === selectedPoolId);
  const poolId = selectedPoolId;

  const applyPool = useCallback(
    (raw: string, updateUrl = true): boolean => {
      const normalized = normalizePoolObjectId(raw);
      if (!normalized) {
        setPoolInputError(t("oracle.invalidPoolId"));
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
    [router, searchParams, t],
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
    setNowSec(Math.floor(Date.now() / 1000));
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
        onError: (e) => setMsg(t("trade.failed", { message: e.message })),
      },
    );
  };

  const splitUsdcBond = async (tx: Transaction, amount: bigint) => {
    if (!account?.address) throw new Error(t("oracle.errConnectWallet"));
    const coins = await client.getCoins({
      owner: account.address,
      coinType: usdcType(),
    });
    if (!coins.data.length) throw new Error(t("oracle.errNoUsdc"));
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
    if (!selectedFeedId || !poolId) return setMsg(t("oracle.errSelectFeed"));
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
            setMsg(t("oracle.proposed", { digest: r.digest?.slice(0, 18) ?? "" }));
            void refetchFeed();
          },
          onError: (e) => setMsg(t("trade.failed", { message: e.message })),
        },
      );
    } catch (e) {
      setMsg(t("trade.failed", { message: e instanceof Error ? e.message : String(e) }));
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
        title={t("oracle.pageTitle")}
        subtitle={t("oracle.pageSubtitle")}
      />

      <div className="oracle-flow" aria-label={t("oracle.flowAria")}>
        {FLOW_STEPS.map((s, i) => {
          const done = i < activeFlowIdx;
          const active = i === activeFlowIdx;
          const settleHint =
            s.key === "settle" && workflowStep === "arbitration"
              ? t("oracle.settleCommitteeHint")
              : s.key === "settle" && workflowStep === "finalize_or_dispute"
                ? t("oracle.settleFinalizeHint")
                : "";
          return (
            <div
              key={s.key}
              className={`oracle-flow-step${active ? " active" : ""}${done ? " done" : ""}`}
            >
              {t(s.labelKey)}
              {settleHint}
            </div>
          );
        })}
      </div>
      <p className="hint">
        {t("oracle.currentStep", {
          step: localizedOracleWorkflowStep(workflowStep, t),
        })}
      </p>

      {!account && <p className="hint">{t("oracle.connectHint")}</p>}

      {!ORACLE_CONFIG_ID && (
        <p className="hint">{t("oracle.configRequired")}</p>
      )}

      <div className="card panel">
        <label htmlFor="oracle-pool-id">{t("oracle.poolIdLabel")}</label>
        <div className="oracle-pool-row">
          <input
            id="oracle-pool-id"
            className="mono"
            value={poolInput}
            placeholder={t("oracle.poolIdPlaceholder")}
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
            {t("oracle.load")}
          </button>
        </div>
        {poolInputError && <p className="hint oracle-pool-error">{poolInputError}</p>}
        <p className="hint">{t("oracle.deeplinkHint")}</p>

        <OracleMarketPicker poolId={poolId} onSelectPool={(id) => applyPool(id)} />

        {selectedPoolId && (
          <p className="hint">
            {t("oracle.currentPool")} <code className="mono">{selectedPoolId}</code>
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
              t("oracle.onChainPool")
            ) : poolId ? (
              t("oracle.querying")
            ) : null}
          </p>
        )}

        <p className="hint">
          {t("oracle.feedLabel")}{" "}
          {feedDiscovering
            ? t("oracle.feedDiscovering")
            : selectedFeedId
              ? `${selectedFeedId.slice(0, 18)}…`
              : t("oracle.feedNotRegistered")}
        </p>

        {!selectedFeedId && selectedPoolId && isPoolAuthority && registryId && (
          <>
            <label>{t("oracle.registerFeedLabel")}</label>
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
                      setMsg(t("oracle.feedRegistered", { digest: r.digest?.slice(0, 18) ?? "" }));
                      void refreshFeedDiscovery();
                    },
                    onError: (e) => setMsg(t("trade.failed", { message: e.message })),
                  },
                );
              }}
            >
              {t("oracle.registerFeedBtn")}
            </button>
          </>
        )}

        {feedSummary && (
          <div className="hint">
            <p>{t("oracle.identifier")}: {feedSummary.identifier || t("common.dash")}</p>
            <p>{t("oracle.status")}: {localizedFeedStatus(feedSummary.status, t)}</p>
            <p>{t("oracle.eventTime")}: {localizedFormatUnixTs(feedSummary.eventTs, locale)}</p>
            <p>{t("oracle.livenessWindow")}: {feedSummary.livenessSecs / 3600}h</p>
            <p>{t("oracle.bondRequired")}: {Number(feedSummary.bondRequired) / 1e6} USDC</p>
            <p>{t("oracle.finalizedValue")}: {feedSummary.finalizedValue}</p>
            <p>
              {t("oracle.poolSettledLabel")}:{" "}
              {poolResolved ? t("oracle.yes") : t("oracle.no")}
            </p>
            {activeAssertionId && (
              <p>
                {t("oracle.activeAssertion")}:{" "}
                <code>{activeAssertionId.slice(0, 16)}…</code>
              </p>
            )}
          </div>
        )}

        <label>
          {t("oracle.proposeResult")}
          {effectiveMarketKind && (
            <span className="hint">
              {" "}
              — {localizedClaimedValueHint(effectiveMarketKind, t)}
            </span>
          )}
        </label>
        <input value={claimedValue} onChange={(e) => setClaimedValue(e.target.value)} />
        <label>{t("oracle.proposeBond")}</label>
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
            {t("oracle.proposeBtn")}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!account || isPending || !selectedFeedId || !canNullify}
            onClick={() =>
              void runTx(
                (tx) => appendNullifyFeed(tx, selectedFeedId),
                t("oracle.nullifiedFeed"),
              )
            }
          >
            {t("oracle.nullifyFeed")}
          </button>
        </div>
      </div>

      <div className="card panel">
        <h2>{t("oracle.disputeSection")}</h2>
        <label>Assertion ID</label>
        <input
          value={assertionId}
          onChange={(e) => setAssertionId(e.target.value)}
          placeholder={activeAssertionId || "0x…"}
        />
        {assertionFields && (
          <p className="hint">
            {t("oracle.assertionLine", {
              status: localizedAssertionStatus(assertionStatus, t),
              value: String(assertionFields.claimed_value ?? t("common.dash")),
              deadline: localizedFormatUnixTs(livenessEnd, locale),
              extra: `${
                assertionStatus === 0
                  ? t("oracle.remaining", {
                      countdown: localizedCountdown(livenessRemain, t),
                    })
                  : ""
              }${canFinalize ? t("oracle.canFinalize") : ""}${
                isInArbitration
                  ? isUmaDvmAdapter
                    ? t("oracle.waitingUma")
                    : t("oracle.waitingCommittee")
                  : ""
              }`,
            })}
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
                          ? t("oracle.disputedWithCase", {
                              case: discovered.slice(0, 18),
                            })
                          : t("oracle.disputedDiscovering", {
                              digest: r.digest?.slice(0, 18) ?? "",
                            }),
                      );
                      void refetchAssertion();
                      void refetchFeed();
                      if (discovered) void refetchCase();
                    },
                    onError: (e) => setMsg(t("trade.failed", { message: e.message })),
                  },
                );
              } catch (e) {
                setMsg(t("trade.failed", { message: e instanceof Error ? e.message : String(e) }));
              }
            }}
          >
            {t("oracle.disputeBtn")}
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
                t("oracle.finalizedMarket"),
              )
            }
          >
            {t("oracle.finalizeBtn")}
          </button>
        </div>
      </div>

      <div className="card panel">
        <h2>{isUmaDvmAdapter ? t("oracle.umaSection") : t("oracle.committeeSection")}</h2>
        <p className="hint">
          {isUmaDvmAdapter ? t("oracle.umaHint") : t("oracle.committeeHint")}
        </p>
        <label>{t("oracle.caseIdLabel")}</label>
        <input
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          placeholder={
            isInArbitration
              ? t("oracle.casePlaceholderAuto")
              : t("oracle.casePlaceholderManual")
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
                } else setMsg(t("oracle.caseNotFound"));
              });
            }}
          >
            {t("oracle.rediscoverCase")}
          </button>
        )}
        {caseFields && (
          <p className="hint">
            {t("oracle.verdictLine", {
              verdict: localizedVerdictLabel(caseVerdict, t),
              value: String(caseFields.resolved_value ?? t("common.dash")),
              approvals: caseApprovals,
              threshold: caseThreshold,
              executed: caseExecuted ? t("oracle.executed") : "",
            })}
          </p>
        )}
        <label>
          {t("oracle.disputerValueLabel")}
          {effectiveMarketKind && (
            <span className="hint">
              {" "}
              — {localizedClaimedValueHint(effectiveMarketKind, t)}
            </span>
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
                t("oracle.proposeProposerWins"),
              )
            }
          >
            {t("oracle.proposeProposerWins")}
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
                t("oracle.proposeDisputerWins"),
              )
            }
          >
            {t("oracle.proposeDisputerWins")}
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
                t("oracle.proposeUnresolved"),
              )
            }
          >
            {t("oracle.proposeUnresolved")}
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
                t("oracle.approveVerdict"),
              )
            }
          >
            {t("oracle.approveVerdict")}
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
                t("oracle.committeeExecuted"),
              )
            }
          >
            {t("oracle.executeArbitration")}
          </button>
        </div>
      </div>

      {poolResolved && (
        <div className="oracle-claim-banner">
          <p>
            {t("oracle.settledBanner")}
            {poolFields?.resolved_value != null && (
              <>
                {t("oracle.settledResult")}{" "}
                <code>{String(poolFields.resolved_value)}</code>
              </>
            )}
            . {t("oracle.claimHint")}
          </p>
          <p style={{ marginTop: "0.75rem" }}>
            <Link href="/positions">{t("oracle.goClaim")}</Link>
          </p>
        </div>
      )}

      {msg && <p className="hint">{msg}</p>}

      <p className="hint">{t("oracle.productHint")}</p>

      <ArbitrationCasesPanel />
    </>
  );
}
