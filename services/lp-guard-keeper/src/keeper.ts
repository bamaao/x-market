import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { createRpcClient, loadKeeperKeypair } from "./client.js";
import { loadConfig } from "./config.js";
import { fetchPoolSnapshot } from "./pool-reader.js";
import {
  aggregateRiskScore,
  computeRiskInputs,
  computeTargetParams,
  shouldUpdateOnChain,
  updateVolumeEma,
} from "./risk-engine.js";
import { collectKeeperHealth, startHealthServer } from "./health.js";
import { submitSetLpGuard } from "./tx.js";
import type { PoolSnapshot } from "./types.js";

interface PoolRuntime {
  poolId: string;
  history: PoolSnapshot[];
  volumeEma: number;
}

function trimHistory(history: PoolSnapshot[], maxSamples: number): PoolSnapshot[] {
  if (history.length <= maxSamples) return history;
  return history.slice(history.length - maxSamples);
}

async function tickPool(
  client: SuiJsonRpcClient,
  keypair: Ed25519Keypair,
  runtime: PoolRuntime,
  config: ReturnType<typeof loadConfig>,
): Promise<void> {
  const snapshot = await fetchPoolSnapshot(client, runtime.poolId);
  runtime.history = trimHistory([...runtime.history, snapshot], config.windowSamples);
  runtime.volumeEma = updateVolumeEma(runtime.volumeEma, runtime.history);

  const inputs = computeRiskInputs(runtime.history, runtime.volumeEma);
  const riskScore = aggregateRiskScore(inputs);
  const target = computeTargetParams(
    snapshot,
    riskScore,
    snapshot.feeMultiplierBps,
    config,
  );

  const logLine = {
    poolId: snapshot.poolId,
    kind: snapshot.kind,
    status: snapshot.status,
    riskScore: Number(riskScore.toFixed(3)),
    drift: Number(inputs.driftScore.toFixed(3)),
    skew: Number(inputs.skewScore.toFixed(3)),
    volume: Number(inputs.volumeScore.toFixed(3)),
    feeBps: snapshot.feeBps,
    feeMultBps: target.feeMultiplierBps,
    effectiveFeeBps: target.effectiveFeeBps,
    sigmaVirtual: target.sigmaVirtualTenths,
    concentrationVirtual: target.concentrationVirtual,
  };
  console.log(JSON.stringify({ event: "lp_guard_tick", ...logLine }));

  if (!shouldUpdateOnChain(snapshot, target, config)) {
    return;
  }

  if (config.dryRun) {
    console.log(
      JSON.stringify({
        event: "lp_guard_dry_run",
        poolId: snapshot.poolId,
        wouldSet: target,
      }),
    );
    return;
  }

  const digest = await submitSetLpGuard(
    client,
    keypair,
    config,
    snapshot,
    target,
  );
  console.log(
    JSON.stringify({
      event: "lp_guard_updated",
      poolId: snapshot.poolId,
      digest,
      ...target,
    }),
  );
}

async function main(): Promise<void> {
  const config = loadConfig();
  const client = createRpcClient(config);
  const keypair = loadKeeperKeypair(config.secretKey);

  const pools = new Map<string, PoolRuntime>();
  for (const poolId of config.poolIds) {
    const snapshot = await fetchPoolSnapshot(client, poolId);
    pools.set(poolId, { poolId, history: [snapshot], volumeEma: 0 });
  }

  const keeperAddress = keypair.getPublicKey().toSuiAddress();

  const startupHealth = await collectKeeperHealth(client, keypair, config);
  if (!startupHealth.ok) {
    console.error(
      JSON.stringify({ event: "lp_guard_startup_failed", ...startupHealth }),
    );
    if (process.env.LP_GUARD_PRODUCTION === "true") {
      process.exit(1);
    }
  }

  startHealthServer(config.healthPort, () =>
    collectKeeperHealth(client, keypair, config),
  );

  console.log(
    JSON.stringify({
      event: "lp_guard_started",
      pools: config.poolIds,
      pollMs: config.pollMs,
      dryRun: config.dryRun,
      healthPort: config.healthPort,
      keeper: keeperAddress,
    }),
  );

  const run = async () => {
    for (const runtime of pools.values()) {
      try {
        await tickPool(client, keypair, runtime, config);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(
          JSON.stringify({
            event: "lp_guard_error",
            poolId: runtime.poolId,
            error: message,
          }),
        );
      }
    }
  };

  await run();
  setInterval(() => {
    void run();
  }, config.pollMs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
