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

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import {
  appendCreateMarketPoolWithFeed,
  MARKET_POOL_TYPE,
  paramsToSeedMarket,
  slugifyTitle,
  supportsOpeningAuction,
  validateCreateMarketParams,
  type CreateMarketParams,
  type LaunchMode,
} from "@/lib/create-market";
import { sanitizeSlug } from "@/lib/market-slug";
import {
  defaultAuctionEndZonedInput,
  defaultMaturityZonedInput,
  detectUserTimezone,
  parseZonedDatetimeInput,
} from "@/lib/market-maturity-time";
import { MaturityTimeField } from "@/components/MaturityTimeField";
import { saveUserMarket } from "@/lib/market-catalog";
import {
  fetchIndexerTags,
  indexerEnabled,
  registerMarketMetadata,
} from "@/lib/indexer";
import { uploadMarketCover } from "@/lib/market-cover-upload";
import { PACKAGE_ID, type MarketKind } from "@/lib/markets";
import {
  extractCreatedObjectIdFromTx,
  ORACLE_CONFIG_ID,
  resolveFeedRegistryId,
} from "@/lib/oracle";
import { MarketTagPicker } from "@/components/MarketTagList";
import { catalogTagsForPicker, normalizeTagSlugs } from "@/lib/market-tags";
import { localizeLibMessage } from "@/i18n/core";
import { useT } from "@/i18n/context";

const KIND_OPTIONS: { value: MarketKind; label: string }[] = [
  { value: "poisson", label: "Poisson" },
  { value: "dirichlet", label: "Dirichlet" },
  { value: "normal", label: "Normal" },
  { value: "beta", label: "Beta" },
];

