import type {
  KeeperConfig,
  PoolKind,
  PoolSnapshot,
  RiskInputs,
  TargetGuardParams,
} from "./types.js";

const STATUS_TRADING = 1;

export function effectiveFeeBps(
  baseFeeBps: number,
  feeMultiplierBps: number,
): number {
  return Math.floor((baseFeeBps * (10_000 + feeMultiplierBps)) / 10_000);
}

export function feeMultiplierForEffective(
  baseFeeBps: number,
  targetEffectiveBps: number,
  maxMultiplierBps: number,
): number {
  if (baseFeeBps <= 0) return 0;
  const raw = Math.floor((targetEffectiveBps * 10_000) / baseFeeBps - 10_000);
  return Math.max(0, Math.min(maxMultiplierBps, raw));
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function normalizeDelta(delta: number, scale: number): number {
  if (scale <= 0) return 0;
  return clamp01(delta / scale);
}

function kindFromRaw(kind: number): PoolKind {
  if (kind === 0) return "poisson";
  if (kind === 1) return "dirichlet";
  if (kind === 2) return "normal";
  return "unknown";
}

export function parsePoolFields(
  poolId: string,
  fields: Record<string, unknown>,
): PoolSnapshot {
  const kind = kindFromRaw(Number(fields.kind ?? -1));
  const alphasRaw = fields.dirichlet_alphas;
  const dirichletAlphas = Array.isArray(alphasRaw)
    ? alphasRaw.map((a) => Number(a))
    : undefined;

  return {
    poolId,
    kind,
    status: Number(fields.status ?? 0),
    feeBps: Number(fields.fee_bps ?? 0),
    feeMultiplierBps: Number(fields.fee_multiplier_bps ?? 0),
    sigmaVirtualTenths: Number(fields.sigma_virtual_tenths ?? 0),
    concentrationVirtual: Number(fields.concentration_virtual ?? 0),
    depositCutoffBps: Number(fields.deposit_cutoff_bps ?? 0),
    resolutionWindowTs: Number(fields.resolution_window_ts ?? 0),
    collateralUsdc: Number(fields.collateral_usdc ?? 0),
    lambdaTenths:
      kind === "poisson" ? Number(fields.lambda_tenths ?? 0) : undefined,
    muTenths: kind === "normal" ? Number(fields.mu_tenths ?? 0) : undefined,
    sigmaTenths:
      kind === "normal" ? Number(fields.sigma_tenths ?? 0) : undefined,
    dirichletAlphas,
    sampledAtMs: Date.now(),
  };
}

function parameterDrift(
  oldest: PoolSnapshot,
  newest: PoolSnapshot,
): number {
  switch (newest.kind) {
    case "poisson": {
      const a = oldest.lambdaTenths ?? 0;
      const b = newest.lambdaTenths ?? 0;
      return normalizeDelta(Math.abs(b - a), 15);
    }
    case "normal": {
      const muDelta = Math.abs((newest.muTenths ?? 0) - (oldest.muTenths ?? 0));
      const sigma = Math.max(newest.sigmaTenths ?? 1, 1);
      const muScore = normalizeDelta(muDelta, sigma * 3);
      const sigmaDelta = Math.abs(
        (newest.sigmaTenths ?? 0) - (oldest.sigmaTenths ?? 0),
      );
      const sigmaScore = normalizeDelta(sigmaDelta, sigma);
      return clamp01(muScore * 0.75 + sigmaScore * 0.25);
    }
    case "dirichlet": {
      const oldA = oldest.dirichletAlphas ?? [];
      const newA = newest.dirichletAlphas ?? [];
      if (oldA.length === 0 || newA.length === 0) return 0;
      let l1 = 0;
      let sum = 0;
      for (let i = 0; i < newA.length; i++) {
        l1 += Math.abs((newA[i] ?? 0) - (oldA[i] ?? 0));
        sum += newA[i] ?? 0;
      }
      return normalizeDelta(l1, Math.max(sum * 0.25, 1));
    }
    default:
      return 0;
  }
}

/** 单边集中度：Dirichlet 最大 α 占比偏离均匀；Normal/Poisson 用近期漂移方向一致性近似。 */
function directionalSkew(history: PoolSnapshot[]): number {
  if (history.length < 2) return 0;
  const latest = history[history.length - 1]!;

  if (latest.kind === "dirichlet") {
    const alphas = latest.dirichletAlphas ?? [];
    const sum = alphas.reduce((a, b) => a + b, 0);
    if (sum <= 0 || alphas.length === 0) return 0;
    const uniform = 1 / alphas.length;
    const maxShare = Math.max(...alphas.map((a) => a / sum));
    return clamp01((maxShare - uniform) / (1 - uniform));
  }

  if (latest.kind === "normal") {
    const deltas: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1]!;
      const cur = history[i]!;
      deltas.push((cur.muTenths ?? 0) - (prev.muTenths ?? 0));
    }
    const sameSign = deltas.filter((d) => d > 0).length;
    const ratio = Math.abs(sameSign / deltas.length - 0.5) * 2;
    const magnitude = parameterDrift(history[0]!, latest);
    return clamp01(ratio * 0.6 + magnitude * 0.4);
  }

  if (latest.kind === "poisson") {
    const deltas: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1]!;
      const cur = history[i]!;
      deltas.push((cur.lambdaTenths ?? 0) - (prev.lambdaTenths ?? 0));
    }
    const up = deltas.filter((d) => d > 0).length;
    const ratio = Math.abs(up / deltas.length - 0.5) * 2;
    return clamp01(ratio * 0.7 + parameterDrift(history[0]!, latest) * 0.3);
  }

  return 0;
}

