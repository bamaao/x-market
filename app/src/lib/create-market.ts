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

import { Transaction } from "@mysten/sui/transactions";
import type { MarketKind } from "./markets";
import { PACKAGE_ID } from "./markets";
import { isValidSlug } from "./market-slug";
import {
  appendCreatePoissonPoolWithFeed,
  ORACLE_CONFIG_ID,
} from "./oracle";
import { SUI_CLOCK_ID } from "./trade";

export { sanitizeSlug, slugifyTitle } from "./market-slug";

export const MARKET_POOL_TYPE = `${PACKAGE_ID}::market_pool::MarketPool`;

/** Minimum lead time before maturity when creating a market (frontend guard). */
export const MIN_MATURITY_LEAD_SECS = 300;

/** Minimum lead time before auction end (chain requires auction_end_ts > now). */
export const MIN_AUCTION_LEAD_SECS = 60;

export type LaunchMode = "auction" | "trading";

export interface CreateMarketParams {
  title: string;
  description: string;
  slug: string;
  kind: MarketKind;
  launchMode: LaunchMode;
  maturityTs: number;
  auctionEndTs?: number;
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
  tags?: string[];
}

export function supportsOpeningAuction(kind: MarketKind): boolean {
  return kind !== "beta";
}

export function textToBytes(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

export function validateCreateMarketParams(p: CreateMarketParams): string | null {
  if (!p.title.trim()) return "createMarket.validation.titleRequired";
  if (!p.slug.trim()) return "createMarket.validation.slugRequired";
  if (!isValidSlug(p.slug)) {
    return "createMarket.validation.slugFormat";
  }
  if (!Number.isFinite(p.maturityTs) || p.maturityTs <= 0) {
    return "createMarket.validation.maturityRequired";
  }
  if (p.maturityTs <= Math.floor(Date.now() / 1000) + MIN_MATURITY_LEAD_SECS) {
    return "createMarket.validation.maturityMinLead";
  }
  if (p.feeBps < 0 || p.feeBps > 500) return "createMarket.validation.feeRange";
  if (!p.feedIdentifier.trim()) return "createMarket.validation.feedRequired";
  if (!ORACLE_CONFIG_ID) return "createMarket.validation.oracleConfigMissing";

  if (p.launchMode === "auction") {
    if (!supportsOpeningAuction(p.kind)) {
      return "createMarket.validation.betaNoAuction";
    }
    if (!Number.isFinite(p.auctionEndTs) || (p.auctionEndTs ?? 0) <= 0) {
      return "createMarket.validation.auctionEndRequired";
    }
    const now = Math.floor(Date.now() / 1000);
    if ((p.auctionEndTs ?? 0) <= now + MIN_AUCTION_LEAD_SECS) {
      return "createMarket.validation.auctionEndMinLead";
    }
    if ((p.auctionEndTs ?? 0) >= p.maturityTs) {
      return "createMarket.validation.auctionEndBeforeMaturity";
    }
    return null;
  }

  switch (p.kind) {
    case "poisson":
      if ((p.lambdaTenths ?? 0) <= 0 || (p.lambdaTenths ?? 0) > 80) {
        return "createMarket.validation.poissonLambda";
      }
      break;
    case "dirichlet":
      if ([p.alpha0, p.alpha1, p.alpha2].some((v) => (v ?? 0) <= 0)) {
        return "createMarket.validation.dirichletAlpha";
      }
      break;
    case "normal":
      if ((p.sigmaTenths ?? 0) <= 0) return "createMarket.validation.normalSigma";
      break;
    case "beta":
      if ((p.betaAlpha ?? 0) <= 0 || (p.betaBeta ?? 0) <= 0) {
        return "createMarket.validation.betaParams";
      }
      break;
  }
  return null;
}

export function appendStartAuctionPoolWithFeed(
  tx: Transaction,
  oracleConfigId: string,
  registryId: string,
  params: CreateMarketParams,
): void {
  const identifier = textToBytes(params.feedIdentifier.trim());
  const ancillary = textToBytes(params.ancillaryText.trim() || params.description.trim());
  const maturity = BigInt(params.maturityTs);
  const auctionEnd = BigInt(params.auctionEndTs ?? 0);
  const fee = params.feeBps;

  const targetByKind: Record<Exclude<MarketKind, "beta">, string> = {
    poisson: `${PACKAGE_ID}::pool::start_poisson_auction_with_feed`,
    dirichlet: `${PACKAGE_ID}::pool::start_dirichlet_auction_with_feed`,
    normal: `${PACKAGE_ID}::pool::start_normal_auction_with_feed`,
  };

  tx.moveCall({
    target: targetByKind[params.kind as Exclude<MarketKind, "beta">],
    arguments: [
      tx.object(oracleConfigId),
      tx.object(registryId),
      tx.pure.u64(auctionEnd),
      tx.pure.u64(maturity),
      tx.pure.u16(fee),
      tx.pure.vector("u8", identifier),
      tx.pure.vector("u8", ancillary),
      tx.object(SUI_CLOCK_ID),
    ],
  });
}

export function appendCreateMarketPoolWithFeed(
  tx: Transaction,
  oracleConfigId: string,
  registryId: string,
  params: CreateMarketParams,
): void {
  if (params.launchMode === "auction") {
    appendStartAuctionPoolWithFeed(tx, oracleConfigId, registryId, params);
    return;
  }

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
    tags: params.tags?.length ? [...params.tags] : undefined,
    params: {
      poolId,
      fee_bps: params.feeBps,
      launch_mode: params.launchMode,
      ...(params.launchMode === "auction"
        ? { status: 0, auction_end_ts: params.auctionEndTs ?? 0 }
        : { status: 1 }),
    } as Record<string, string | number>,
  };

  if (params.launchMode === "auction") {
    return base;
  }

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
