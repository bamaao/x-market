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

export type PoolKind = "poisson" | "dirichlet" | "normal" | "unknown";

export interface PoolSnapshot {
  poolId: string;
  kind: PoolKind;
  status: number;
  feeBps: number;
  feeMultiplierBps: number;
  sigmaVirtualTenths: number;
  concentrationVirtual: number;
  depositCutoffBps: number;
  resolutionWindowTs: number;
  collateralUsdc: number;
  lambdaTenths?: number;
  muTenths?: number;
  sigmaTenths?: number;
  dirichletAlphas?: number[];
  sampledAtMs: number;
}

export interface RiskInputs {
  driftScore: number;
  skewScore: number;
  volumeScore: number;
}

export interface TargetGuardParams {
  feeMultiplierBps: number;
  sigmaVirtualTenths: number;
  concentrationVirtual: number;
  riskScore: number;
  effectiveFeeBps: number;
}

export interface KeeperConfig {
  rpcUrl: string;
  packageId: string;
  poolIds: string[];
  pollMs: number;
  windowSamples: number;
  maxEffectiveFeeBps: number;
  maxFeeMultiplierBps: number;
  maxSigmaVirtualTenths: number;
  maxConcentrationVirtual: number;
  decayFactor: number;
  updateThresholdBps: number;
  dryRun: boolean;
  healthPort: number;
  secretKey: string;
}
