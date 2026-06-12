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
  validateCreateMarketParams,
  type CreateMarketParams,
} from "@/lib/create-market";
import { saveUserMarket } from "@/lib/market-catalog";
import { registerMarketMetadata } from "@/lib/indexer";
import { PACKAGE_ID, type MarketKind } from "@/lib/markets";
import {
  extractCreatedObjectIdFromTx,
  ORACLE_CONFIG_ID,
  resolveFeedRegistryId,
} from "@/lib/oracle";
import { uploadBlobToWalrus } from "@/lib/walrus";
import { MarketTagPicker } from "@/components/MarketTagList";
import { catalogTagsForPicker, normalizeTagSlugs } from "@/lib/market-tags";
import { fetchIndexerTags, indexerEnabled } from "@/lib/indexer";

const KIND_OPTIONS: { value: MarketKind; label: string }[] = [
  { value: "poisson", label: "Poisson" },
  { value: "dirichlet", label: "Dirichlet" },
  { value: "normal", label: "Normal" },
  { value: "beta", label: "Beta" },
];

function defaultMaturityLocal(): string {
  const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function CreateMarketPage() {
  const router = useRouter();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [kind, setKind] = useState<MarketKind>("poisson");
  const [maturityLocal, setMaturityLocal] = useState(defaultMaturityLocal);
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

  const effectiveSlug = slug.trim() || slugifyTitle(title);
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
      maturityTs: Math.floor(new Date(maturityLocal).getTime() / 1000),
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
      maturityLocal,
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
      setStatus("请先连接钱包");
      return;
    }
    const err = validateCreateMarketParams(params);
    if (err) {
      setStatus(err);
      return;
    }

    try {
      setStatus(null);
      let imageRef: string | undefined;

      if (coverFile) {
        setStep("upload");
        setStatus("正在上传封面到 Walrus…");
        const bytes = new Uint8Array(await coverFile.arrayBuffer());
        const blobId = await uploadBlobToWalrus(bytes);
        imageRef = `walrus:${blobId}`;
        setStatus(`封面上传成功 · ${blobId.slice(0, 12)}…`);
      }

      setStep("chain");
      setStatus("正在创建链上 Pool 与 Oracle Feed…");

      const registryId = await resolveFeedRegistryId(client, ORACLE_CONFIG_ID);
      if (!registryId) {
        setStatus("无法解析 FeedRegistry，请检查 Oracle 配置");
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
                setStatus("交易已提交但未返回 digest");
                setStep("idle");
                return;
              }
              const poolId = await extractCreatedObjectIdFromTx(
                client,
                result.digest,
                MARKET_POOL_TYPE,
              );
              if (!poolId) {
                setStatus(
                  `Pool 已创建但未能解析对象 ID，请在浏览器查看交易: ${result.digest.slice(0, 18)}…`,
                );
                setStep("idle");
                return;
              }

              setStep("register");
              setStatus("正在注册市场元数据…");

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
                lambda_tenths:
                  params.kind === "poisson" ? (params.lambdaTenths ?? null) : null,
                mu_tenths: params.kind === "normal" ? (params.muTenths ?? null) : null,
                sigma_tenths:
                  params.kind === "normal" ? (params.sigmaTenths ?? null) : null,
                tags: params.tags,
              });

              if (!reg.ok) {
                setStatus(
                  `链上市场已创建（Pool ${poolId.slice(0, 10)}…），Indexer 注册失败: ${reg.error ?? "未知错误"}（已保存到本地）`,
                );
              } else {
                setStatus(`市场创建成功 · Pool ${poolId.slice(0, 10)}…`);
              }

              router.push(`/markets/${params.slug}`);
            } catch (e) {
              setStatus(`后续处理失败: ${e instanceof Error ? e.message : String(e)}`);
              setStep("idle");
            }
          },
          onError: (e) => {
            setStatus(`链上创建失败: ${e.message}`);
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
        <h1>创建市场</h1>
        <p className="sub">
          链上创建 Pool 并自动注册 Oracle Feed；封面可选上传至 Walrus，元数据同步 Indexer（或本地缓存）。
        </p>
      </div>

      {!ORACLE_CONFIG_ID && (
        <p className="hint" style={{ color: "var(--warn, #c9a227)" }}>
          未配置 <code className="mono">NEXT_PUBLIC_ORACLE_CONFIG_ID</code>，无法创建市场。
        </p>
      )}

      <div className="create-market-layout">
        <div className="card create-market-form">
          <h2>基本信息</h2>
          <label htmlFor="title">标题</label>
          <input
            id="title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="例如：今晚欧冠总进球"
            maxLength={120}
          />

          <label htmlFor="description">描述</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="市场规则、结算口径与数据来源说明"
            rows={4}
            style={{ maxWidth: "100%" }}
          />

          <label htmlFor="slug">Slug（URL）</label>
          <input
            id="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder={effectiveSlug || "auto-from-title"}
          />
          <p className="hint">访问路径：/markets/{effectiveSlug || "…"}</p>

          <label>主题（可多选）</label>
          <MarketTagPicker
            selected={selectedTags}
            onChange={setSelectedTags}
            options={tagOptions}
          />
          <p className="hint">主题用于发现与筛选，与分布类型（kind）无关；可多选。</p>

          <label htmlFor="kind">分布类型</label>
          <select
            id="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as MarketKind)}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label htmlFor="maturity">到期时间</label>
          <input
            id="maturity"
            type="datetime-local"
            value={maturityLocal}
            onChange={(e) => setMaturityLocal(e.target.value)}
          />

          <label htmlFor="fee">交易费率（bps）</label>
          <input
            id="fee"
            type="number"
            min={0}
            max={500}
            value={feeBps}
            onChange={(e) => setFeeBps(e.target.value)}
          />

          <h2 style={{ marginTop: "1.5rem" }}>Oracle Feed</h2>
          <label htmlFor="feedId">Feed 标识</label>
          <input
            id="feedId"
            value={feedIdentifier}
            onChange={(e) => setFeedIdentifier(e.target.value)}
            placeholder={effectiveFeedId || "默认与 slug 相同"}
          />

          <label htmlFor="ancillary">辅助说明（Ancillary）</label>
          <textarea
            id="ancillary"
            value={ancillaryText}
            onChange={(e) => setAncillaryText(e.target.value)}
            placeholder="可选，默认使用市场描述"
            rows={2}
            style={{ maxWidth: "100%" }}
          />

          <h2 style={{ marginTop: "1.5rem" }}>池参数</h2>
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

          <h2 style={{ marginTop: "1.5rem" }}>封面（可选）</h2>
          <label htmlFor="cover">上传图片 · Walrus</label>
          <input
            id="cover"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => onCoverChange(e.target.files?.[0] ?? null)}
            style={{ maxWidth: "100%" }}
          />
          <p className="hint">建议 16:9，PNG/JPEG/WebP/SVG，最大约 2MB</p>

          {validationError && (
            <p className="hint" style={{ color: "var(--warn, #c9a227)" }}>
              {validationError}
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
                  ? "上传中…"
                  : step === "chain"
                    ? "签名中…"
                    : step === "register"
                      ? "注册中…"
                      : "处理中…"
                : "创建市场"}
            </button>
            <Link href="/" className="hero-link secondary">
              取消
            </Link>
          </div>

          {status && <p className="hint" style={{ marginTop: "1rem" }}>{status}</p>}
        </div>

        <div className="card create-market-preview">
          <h2>预览</h2>
          <div className="market-cover market-cover--card" style={{ position: "relative", minHeight: 140 }}>
            {previewCoverSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewCoverSrc} alt="封面预览" className="market-cover-img" />
            ) : (
              <div className="market-cover-fallback" />
            )}
          </div>
          <span className={`badge badge-${kind}`}>{kind}</span>
          <h3 style={{ marginTop: "0.75rem" }}>{title.trim() || "市场标题"}</h3>
          <p>{description.trim() || "市场描述将显示在这里。"}</p>
          <p className="hint">
            Feed: <code className="mono">{effectiveFeedId || "—"}</code>
          </p>
          {coverPreview && coverFile && (
            <p className="hint">Walrus 上传后将存为 walrus:{"{blobId}"}</p>
          )}
        </div>
      </div>
    </>
  );
}
