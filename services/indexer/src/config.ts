import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const indexerRoot = dirname(fileURLToPath(import.meta.url));

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export interface IndexerConfig {
  packageId: string;
  prophetRegistryId: string;
  oracleConfigId: string;
  databaseUrl: string;
  apiPort: number;
  corsOrigin: string;
  eventPollMs: number;
  snapshotPollMs: number;
  statsPollMs: number;
  marketRegisterSecret: string;
  seedDeploy: {
    seedMarkets: Record<
      string,
      { poolId: string; lambdaTenths?: number; alphas?: number[]; muTenths?: number; sigmaTenths?: number }
    >;
    eventRoots?: Record<
      string,
      {
        eventRootId: string;
        poolId: string;
        feedId?: string;
        eventId?: string;
        lockTime?: number;
      }
    >;
    oracle?: { feedRegistryId?: string };
  } | null;
}

const SEED_META: Record<
  string,
  {
    slug: string;
    title: string;
    description: string;
    kind: "poisson" | "dirichlet" | "normal" | "beta";
    imageUrl: string;
  }
> = {
  poisson_goals: {
    slug: "poisson-goals",
    title: "足球总进球 · Poisson",
    description: "λ≈2.5，区间与大球尾部；链上 Tier-1 Poisson PMF。",
    kind: "poisson",
    imageUrl: "/markets/poisson-goals.svg",
  },
  dirichlet_wdl: {
    slug: "dirichlet-wdl",
    title: "胜平负 · Dirichlet",
    description: "三分类先验；买入主胜/平局/客胜。",
    kind: "dirichlet",
    imageUrl: "/markets/dirichlet-wdl.svg",
  },
  normal_cpi: {
    slug: "normal-cpi",
    title: "CPI 区间 · Normal",
    description: "μ/σ 宏观区间与数字期权。",
    kind: "normal",
    imageUrl: "/markets/normal-cpi.svg",
  },
  beta_vote: {
    slug: "beta-vote",
    title: "得票率 · Beta",
    description: "α=β 先验；链上 Beta CDF 区间买入。",
    kind: "beta",
    imageUrl: "/markets/beta-vote.svg",
  },
};

export function seedMarketMeta(key: string) {
  return SEED_META[key];
}

export function loadConfig(): IndexerConfig {
  const deployPath = resolve(
    indexerRoot,
    "..",
    process.env.SEED_DEPLOY_JSON?.trim() || "../../deploy/testnet-v2.json",
  );
  let seedDeploy: IndexerConfig["seedDeploy"] = null;
  if (existsSync(deployPath)) {
    seedDeploy = JSON.parse(readFileSync(deployPath, "utf8")) as IndexerConfig["seedDeploy"];
  }

  return {
    packageId: requireEnv("X_MARKET_PACKAGE_ID"),
    prophetRegistryId: requireEnv("PROPHET_REGISTRY_ID"),
    oracleConfigId: process.env.ORACLE_CONFIG_ID?.trim() ?? "",
    databaseUrl: requireEnv("INDEXER_DATABASE_URL"),
    apiPort: numEnv("INDEXER_API_PORT", 8800),
    corsOrigin: process.env.INDEXER_CORS_ORIGIN?.trim() ?? "*",
    eventPollMs: numEnv("INDEXER_EVENT_POLL_MS", 15_000),
    snapshotPollMs: numEnv("INDEXER_SNAPSHOT_POLL_MS", 60_000),
    statsPollMs: numEnv("INDEXER_STATS_POLL_MS", 120_000),
    marketRegisterSecret: process.env.MARKET_REGISTER_SECRET?.trim() ?? "",
    seedDeploy,
  };
}
