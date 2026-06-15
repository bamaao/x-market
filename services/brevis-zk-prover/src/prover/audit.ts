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

import type { PoolAuditSnapshot } from "../pool-reader.js";

export interface AuditPublicInputs {
  poolId: string;
  kind: string;
  checkpointSeq: string;
  collateralUsdc: string;
  vaultBalance: string;
  maxLiability: string;
  lambdaTenths?: number;
  muTenths?: number;
  sigmaTenths?: number;
  dirichletAlphas?: number[];
}

export interface AuditResult {
  ok: boolean;
  violations: string[];
  publicInputs: AuditPublicInputs;
}

const MAX_FEE_BPS = 2000;

export function auditPoolSnapshot(snapshot: PoolAuditSnapshot): AuditResult {
  const violations: string[] = [];
  const publicInputs: AuditPublicInputs = {
    poolId: snapshot.poolId,
    kind: snapshot.kind,
    checkpointSeq: snapshot.checkpointSeq,
    collateralUsdc: snapshot.collateralUsdc.toString(),
    vaultBalance: snapshot.vaultBalance.toString(),
    maxLiability: snapshot.maxLiability.toString(),
    lambdaTenths: snapshot.lambdaTenths,
    muTenths: snapshot.muTenths,
    sigmaTenths: snapshot.sigmaTenths,
    dirichletAlphas: snapshot.dirichletAlphas,
  };

  if (snapshot.feeBps < 0 || snapshot.feeBps > MAX_FEE_BPS) {
    violations.push(`fee_bps out of bounds: ${snapshot.feeBps}`);
  }

  if (snapshot.maxLiability > snapshot.collateralUsdc) {
    violations.push(
      `max_liability ${snapshot.maxLiability} > collateral ${snapshot.collateralUsdc}`,
    );
  }

  if (snapshot.vaultBalance > snapshot.collateralUsdc) {
    violations.push(
      `vault_balance ${snapshot.vaultBalance} > collateral ${snapshot.collateralUsdc}`,
    );
  }

  switch (snapshot.kind) {
    case "poisson": {
      const lambda = snapshot.lambdaTenths ?? 0;
      if (lambda <= 0 || lambda > 80) {
        violations.push(`lambda_tenths out of bounds: ${lambda}`);
      }
      break;
    }
    case "normal": {
      const sigma = snapshot.sigmaTenths ?? 0;
      if (sigma <= 0 || sigma > 500) {
        violations.push(`sigma_tenths out of bounds: ${sigma}`);
      }
      break;
    }
    case "dirichlet":
    case "beta": {
      const alphas = snapshot.dirichletAlphas ?? [];
      if (alphas.length < 2) {
        violations.push("dirichlet_alphas length < 2");
      } else {
        for (const a of alphas) {
          if (a <= 0) violations.push(`alpha must be positive: ${a}`);
        }
      }
      break;
    }
    default:
      violations.push(`unsupported pool kind: ${snapshot.kind}`);
  }

  return { ok: violations.length === 0, violations, publicInputs };
}
