import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

export type PoolKind = "poisson" | "dirichlet" | "normal" | "beta" | "unknown";

export interface PoolAuditSnapshot {
  poolId: string;
  kind: PoolKind;
  status: number;
  collateralUsdc: bigint;
  vaultBalance: bigint;
  maxLiability: bigint;
  feeBps: number;
  lambdaTenths?: number;
  muTenths?: number;
  sigmaTenths?: number;
  dirichletAlphas?: number[];
  paused: boolean;
  resolved: boolean;
  checkpointSeq: string;
  sampledAtMs: number;
}

function kindFromRaw(kind: number): PoolKind {
  if (kind === 0) return "poisson";
  if (kind === 1) return "dirichlet";
  if (kind === 2) return "normal";
  if (kind === 3) return "beta";
  return "unknown";
}

function parseBalance(fields: Record<string, unknown>): bigint {
  const vault = fields.vault as { fields?: { value?: string } } | undefined;
  return BigInt(vault?.fields?.value ?? "0");
}

function maxLiability(fields: Record<string, unknown>): bigint {
  const raw = fields.liability_by_k;
  if (!Array.isArray(raw) || raw.length === 0) return 0n;
  let max = 0n;
  for (const v of raw) {
    const n = BigInt(String(v));
    if (n > max) max = n;
  }
  return max;
}

export async function fetchPoolAuditSnapshot(
  client: SuiJsonRpcClient,
  poolId: string,
): Promise<PoolAuditSnapshot> {
  const obj = await client.getObject({
    id: poolId,
    options: { showContent: true },
  });
  const content = obj.data?.content;
  if (!content || content.dataType !== "moveObject") {
    throw new Error(`Pool ${poolId} is not a move object`);
  }
  const fields = content.fields as Record<string, unknown>;
  const kind = kindFromRaw(Number(fields.kind ?? -1));
  const alphasRaw = fields.dirichlet_alphas;
  const dirichletAlphas = Array.isArray(alphasRaw)
    ? alphasRaw.map((a) => Number(a))
    : undefined;

  return {
    poolId,
    kind,
    status: Number(fields.status ?? 0),
    collateralUsdc: BigInt(String(fields.collateral_usdc ?? "0")),
    vaultBalance: parseBalance(fields),
    maxLiability: maxLiability(fields),
    feeBps: Number(fields.fee_bps ?? 0),
    lambdaTenths:
      kind === "poisson" ? Number(fields.lambda_tenths ?? 0) : undefined,
    muTenths: kind === "normal" ? Number(fields.mu_tenths ?? 0) : undefined,
    sigmaTenths:
      kind === "normal" ? Number(fields.sigma_tenths ?? 0) : undefined,
    dirichletAlphas,
    paused: Boolean(fields.paused),
    resolved: Boolean(fields.resolved),
    checkpointSeq: String(obj.data?.version ?? "0"),
    sampledAtMs: Date.now(),
  };
}

export function snapshotFingerprint(snapshot: PoolAuditSnapshot): string {
  return JSON.stringify({
    poolId: snapshot.poolId,
    checkpointSeq: snapshot.checkpointSeq,
    collateralUsdc: snapshot.collateralUsdc.toString(),
    vaultBalance: snapshot.vaultBalance.toString(),
    maxLiability: snapshot.maxLiability.toString(),
    lambdaTenths: snapshot.lambdaTenths,
    muTenths: snapshot.muTenths,
    sigmaTenths: snapshot.sigmaTenths,
    dirichletAlphas: snapshot.dirichletAlphas,
    paused: snapshot.paused,
    resolved: snapshot.resolved,
  });
}
