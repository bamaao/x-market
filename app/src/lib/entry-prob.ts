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

/** Mirrors pricing-engine / on-chain entry probability for buy previews and max-loss checks. */

import type { MarketKind } from "@/lib/markets";
import type { ContractMode } from "@/lib/trade";
import {
  effectiveSigmaTenths,
  type PoolView,
} from "@/lib/position-display";

const PPB = 1_000_000_000n;

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

export function probToPpb(prob: number): bigint {
  const clamped = Math.max(1e-12, Math.min(1 - 1e-12, prob));
  return BigInt(Math.floor(clamped * Number(PPB)));
}

export function poissonPmf(lambda: number, k: number): number {
  if (k < 0) return 0;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

export function poissonIntervalProb(lambda: number, a: number, b: number): number {
  let sum = 0;
  for (let k = a; k <= b; k++) sum += poissonPmf(lambda, k);
  return sum;
}

export function dirichletOutcomeProb(alphas: number[], outcome: number): number {
  const sum = alphas.reduce((s, a) => s + a, 0);
  if (sum <= 0) return 1 / alphas.length;
  return (alphas[outcome] ?? alphas[0]!) / sum;
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax));
  return sign * y;
}

export function normalDigitalProb(
  muTenths: number,
  sigmaTenths: number,
  thresholdTenths: number,
): number {
  const mu = muTenths / 10;
  const sigma = Math.max(0.01, sigmaTenths / 10);
  const t = thresholdTenths / 10;
  const z = (t - mu) / sigma;
  return 0.5 * (1 - erf(z / Math.SQRT2));
}

export interface EntryProbTradeInput {
  marketKind: MarketKind;
  mode: ContractMode;
  pool?: PoolView;
  marketParams: Record<string, string | number>;
  poissonA: number;
  poissonB: number;
  poissonK: number;
  dirichletOutcome: number;
  normalThreshold: number;
}

function resolveLambdaTenths(
  pool: PoolView | undefined,
  marketParams: Record<string, string | number>,
): number {
  if (pool?.lambdaTenths != null && pool.lambdaTenths > 0) {
    return pool.lambdaTenths;
  }
  const seed = marketParams.lambda_tenths;
  return typeof seed === "number" ? seed : Number(seed ?? 25);
}

function resolveDirichletAlphas(
  pool: PoolView | undefined,
  marketParams: Record<string, string | number>,
): number[] {
  if (pool?.dirichletAlphas?.length) {
    return pool.dirichletAlphas;
  }
  return [
    Number(marketParams.alpha0 ?? 10),
    Number(marketParams.alpha1 ?? 10),
    Number(marketParams.alpha2 ?? 10),
  ];
}

function resolveNormalMuTenths(
  pool: PoolView | undefined,
  marketParams: Record<string, string | number>,
): number {
  if (pool?.muTenths != null && pool.muTenths > 0) return pool.muTenths;
  const seed = marketParams.mu_tenths;
  return typeof seed === "number" ? seed : Number(seed ?? 25);
}

function resolveNormalSigmaTenths(
  pool: PoolView | undefined,
  marketParams: Record<string, string | number>,
): number {
  if (pool) return effectiveSigmaTenths(pool);
  const seed = marketParams.sigma_tenths;
  return typeof seed === "number" ? seed : Number(seed ?? 4);
}

/** Entry probability (PPB) aligned with pool snapshot + pricing-engine preview. */
export function entryProbPpbForBuy(input: EntryProbTradeInput): bigint | null {
  const {
    marketKind,
    mode,
    pool,
    marketParams,
    poissonA,
    poissonB,
    poissonK,
    dirichletOutcome,
    normalThreshold,
  } = input;

  let prob = 0;
  if (marketKind === "poisson") {
    const lambda = resolveLambdaTenths(pool, marketParams) / 10;
    prob =
      mode === "digital"
        ? poissonPmf(lambda, poissonK)
        : poissonIntervalProb(lambda, poissonA, poissonB);
  } else if (marketKind === "dirichlet" || marketKind === "beta") {
    const alphas = resolveDirichletAlphas(pool, marketParams);
    prob = dirichletOutcomeProb(alphas, dirichletOutcome);
  } else if (marketKind === "normal" && mode === "interval") {
    prob = normalDigitalProb(
      resolveNormalMuTenths(pool, marketParams),
      resolveNormalSigmaTenths(pool, marketParams),
      normalThreshold,
    );
  } else {
    return null;
  }

  if (!Number.isFinite(prob) || prob <= 0) return null;
  return probToPpb(prob);
}

export interface QuoteParamsInput extends EntryProbTradeInput {
  stakeUsdc: string;
}

/** Build pricing-engine query params using live pool state when available. */
export function buildQuoteSearchParams(input: QuoteParamsInput): URLSearchParams {
  const { marketKind, mode, pool, marketParams, stakeUsdc } = input;
  const stakeBase = Math.max(1, Math.floor(Number(stakeUsdc || "1") * 1e6));
  const alphas = resolveDirichletAlphas(pool, marketParams);

  return new URLSearchParams({
    kind: marketKind,
    stake_usdc: String(stakeBase),
    mode: marketKind === "poisson" && mode === "digital" ? "digital" : "interval",
    lambda_tenths: String(resolveLambdaTenths(pool, marketParams)),
    poisson_a: String(input.poissonA),
    poisson_b: String(input.poissonB),
    poisson_k: String(input.poissonK),
    alphas: alphas.join(","),
    outcome: String(input.dirichletOutcome),
    mu_tenths: String(resolveNormalMuTenths(pool, marketParams)),
    sigma_tenths: String(resolveNormalSigmaTenths(pool, marketParams)),
    threshold_tenths: String(input.normalThreshold),
  });
}
