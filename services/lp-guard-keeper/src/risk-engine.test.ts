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

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateRiskScore,
  computeRiskInputs,
  computeTargetParams,
  effectiveFeeBps,
  feeMultiplierForEffective,
  shouldUpdateOnChain,
} from "./risk-engine.js";
import type { KeeperConfig, PoolSnapshot } from "./types.js";

const baseConfig: KeeperConfig = {
  rpcUrl: "",
  packageId: "0x0",
  poolIds: [],
  pollMs: 30_000,
  windowSamples: 10,
  maxEffectiveFeeBps: 800,
  maxFeeMultiplierBps: 30_000,
  maxSigmaVirtualTenths: 20,
  maxConcentrationVirtual: 50,
  decayFactor: 0.85,
  updateThresholdBps: 200,
  dryRun: true,
  healthPort: 8788,
  secretKey: "",
};

function snap(partial: Partial<PoolSnapshot> & Pick<PoolSnapshot, "poolId">): PoolSnapshot {
  return {
    kind: "normal",
    status: 1,
    feeBps: 200,
    feeMultiplierBps: 0,
    sigmaVirtualTenths: 0,
    concentrationVirtual: 0,
    depositCutoffBps: 0,
    resolutionWindowTs: 0,
    collateralUsdc: 100_000,
    sampledAtMs: Date.now(),
    ...partial,
  };
}

describe("effectiveFeeBps", () => {
  it("maps 200bps base + 30000 mult to ~800bps", () => {
    const eff = effectiveFeeBps(200, 30_000);
    assert.equal(eff, 800);
  });
});

describe("feeMultiplierForEffective", () => {
  it("inverts 2% -> 8% scenario", () => {
    const mult = feeMultiplierForEffective(200, 800, 30_000);
    assert.equal(mult, 30_000);
  });
});

describe("risk engine", () => {
  it("detects one-sided mu drift", () => {
    const history = [
      snap({ poolId: "p1", muTenths: 25, sigmaTenths: 4, collateralUsdc: 100_000 }),
      snap({ poolId: "p1", muTenths: 28, sigmaTenths: 4, collateralUsdc: 105_000 }),
      snap({ poolId: "p1", muTenths: 32, sigmaTenths: 4, collateralUsdc: 112_000 }),
      snap({ poolId: "p1", muTenths: 36, sigmaTenths: 4, collateralUsdc: 120_000 }),
    ];
    const inputs = computeRiskInputs(history, 5_000);
    const risk = aggregateRiskScore(inputs);
    assert.ok(risk > 0.2);
    const target = computeTargetParams(history[3]!, risk, 0, baseConfig);
    assert.ok(target.feeMultiplierBps > 5_000);
    assert.ok(target.effectiveFeeBps > 300);
  });

  it("decays multiplier when calm", () => {
    const calm = snap({ poolId: "p1", feeMultiplierBps: 20_000 });
    const target = computeTargetParams(calm, 0, 20_000, baseConfig);
    assert.equal(target.feeMultiplierBps, 17_000);
  });

  it("requires threshold before on-chain update", () => {
    const current = snap({
      poolId: "p1",
      feeMultiplierBps: 10_000,
      sigmaVirtualTenths: 10,
      concentrationVirtual: 25,
    });
    const target = computeTargetParams(current, 0.5, 10_000, baseConfig);
    assert.equal(shouldUpdateOnChain(current, target, baseConfig), true);
    const tiny = {
      ...target,
      feeMultiplierBps: 10_050,
      sigmaVirtualTenths: current.sigmaVirtualTenths,
      concentrationVirtual: current.concentrationVirtual,
    };
    assert.equal(shouldUpdateOnChain(current, tiny, baseConfig), false);
  });
});
