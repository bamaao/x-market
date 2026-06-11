import { Transaction } from "@mysten/sui/transactions";
import type { MarketKind } from "./markets";
import { PACKAGE_ID } from "./markets";
import {
  appendCreatePoissonPoolWithFeed,
  ORACLE_CONFIG_ID,
} from "./oracle";

export const MARKET_POOL_TYPE = `${PACKAGE_ID}::market_pool::MarketPool`;

export type LaunchMode = "trading";

export interface CreateMarketParams {
  title: string;
  description: string;
  slug: string;
  kind: MarketKind;
  maturityTs: number;
  feeBps: number;
  feedIdentifier: string;
  ancillaryText: string;
  lambdaTenths?: number;
  alpha0?: number;
  alpha1?: number;
  alpha2?: number;
  muTenths?: number;
  sigmaTenths?: number;
  betaAlpha?: number;
  betaBeta?: number;
}

export function slugifyTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || `market-${Date.now().toString(36)}`;
}

export function textToBytes(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

export function validateCreateMarketParams(p: CreateMarketParams): string | null {
  if (!p.title.trim()) return "请填写市场标题";
  if (!p.slug.trim()) return "请填写 slug";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)) {
    return "slug 仅允许小写字母、数字与连字符";
  }
  if (p.maturityTs <= Math.floor(Date.now() / 1000) + 3600) {
    return "到期时间须至少 1 小时后";
  }
  if (p.feeBps < 0 || p.feeBps > 500) return "费率须在 0–500 bps";
  if (!p.feedIdentifier.trim()) return "请填写 Oracle Feed 标识";
  if (!ORACLE_CONFIG_ID) return "未配置 NEXT_PUBLIC_ORACLE_CONFIG_ID";

  switch (p.kind) {
    case "poisson":
      if ((p.lambdaTenths ?? 0) <= 0 || (p.lambdaTenths ?? 0) > 80) {
        return "Poisson λ（tenths）须在 1–80";
      }
      break;
    case "dirichlet":
      if ([p.alpha0, p.alpha1, p.alpha2].some((v) => (v ?? 0) <= 0)) {
        return "Dirichlet α 须为正整数";
      }
      break;
    case "normal":
      if ((p.sigmaTenths ?? 0) <= 0) return "Normal σ（tenths）须 > 0";
      break;
    case "beta":
      if ((p.betaAlpha ?? 0) <= 0 || (p.betaBeta ?? 0) <= 0) {
        return "Beta α/β 须为正整数";
      }
      break;
  }
  return null;
}

export function appendCreateMarketPoolWithFeed(
  tx: Transaction,
  oracleConfigId: string,
  registryId: string,
  params: CreateMarketParams,
): void {
  const identifier = textToBytes(params.feedIdentifier.trim());
  const ancillary = textToBytes(params.ancillaryText.trim() || params.description.trim());
  const maturity = BigInt(params.maturityTs);
  const fee = params.feeBps;

  switch (params.kind) {
    case "poisson":
      appendCreatePoissonPoolWithFeed(
        tx,
        oracleConfigId,
        registryId,
        params.lambdaTenths ?? 25,
        maturity,
        fee,
        identifier,
        ancillary,
      );
      break;
    case "dirichlet":
      tx.moveCall({
        target: `${PACKAGE_ID}::pool::create_dirichlet_pool_with_feed`,
        arguments: [
          tx.object(oracleConfigId),
          tx.object(registryId),
          tx.pure.u32(params.alpha0 ?? 10),
          tx.pure.u32(params.alpha1 ?? 10),
          tx.pure.u32(params.alpha2 ?? 10),
          tx.pure.u64(maturity),
          tx.pure.u16(fee),
          tx.pure.vector("u8", identifier),
          tx.pure.vector("u8", ancillary),
        ],
      });
      break;
    case "normal":
      tx.moveCall({
        target: `${PACKAGE_ID}::pool::create_normal_pool_with_feed`,
        arguments: [
          tx.object(oracleConfigId),
          tx.object(registryId),
          tx.pure.u32(params.muTenths ?? 25),
          tx.pure.u32(params.sigmaTenths ?? 4),
          tx.pure.u64(maturity),
          tx.pure.u16(fee),
          tx.pure.vector("u8", identifier),
          tx.pure.vector("u8", ancillary),
        ],
      });
      break;
    case "beta":
      tx.moveCall({
        target: `${PACKAGE_ID}::pool::create_beta_pool_with_feed`,
        arguments: [
          tx.object(oracleConfigId),
          tx.object(registryId),
          tx.pure.u32(params.betaAlpha ?? 10),
          tx.pure.u32(params.betaBeta ?? 10),
          tx.pure.u64(maturity),
          tx.pure.u16(fee),
          tx.pure.vector("u8", identifier),
          tx.pure.vector("u8", ancillary),
        ],
      });
      break;
  }
}

export function paramsToSeedMarket(
  params: CreateMarketParams,
  poolId: string,
  imageUrl?: string,
): import("./markets").SeedMarket {
  const base = {
    id: params.slug,
    title: params.title.trim(),
    description: params.description.trim(),
    kind: params.kind,
    imageUrl,
    params: {
      poolId,
      fee_bps: params.feeBps,
    } as Record<string, string | number>,
  };
  switch (params.kind) {
    case "poisson":
      base.params.lambda_tenths = params.lambdaTenths ?? 25;
      break;
    case "dirichlet":
      base.params.alpha0 = params.alpha0 ?? 10;
      base.params.alpha1 = params.alpha1 ?? 10;
      base.params.alpha2 = params.alpha2 ?? 10;
      break;
    case "normal":
      base.params.mu_tenths = params.muTenths ?? 25;
      base.params.sigma_tenths = params.sigmaTenths ?? 4;
      break;
    case "beta":
      base.params.alpha = params.betaAlpha ?? 10;
      base.params.beta = params.betaBeta ?? 10;
      break;
  }
  return base;
}
