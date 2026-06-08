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
