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

import http from "node:http";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { KeeperConfig } from "./types.js";

export interface KeeperHealthReport {
  ok: boolean;
  service: string;
  keeper: string;
  pools: number;
  dryRun: boolean;
  gasBalanceMist: string | null;
  gasBalanceLow: boolean;
  errors: string[];
}

const MIN_KEEPER_GAS_MIST = 50_000_000n;

export async function collectKeeperHealth(
  client: SuiJsonRpcClient,
  keypair: Ed25519Keypair,
  config: KeeperConfig,
): Promise<KeeperHealthReport> {
  const errors: string[] = [];
  const keeper = keypair.getPublicKey().toSuiAddress();
  let gasBalanceMist: string | null = null;
  let gasBalanceLow = false;

  try {
    const balance = await client.getBalance({
      owner: keeper,
      coinType: "0x2::sui::SUI",
    });
    gasBalanceMist = balance.totalBalance;
    gasBalanceLow = BigInt(balance.totalBalance) < MIN_KEEPER_GAS_MIST;
    if (gasBalanceLow) {
      errors.push(`Keeper SUI balance below ${MIN_KEEPER_GAS_MIST} mist`);
    }
  } catch (e) {
    errors.push(
      `RPC balance check failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  if (config.dryRun && process.env.LP_GUARD_PRODUCTION === "true") {
    errors.push("LP_GUARD_DRY_RUN=true while LP_GUARD_PRODUCTION=true");
  }

  return {
    ok: errors.length === 0,
    service: "x-market-lp-guard-keeper",
    keeper,
    pools: config.poolIds.length,
    dryRun: config.dryRun,
    gasBalanceMist,
    gasBalanceLow,
    errors,
  };
}

export function startHealthServer(
  port: number,
  getReport: () => Promise<KeeperHealthReport>,
): http.Server {
  const host = process.env.HOST ?? "0.0.0.0";
  const server = http.createServer(async (req, res) => {
    if (req.method !== "GET" || req.url !== "/health") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    const report = await getReport();
    res.writeHead(report.ok ? 200 : 503, {
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify(report));
  });
  server.listen(port, host, () => {
    console.log(
      JSON.stringify({ event: "lp_guard_health_listening", host, port }),
    );
  });
  return server;
}