function volumeSpikeScore(
  history: PoolSnapshot[],
  volumeEma: number,
): number {
  if (history.length < 2) return 0;
  const latest = history[history.length - 1]!;
  const prev = history[history.length - 2]!;
  const delta = Math.max(0, latest.collateralUsdc - prev.collateralUsdc);
  const baseline = Math.max(volumeEma, latest.collateralUsdc * 0.001, 1);
  return clamp01(delta / (baseline * 3));
}

export function computeRiskInputs(
  history: PoolSnapshot[],
  volumeEma: number,
): RiskInputs {
  if (history.length < 2) {
    return { driftScore: 0, skewScore: 0, volumeScore: 0 };
  }
  const oldest = history[0]!;
  const newest = history[history.length - 1]!;
  return {
    driftScore: parameterDrift(oldest, newest),
    skewScore: directionalSkew(history),
    volumeScore: volumeSpikeScore(history, volumeEma),
  };
}

export function aggregateRiskScore(inputs: RiskInputs): number {
  return clamp01(
    inputs.driftScore * 0.4 +
      inputs.skewScore * 0.35 +
      inputs.volumeScore * 0.25,
  );
}

export function computeTargetParams(
  snapshot: PoolSnapshot,
  riskScore: number,
  previousMultiplierBps: number,
  config: KeeperConfig,
): TargetGuardParams {
  let feeMultiplierBps: number;
  if (riskScore > 0.05) {
    const targetEffective =
      snapshot.feeBps +
      riskScore * (config.maxEffectiveFeeBps - snapshot.feeBps);
    feeMultiplierBps = feeMultiplierForEffective(
      snapshot.feeBps,
      targetEffective,
      config.maxFeeMultiplierBps,
    );
  } else {
    feeMultiplierBps = Math.floor(previousMultiplierBps * config.decayFactor);
  }

  const sigmaVirtualTenths = Math.floor(
    riskScore * config.maxSigmaVirtualTenths,
  );
  const concentrationVirtual = Math.floor(
    riskScore * config.maxConcentrationVirtual,
  );

  return {
    feeMultiplierBps,
    sigmaVirtualTenths,
    concentrationVirtual,
    riskScore,
    effectiveFeeBps: effectiveFeeBps(snapshot.feeBps, feeMultiplierBps),
  };
}

export function shouldUpdateOnChain(
  current: PoolSnapshot,
  target: TargetGuardParams,
  config: KeeperConfig,
): boolean {
  if (current.status !== STATUS_TRADING) return false;
  const multDelta = Math.abs(
    target.feeMultiplierBps - current.feeMultiplierBps,
  );
  const sigmaDelta = Math.abs(
    target.sigmaVirtualTenths - current.sigmaVirtualTenths,
  );
  const concDelta = Math.abs(
    target.concentrationVirtual - current.concentrationVirtual,
  );
  return (
    multDelta >= config.updateThresholdBps ||
    sigmaDelta >= 2 ||
    concDelta >= 3
  );
}

export function updateVolumeEma(
  prevEma: number,
  history: PoolSnapshot[],
  alpha = 0.35,
): number {
  if (history.length < 2) return prevEma;
  const latest = history[history.length - 1]!;
  const prev = history[history.length - 2]!;
  const delta = Math.max(0, latest.collateralUsdc - prev.collateralUsdc);
  return alpha * delta + (1 - alpha) * prevEma;
}
