import http from "node:http";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { AuditKeeperConfig } from "./types.js";

export interface AuditKeeperHealth {
  ok: boolean;
  service: string;
  keeper: string;
  pools: number;
  dryRun: boolean;
  gasBalanceMist: string | null;
  errors: string[];
}

const MIN_GAS_MIST = 50_000_000n;

export async function collectHealth(
  client: SuiJsonRpcClient,
  keypair: Ed25519Keypair,
  config: AuditKeeperConfig,
): Promise<AuditKeeperHealth> {
  const errors: string[] = [];
  const keeper = keypair.getPublicKey().toSuiAddress();
  let gasBalanceMist: string | null = null;

  try {
    const balance = await client.getBalance({
      owner: keeper,
      coinType: "0x2::sui::SUI",
    });
    gasBalanceMist = balance.totalBalance;
    if (BigInt(balance.totalBalance) < MIN_GAS_MIST) {
      errors.push(`Keeper SUI balance below ${MIN_GAS_MIST} mist`);
    }
  } catch (e) {
    errors.push(
      `RPC balance check failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  return {
    ok: errors.length === 0,
    service: "x-market-prophet-audit-keeper",
    keeper,
    pools: config.poolIds.length,
    dryRun: config.dryRun,
    gasBalanceMist,
    errors,
  };
}

export function startHealthServer(
  port: number,
  getReport: () => Promise<AuditKeeperHealth>,
): void {
  const server = http.createServer(async (_req, res) => {
    const report = await getReport();
    res.writeHead(report.ok ? 200 : 503, { "Content-Type": "application/json" });
    res.end(JSON.stringify(report));
  });
  server.listen(port, () => {
    console.log(
      JSON.stringify({ event: "prophet_audit_health_listen", port }),
    );
  });
}
