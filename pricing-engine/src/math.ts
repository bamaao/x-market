/** 链下镜像：与 Move `prob_to_ppb` / `position_payout_usdc` 对齐的预览数学。 */

const PPB = 1_000_000_000n;

export function probToPpb(probFp: number): bigint {
  const clamped = Math.max(1e-12, Math.min(1 - 1e-12, probFp));
  return BigInt(Math.floor(clamped * Number(PPB)));
}

export function payoutUsdc(stakeUsdc: bigint, entryProbPpb: bigint): bigint {
  if (entryProbPpb <= 0n) return 0n;
  return (stakeUsdc * PPB) / entryProbPpb;
}

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

export function poissonPmf(lambda: number, k: number): number {
  if (k < 0) return 0;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

export function poissonIntervalProb(lambda: number, a: number, b: number): number {
  let sum = 0;
  for (let k = a; k <= b; k++) sum += poissonPmf(lambda, k);
  return sum;
}

/** Dirichlet 简化：均匀先验下单桶边际 ≈ alpha_i / sum(alpha) */
export function dirichletOutcomeProb(alphas: number[], outcome: number): number {
  const sum = alphas.reduce((s, a) => s + a, 0);
  if (sum <= 0) return 1 / alphas.length;
  return alphas[outcome] ?? alphas[0]! / sum;
}

/** Normal 数字期权：P(X >= threshold) 用误差函数近似（μ/σ tenths → 实数） */
export function normalDigitalProb(muTenths: number, sigmaTenths: number, thresholdTenths: number): number {
  const mu = muTenths / 10;
  const sigma = Math.max(0.01, sigmaTenths / 10);
  const t = thresholdTenths / 10;
  const z = (t - mu) / sigma;
  return 0.5 * (1 - erf(z / Math.SQRT2));
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax));
  return sign * y;
}
