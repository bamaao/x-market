/** Phase 1 Testnet 种子市场（PRD §6） */
export type MarketKind = "poisson" | "dirichlet" | "normal";

export interface SeedMarket {
  id: string;
  title: string;
  description: string;
  kind: MarketKind;
  /** `create_*` 参数说明 */
  params: Record<string, string | number>;
}

const poolPoisson = process.env.NEXT_PUBLIC_POOL_POISSON ?? "";
const poolDirichlet = process.env.NEXT_PUBLIC_POOL_DIRICHLET ?? "";
const poolNormal = process.env.NEXT_PUBLIC_POOL_NORMAL ?? "";

export const SEED_MARKETS: SeedMarket[] = [
  {
    id: "poisson-goals",
    title: "足球总进球 · Poisson",
    description: "λ≈2.5，区间 [2,3] 与大球尾部；链上 Tier-1 Poisson PMF。",
    kind: "poisson",
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
    params: {
      mu_tenths: 25,
      sigma_tenths: 4,
      fee_bps: 30,
      poolId: poolNormal,
    },
  },
];

export function defaultPoolId(marketId: string): string {
  const m = SEED_MARKETS.find((x) => x.id === marketId);
  const id = m?.params.poolId;
  return typeof id === "string" ? id : "";
}

export const PACKAGE_ID =
  process.env.NEXT_PUBLIC_PACKAGE_ID ?? "0x0";
export const GLOBAL_CONFIG_ID =
  process.env.NEXT_PUBLIC_GLOBAL_CONFIG ?? "";
export const NETWORK =
  (process.env.NEXT_PUBLIC_SUI_NETWORK as "testnet" | "devnet" | "mainnet") ??
  "testnet";
