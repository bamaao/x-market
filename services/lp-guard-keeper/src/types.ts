export type PoolKind = "poisson" | "dirichlet" | "normal" | "unknown";

export interface PoolSnapshot {
  poolId: string;
  kind: PoolKind;
  status: number;
  feeBps: number;
  feeMultiplierBps: number;
  sigmaVirtualTenths: number;
  concentrationVirtual: number;
  depositCutoffBps: number;
  resolutionWindowTs: number;
  collateralUsdc: number;
  lambdaTenths?: number;
  muTenths?: number;
  sigmaTenths?: number;
  dirichletAlphas?: number[];
  sampledAtMs: number;
}

export interface RiskInputs {
  driftScore: number;
  skewScore: number;
  volumeScore: number;
}

export interface TargetGuardParams {
  feeMultiplierBps: number;
  sigmaVirtualTenths: number;
  concentrationVirtual: number;
  riskScore: number;
  effectiveFeeBps: number;
}

export interface KeeperConfig {
  rpcUrl: string;
  packageId: string;
  poolIds: string[];
  pollMs: number;
  windowSamples: number;
  maxEffectiveFeeBps: number;
  maxFeeMultiplierBps: number;
  maxSigmaVirtualTenths: number;
  maxConcentrationVirtual: number;
  decayFactor: number;
  updateThresholdBps: number;
  dryRun: boolean;
  secretKey: string;
}
