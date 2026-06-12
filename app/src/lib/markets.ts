import { MARKET_COVER_BY_ID, resolveMarketImageUrl } from "./market-media";
import { tagsForSeedMarket } from "./market-tags";
import type { MarketRef } from "./position-display";

/** Phase 1 Testnet 种子市场（PRD §6） */
export type MarketKind = "poisson" | "dirichlet" | "normal" | "beta";

export interface SeedMarket {
  id: string;
  title: string;
  description: string;
  kind: MarketKind;
  /** CDN / public path cover (P2 off-chain metadata) */
  imageUrl?: string;
  /** Off-chain theme tags (P4) */
  tags?: string[];
  /** `create_*` 参数说明 */
  params: Record<string, string | number>;
}

const poolPoisson = process.env.NEXT_PUBLIC_POOL_POISSON ?? "";
const poolDirichlet = process.env.NEXT_PUBLIC_POOL_DIRICHLET ?? "";
const poolNormal = process.env.NEXT_PUBLIC_POOL_NORMAL ?? "";
const poolBeta = process.env.NEXT_PUBLIC_POOL_BETA ?? "";

export const SEED_MARKETS: SeedMarket[] = [
  {
    id: "poisson-goals",
    title: "足球总进球 · Poisson",
    description: "λ≈2.5，区间 [2,3] 与大球尾部；链上 Tier-1 Poisson PMF。",
    kind: "poisson",
    imageUrl: MARKET_COVER_BY_ID["poisson-goals"],
    tags: tagsForSeedMarket("poisson-goals"),
    params: {
      lambda_tenths: 25,
      fee_bps: 30,
      poolId: poolPoisson,
    },
  },
  {
    id: "dirichlet-wdl",
    title: "胜平负 · Dirichlet",
    description: "三分类先验 α=[10,10,10]；买入主胜/平局/客胜。",
    kind: "dirichlet",
    imageUrl: MARKET_COVER_BY_ID["dirichlet-wdl"],
    tags: tagsForSeedMarket("dirichlet-wdl"),
    params: {
      alpha0: 10,
      alpha1: 10,
      alpha2: 10,
      fee_bps: 30,
      poolId: poolDirichlet,
    },
  },
  {
    id: "normal-cpi",
    title: "CPI 区间 · Normal",
    description: "μ=2.5%、σ=0.4%（tenths）；宏观区间与数字期权。",
    kind: "normal",
    imageUrl: MARKET_COVER_BY_ID["normal-cpi"],
    tags: tagsForSeedMarket("normal-cpi"),
    params: {
      mu_tenths: 25,
      sigma_tenths: 4,
      fee_bps: 30,
      poolId: poolNormal,
    },
  },
  {
    id: "beta-vote",
    title: "得票率 · Beta",
    description: "α=β=10 先验；链上 Beta CDF 区间买入（如 35%–40%）。",
    kind: "beta",
    imageUrl: MARKET_COVER_BY_ID["beta-vote"],
    tags: tagsForSeedMarket("beta-vote"),
    params: {
      alpha: 10,
      beta: 10,
      fee_bps: 30,
      poolId: poolBeta,
    },
  },
];

export function defaultPoolId(marketOrId: string | SeedMarket): string {
  if (typeof marketOrId === "object") {
    const direct = marketOrId.params.poolId;
    if (typeof direct === "string" && direct) return direct;
    marketOrId = marketOrId.id;
  }
  const m = SEED_MARKETS.find((x) => x.id === marketOrId);
  const id = m?.params.poolId;
  return typeof id === "string" ? id : "";
}

/** Map Indexer row → frontend seed market (incl. cover). */
export function indexerMarketToSeed(m: {
  pool_id: string;
  slug: string | null;
  title: string;
  description: string;
  kind: string;
  image_url?: string | null;
  tags?: string[] | null;
  fee_bps: number;
  lambda_tenths?: number | null;
  mu_tenths?: number | null;
  sigma_tenths?: number | null;
}): SeedMarket {
  const id = m.slug ?? m.pool_id;
  return {
    id,
    title: m.title,
    description: m.description,
    kind: m.kind as MarketKind,
    imageUrl: resolveMarketImageUrl({
      id,
      slug: m.slug,
      imageUrl: m.image_url,
    }),
    tags: tagsForSeedMarket(id, m.tags),
    params: {
      poolId: m.pool_id,
      fee_bps: m.fee_bps,
      ...(m.lambda_tenths != null ? { lambda_tenths: m.lambda_tenths } : {}),
      ...(m.mu_tenths != null ? { mu_tenths: m.mu_tenths } : {}),
      ...(m.sigma_tenths != null ? { sigma_tenths: m.sigma_tenths } : {}),
    },
  };
}

export function indexerMarketToRef(m: {
  pool_id: string;
  slug: string | null;
  title: string;
  description: string;
  kind: string;
  image_url?: string | null;
}): MarketRef {
  const id = m.slug ?? m.pool_id;
  return {
    id,
    title: m.title,
    description: m.description,
    kind: m.kind as MarketKind,
    poolId: m.pool_id,
    imageUrl: resolveMarketImageUrl({
      id,
      slug: m.slug,
      imageUrl: m.image_url,
    }),
  };
}

export const PACKAGE_ID =
  process.env.NEXT_PUBLIC_PACKAGE_ID ?? "0x0";
export const GLOBAL_CONFIG_ID =
  process.env.NEXT_PUBLIC_GLOBAL_CONFIG ?? "";
export const NETWORK =
  (process.env.NEXT_PUBLIC_SUI_NETWORK as "testnet" | "devnet" | "mainnet") ??
  "testnet";
