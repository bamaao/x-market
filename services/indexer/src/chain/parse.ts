export function parseMoveFields(content: unknown): Record<string, unknown> | undefined {
  if (!content || typeof content !== "object") return undefined;
  const c = content as { dataType?: string; fields?: Record<string, unknown> };
  if (c.dataType === "moveObject" && c.fields) return c.fields;
  return undefined;
}

export function parseObjectId(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    return String((value as { id: string }).id);
  }
  return "";
}

export function bytesToHex(value: unknown): string {
  if (typeof value === "string") {
    if (value.startsWith("0x")) return value.slice(2);
    return value;
  }
  if (Array.isArray(value)) {
    return (value as number[])
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return "";
}

export function bytesToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return new TextDecoder().decode(Uint8Array.from(value as number[]));
  }
  return "";
}

export function parseAddressList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v));
}

export type MarketKind = "poisson" | "dirichlet" | "normal";

export function kindFromCode(code: number): MarketKind {
  if (code === 1) return "dirichlet";
  if (code === 2) return "normal";
  return "poisson";
}

export function liabilitySum(fields: Record<string, unknown>): bigint {
  const liab = fields.liability_by_k;
  if (!Array.isArray(liab)) return 0n;
  return liab.reduce((s, v) => s + BigInt(String(v ?? 0)), 0n);
}

export function balanceValue(fields: Record<string, unknown>, key: string): bigint {
  const bal = fields[key] as { fields?: { value?: string } } | undefined;
  return BigInt(bal?.fields?.value ?? "0");
}

/** Vol Crush: effective σ with time-to-maturity decay (PRD / qa.md). */
export function computeIvMetrics(params: {
  kind: MarketKind;
  sigmaTenths: number;
  sigmaVirtualTenths: number;
  lambdaTenths: number;
  maturityTs: number;
  createdTs: number;
  nowSec: number;
}): { ivTenths: number; tauBps: number; volCrushBps: number; sigmaEffTenths: number } {
  const { kind, sigmaTenths, sigmaVirtualTenths, lambdaTenths, maturityTs, createdTs, nowSec } =
    params;
  const sigmaEff = sigmaTenths + sigmaVirtualTenths;
  let ivTenths = sigmaEff;
  if (kind === "poisson") ivTenths = Math.max(lambdaTenths * 4, sigmaEff);
  if (kind === "dirichlet") ivTenths = Math.max(30, sigmaEff);

  const window = Math.max(1, maturityTs - createdTs);
  const tau = Math.max(0, Math.min(1, (maturityTs - nowSec) / window));
  const tauBps = Math.round(tau * 10_000);
  const volCrushBps = Math.round(ivTenths * Math.sqrt(tau) * 100);
  return { ivTenths, tauBps, volCrushBps, sigmaEffTenths: sigmaEff };
}

export const MIN_AUDITED_FOR_PAID = 3;
export const MIN_SCORE_BPS_FOR_PAID = 4000;

export function paidUnlockEligible(stats: {
  cheats: number;
  totalAudited: number;
  scoreBps: number;
}): boolean {
  return (
    stats.cheats === 0 &&
    stats.totalAudited >= MIN_AUDITED_FOR_PAID &&
    stats.scoreBps >= MIN_SCORE_BPS_FOR_PAID
  );
}

export function prophecyOutcomeLabel(status: number): string {
  if (status === 1) return "win";
  if (status === 2) return "loss";
  if (status === 3) return "cheat";
  return "pending";
}
