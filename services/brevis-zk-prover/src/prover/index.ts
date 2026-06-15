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

import type { ZkProverConfig } from "../config.js";
import type { PoolAuditSnapshot } from "../pool-reader.js";
import { auditPoolSnapshot } from "./audit.js";
import { brevisProve, localProve, type ProverOutput } from "./hash.js";

export async function provePoolSnapshot(
  config: ZkProverConfig,
  snapshot: PoolAuditSnapshot,
): Promise<ProverOutput> {
  const audit = auditPoolSnapshot(snapshot);
  if (config.mode === "live") {
    const brevis = await brevisProve(audit, {
      rpcUrl: config.brevisRpcUrl,
      partnerKey: config.brevisPartnerKey,
      srcChainId: config.brevisSrcChainId,
    });
    if (brevis) return brevis;
    console.log(
      JSON.stringify({
        event: "brevis_fallback_local",
        poolId: snapshot.poolId,
        reason: config.brevisRpcUrl ? "brevis_rpc_failed" : "brevis_rpc_unset",
      }),
    );
  }
  return localProve(audit);
}
