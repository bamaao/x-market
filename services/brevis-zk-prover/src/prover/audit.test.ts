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
import test from "node:test";
import { auditPoolSnapshot } from "./audit.js";
import type { PoolAuditSnapshot } from "../pool-reader.js";

function baseSnapshot(overrides: Partial<PoolAuditSnapshot> = {}): PoolAuditSnapshot {
  return {
    poolId: "0xabc",
    kind: "poisson",
    status: 1,
    collateralUsdc: 1_000_000n,
    vaultBalance: 900_000n,
    maxLiability: 500_000n,
    feeBps: 200,
    lambdaTenths: 25,
    paused: false,
    resolved: false,
    checkpointSeq: "42",
    sampledAtMs: Date.now(),
    ...overrides,
  };
}

test("audit accepts healthy poisson pool", () => {
  const result = auditPoolSnapshot(baseSnapshot());
  assert.equal(result.ok, true);
  assert.equal(result.violations.length, 0);
});

test("audit rejects liability exceeding collateral", () => {
  const result = auditPoolSnapshot(
    baseSnapshot({ maxLiability: 2_000_000n }),
  );
  assert.equal(result.ok, false);
  assert.match(result.violations.join(";"), /max_liability/);
});

test("audit rejects invalid lambda", () => {
  const result = auditPoolSnapshot(baseSnapshot({ lambdaTenths: 0 }));
  assert.equal(result.ok, false);
});