export default function CreateMarketPage() {
  const t = useT();
  const router = useRouter();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showObjectChanges: true,
        },
      }),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [kind, setKind] = useState<MarketKind>("poisson");
  const [launchMode, setLaunchMode] = useState<LaunchMode>("auction");
  const userTimezone = useMemo(() => detectUserTimezone(), []);
  const [maturityTs, setMaturityTs] = useState(() =>
    parseZonedDatetimeInput(
      defaultMaturityZonedInput(userTimezone),
      userTimezone,
    ),
  );
  const [auctionEndTs, setAuctionEndTs] = useState(() =>
    parseZonedDatetimeInput(
      defaultAuctionEndZonedInput(userTimezone),
      userTimezone,
    ),
  );
  const [feeBps, setFeeBps] = useState("30");
  const [feedIdentifier, setFeedIdentifier] = useState("");
  const [ancillaryText, setAncillaryText] = useState("");
  const [lambdaTenths, setLambdaTenths] = useState("25");
  const [alpha0, setAlpha0] = useState("10");
  const [alpha1, setAlpha1] = useState("10");
  const [alpha2, setAlpha2] = useState("10");
  const [muTenths, setMuTenths] = useState("25");
  const [sigmaTenths, setSigmaTenths] = useState("4");
  const [betaAlpha, setBetaAlpha] = useState("10");
  const [betaBeta, setBetaBeta] = useState("10");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagOptions, setTagOptions] = useState(catalogTagsForPicker());
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "upload" | "chain" | "register">("idle");

  const effectiveSlug = sanitizeSlug(slug) || slugifyTitle(title);
  const effectiveFeedId = feedIdentifier.trim() || effectiveSlug;

  useEffect(() => {
    if (!indexerEnabled()) return;
    void fetchIndexerTags().then((rows) => {
      if (rows.length) {
        setTagOptions(
          rows.map((t) => ({ slug: t.slug, label: t.label })),
        );
      }
    });
  }, []);

  const params: CreateMarketParams = useMemo(
    () => ({
      title,
      description,
      slug: effectiveSlug,
      kind,
      launchMode,
      maturityTs,
      auctionEndTs: launchMode === "auction" ? auctionEndTs : undefined,
      feeBps: Number(feeBps || "30"),
      feedIdentifier: effectiveFeedId,
      ancillaryText: ancillaryText.trim() || description.trim(),
      lambdaTenths: Number(lambdaTenths),
      alpha0: Number(alpha0),
      alpha1: Number(alpha1),
      alpha2: Number(alpha2),
      muTenths: Number(muTenths),
      sigmaTenths: Number(sigmaTenths),
      betaAlpha: Number(betaAlpha),
      betaBeta: Number(betaBeta),
      tags: normalizeTagSlugs(selectedTags),
    }),
    [
      title,
      description,
      effectiveSlug,
      kind,
      launchMode,
      maturityTs,
      auctionEndTs,
      feeBps,
      effectiveFeedId,
      ancillaryText,
      lambdaTenths,
      alpha0,
      alpha1,
      alpha2,
      muTenths,
      sigmaTenths,
      betaAlpha,
      betaBeta,
      selectedTags,
    ],
  );

  const kindOptions = useMemo(
    () =>
      launchMode === "auction"
        ? KIND_OPTIONS.filter((o) => supportsOpeningAuction(o.value))
        : KIND_OPTIONS,
    [launchMode],
  );

  const validationError = validateCreateMarketParams(params);

  const onTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugifyTitle(value));
    if (!feedIdentifier) setFeedIdentifier(slugifyTitle(value));
  };

  const onCoverChange = (file: File | null) => {
    setCoverFile(file);
    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  };

  const submit = async () => {
    if (!account?.address) {
      setStatus(t("common.connectWallet"));
      return;
    }
    const err = validateCreateMarketParams(params);
    if (err) {
      setStatus(t(err));
      return;
    }

    try {
      setStatus(null);
      let imageRef: string | undefined;

      if (coverFile) {
        if (!indexerEnabled()) {
          setStatus(t("createMarket.errCoverIndexer"));
          return;
        }
        setStep("upload");
        setStatus(t("createMarket.uploadingCover"));
        const uploaded = await uploadMarketCover(coverFile, params.slug);
        if (!uploaded.ok) {
          setStatus(
            t("createMarket.coverUploadFailed", {
              error: localizeLibMessage(uploaded.error, t),
            }),
          );
          setStep("idle");
          return;
        }
        imageRef = uploaded.imageUrl;
        setStatus(
          uploaded.storage === "ipfs" && uploaded.cid
            ? t("createMarket.coverUploadSuccessIpfs", { cid: uploaded.cid.slice(0, 14) })
            : t("createMarket.coverUploadSuccess", {
                name: uploaded.imageUrl.split("/").pop() ?? "",
              }),
        );
      }

      setStep("chain");
      setStatus(
        params.launchMode === "auction"
          ? t("createMarket.creatingAuctionPool")
          : t("createMarket.creatingPool"),
      );

      const registryId = await resolveFeedRegistryId(client, ORACLE_CONFIG_ID);
      if (!registryId) {
        setStatus(t("createMarket.errFeedRegistry"));
        setStep("idle");
        return;
      }

      const tx = new Transaction();
      appendCreateMarketPoolWithFeed(tx, ORACLE_CONFIG_ID, registryId, params);

      signAndExecute(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { transaction: tx as any },
        {
          onSuccess: async (result) => {
            try {
              if (!result.digest) {
                setStatus(t("createMarket.errNoDigest"));
                setStep("idle");
                return;
              }
              const poolId = await extractCreatedObjectIdFromTx(
                client,
                result.digest,
                MARKET_POOL_TYPE,
                result.objectChanges,
              );
              if (!poolId) {
                setStatus(t("createMarket.errPoolIdParse", { digest: result.digest.slice(0, 18) }));
                setStep("idle");
                return;
              }

              setStep("register");
              setStatus(t("createMarket.registeringMeta"));

              const seed = paramsToSeedMarket(params, poolId, imageRef);
              saveUserMarket(seed);

              const reg = await registerMarketMetadata({
                pool_id: poolId,
                slug: params.slug,
                title: params.title.trim(),
                description: params.description.trim(),
                kind: params.kind,
                image_url: imageRef ?? null,
                fee_bps: params.feeBps,
                maturity_ts: params.maturityTs,
                package_id: PACKAGE_ID,
                authority: account.address,
                launch_mode: params.launchMode,
                auction_end_ts:
                  params.launchMode === "auction" ? (params.auctionEndTs ?? null) : null,
                lambda_tenths:
                  params.kind === "poisson" && params.launchMode === "trading"
                    ? (params.lambdaTenths ?? null)
                    : null,
                mu_tenths:
                  params.kind === "normal" && params.launchMode === "trading"
                    ? (params.muTenths ?? null)
                    : null,
                sigma_tenths:
                  params.kind === "normal" && params.launchMode === "trading"
                    ? (params.sigmaTenths ?? null)
                    : null,
                tags: params.tags,
              });

              if (!reg.ok) {
                setStatus(
                  t("createMarket.errIndexerPartial", {
                    pool: poolId.slice(0, 10),
                    error: localizeLibMessage(reg.error ?? "", t) || t("common.unknown"),
                  }),
                );
              } else {
                setStatus(
                  params.launchMode === "auction"
                    ? t("createMarket.successAuction", { pool: poolId.slice(0, 10) })
                    : t("createMarket.success", { pool: poolId.slice(0, 10) }),
                );
              }

              router.push(`/markets/${params.slug}`);
            } catch (e) {
              setStatus(
                t("createMarket.errPostProcess", {
                  error: e instanceof Error ? e.message : String(e),
                }),
              );
              setStep("idle");
            }
          },
          onError: (e) => {
            setStatus(t("createMarket.errChain", { message: e.message }));
            setStep("idle");
          },
        },
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
      setStep("idle");
    }
  };

  const previewCoverSrc =
    coverPreview ??
    (coverFile ? undefined : undefined);

  return (
    <>
      <div className="section-head">
        <h1>{t("createMarket.title")}</h1>
        <p className="sub">
          {launchMode === "auction"
            ? t("createMarket.subtitleAuction")
            : t("createMarket.subtitle")}
        </p>
      </div>

      {!ORACLE_CONFIG_ID && (
        <p className="hint" style={{ color: "var(--warn, #c9a227)" }}>
          {t("createMarket.oracleRequired")}
        </p>
      )}

      <div className="create-market-layout">
        <div className="card create-market-form">
          <h2>{t("createMarket.basicInfo")}</h2>
          <label htmlFor="title">{t("createMarket.titleLabel")}</label>
          <input
            id="title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={t("createMarket.titlePlaceholder")}
            maxLength={120}
          />

          <label htmlFor="description">{t("createMarket.descriptionLabel")}</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("createMarket.descriptionPlaceholder")}
            rows={4}
            style={{ maxWidth: "100%" }}
          />

          <label htmlFor="slug">{t("createMarket.slugLabel")}</label>
          <input
            id="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(sanitizeSlug(e.target.value));
            }}
            placeholder={effectiveSlug || "auto-from-title"}
          />
          <p className="hint">{t("createMarket.slugHint", { slug: effectiveSlug || "…" })}</p>

          <label>{t("createMarket.tagsLabel")}</label>
          <MarketTagPicker
            selected={selectedTags}
            onChange={setSelectedTags}
            options={tagOptions}
          />
          <p className="hint">{t("createMarket.tagsHint")}</p>

          <label htmlFor="launchMode">{t("createMarket.launchModeLabel")}</label>
          <select
            id="launchMode"
            value={launchMode}
            onChange={(e) => {
              const next = e.target.value as LaunchMode;
              setLaunchMode(next);
              if (next === "auction" && kind === "beta") setKind("poisson");
            }}
          >
            <option value="auction">{t("createMarket.launchModeAuction")}</option>
            <option value="trading">{t("createMarket.launchModeTrading")}</option>
          </select>
          <p className="hint">
            {launchMode === "auction"
              ? t("createMarket.launchModeAuctionHint")
              : t("createMarket.launchModeTradingHint")}
          </p>

          <label htmlFor="kind">{t("createMarket.kindLabel")}</label>
          <select
            id="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as MarketKind)}
          >
            {kindOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {launchMode === "auction" && (
            <p className="hint">{t("createMarket.kindAuctionHint")}</p>
          )}

          {launchMode === "auction" && (
            <MaturityTimeField
              i18nPrefix="createMarket.auctionEnd"
              idPrefix="auction-end"
              initialLocalValue={defaultAuctionEndZonedInput(userTimezone)}
              onChange={setAuctionEndTs}
            />
          )}

          <MaturityTimeField onChange={setMaturityTs} />

          <label htmlFor="fee">{t("createMarket.feeLabel")}</label>
          <input
            id="fee"
            type="number"
            min={0}
            max={500}
            value={feeBps}
            onChange={(e) => setFeeBps(e.target.value)}
          />

          <h2 style={{ marginTop: "1.5rem" }}>{t("createMarket.oracleFeed")}</h2>
          <label htmlFor="feedId">{t("createMarket.feedIdLabel")}</label>
          <input
            id="feedId"
            value={feedIdentifier}
            onChange={(e) => setFeedIdentifier(e.target.value)}
            placeholder={effectiveFeedId || t("createMarket.feedIdPlaceholder")}
          />

          <label htmlFor="ancillary">{t("createMarket.ancillaryLabel")}</label>
          <textarea
            id="ancillary"
            value={ancillaryText}
            onChange={(e) => setAncillaryText(e.target.value)}
            placeholder={t("createMarket.ancillaryPlaceholder")}
            rows={2}
            style={{ maxWidth: "100%" }}
          />

          {launchMode === "trading" && (
            <>
              <h2 style={{ marginTop: "1.5rem" }}>{t("createMarket.poolParams")}</h2>
              {kind === "poisson" && (
                <>
                  <label htmlFor="lambda">λ（tenths）</label>
                  <input
                    id="lambda"
                    type="number"
                    min={1}
                    max={80}
                    value={lambdaTenths}
                    onChange={(e) => setLambdaTenths(e.target.value)}
                  />
                </>
              )}
              {kind === "dirichlet" && (
                <div className="field-row">
                  <div>
                    <label htmlFor="a0">α₀</label>
                    <input id="a0" type="number" min={1} value={alpha0} onChange={(e) => setAlpha0(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="a1">α₁</label>
                    <input id="a1" type="number" min={1} value={alpha1} onChange={(e) => setAlpha1(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="a2">α₂</label>
                    <input id="a2" type="number" min={1} value={alpha2} onChange={(e) => setAlpha2(e.target.value)} />
                  </div>
                </div>
              )}
              {kind === "normal" && (
                <>
                  <label htmlFor="mu">μ（tenths）</label>
                  <input id="mu" type="number" value={muTenths} onChange={(e) => setMuTenths(e.target.value)} />
                  <label htmlFor="sigma">σ（tenths）</label>
                  <input id="sigma" type="number" min={1} value={sigmaTenths} onChange={(e) => setSigmaTenths(e.target.value)} />
                </>
              )}
              {kind === "beta" && (
                <>
                  <label htmlFor="balpha">α</label>
                  <input id="balpha" type="number" min={1} value={betaAlpha} onChange={(e) => setBetaAlpha(e.target.value)} />
                  <label htmlFor="bbeta">β</label>
                  <input id="bbeta" type="number" min={1} value={betaBeta} onChange={(e) => setBetaBeta(e.target.value)} />
                </>
              )}
            </>
          )}

          {launchMode === "auction" && (
            <p className="hint" style={{ marginTop: "1rem" }}>
              {t("createMarket.auctionParamsHint")}
            </p>
          )}

          <h2 style={{ marginTop: "1.5rem" }}>{t("createMarket.coverSection")}</h2>
          <label htmlFor="cover">{t("createMarket.coverLabel")}</label>
          <input
            id="cover"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => onCoverChange(e.target.files?.[0] ?? null)}
            style={{ maxWidth: "100%" }}
          />
          <p className="hint">{t("createMarket.coverHint")}</p>

          {validationError && (
            <p className="hint" style={{ color: "var(--warn, #c9a227)" }}>
              {t(validationError)}
            </p>
          )}

          <div className="btn-row" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="primary"
              disabled={
                !account ||
                isPending ||
                !!validationError ||
                !ORACLE_CONFIG_ID ||
                step !== "idle"
              }
              onClick={() => void submit()}
            >
              {isPending || step !== "idle"
                ? step === "upload"
                  ? t("createMarket.uploading")
                  : step === "chain"
                    ? t("createMarket.signing")
                    : step === "register"
                      ? t("createMarket.registering")
                      : t("createMarket.processing")
                : launchMode === "auction"
                  ? t("createMarket.submitAuction")
                  : t("createMarket.submit")}
            </button>
            <Link href="/" className="hero-link secondary">
              {t("createMarket.cancel")}
            </Link>
          </div>

          {status && <p className="hint" style={{ marginTop: "1rem" }}>{status}</p>}
        </div>

        <div className="card create-market-preview">
          <h2>{t("createMarket.preview")}</h2>
          <div className="market-cover market-cover--card" style={{ position: "relative", minHeight: 140 }}>
            {previewCoverSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewCoverSrc} alt={t("createMarket.coverPreviewAlt")} className="market-cover-img" />
            ) : (
              <div className="market-cover-fallback" />
            )}
          </div>
          <span className={`badge badge-${kind}`}>{kind}</span>
          <span className="badge" style={{ marginLeft: "0.35rem" }}>
            {launchMode === "auction"
              ? t("createMarket.launchModeAuction")
              : t("createMarket.launchModeTrading")}
          </span>
          <h3 style={{ marginTop: "0.75rem" }}>{title.trim() || t("createMarket.titleFallback")}</h3>
          <p>{description.trim() || t("createMarket.descriptionFallback")}</p>
          <p className="hint">
            Feed: <code className="mono">{effectiveFeedId || "—"}</code>
          </p>
          {coverPreview && coverFile && (
            <p className="hint">{t("createMarket.coverStorageHint")}</p>
          )}
        </div>
      </div>
    </>
  );
}
