import {
  dirichletOutcomeProb,
  normalDigitalProb,
  payoutUsdc,
  poissonIntervalProb,
  poissonPmf,
  probToPpb,
} from "./math.js";

export type MarketKind = "poisson" | "dirichlet" | "normal";

export interface QuoteRequest {
  kind: MarketKind;
  stakeUsdc: bigint;
  /** Poisson λ tenths */
  lambdaTenths?: number;
  poissonA?: number;
  poissonB?: number;
  poissonK?: number;
  mode?: "interval" | "digital";
  /** Dirichlet */
  dirichletAlphas?: number[];
  dirichletOutcome?: number;
  /** Normal */
  muTenths?: number;
  sigmaTenths?: number;
  normalThresholdTenths?: number;
}

export interface QuoteResult {
  entryProbPpb: string;
  entryProbPercent: number;
  payoutUsdc: string;
  impliedRoiBps: number;
  maxLossNote: string;
}

export function quoteBuy(req: QuoteRequest): QuoteResult {
  let prob = 0.01;
  if (req.kind === "poisson") {
    const lambda = (req.lambdaTenths ?? 25) / 10;
    if (req.mode === "digital") {
      prob = poissonPmf(lambda, req.poissonK ?? 0);
    } else {
      prob = poissonIntervalProb(lambda, req.poissonA ?? 0, req.poissonB ?? 0);
    }
  } else if (req.kind === "dirichlet") {
    const alphas = req.dirichletAlphas ?? [10, 10, 10];
    prob = dirichletOutcomeProb(alphas, req.dirichletOutcome ?? 0);
  } else {
    prob = normalDigitalProb(
      req.muTenths ?? 25,
      req.sigmaTenths ?? 4,
      req.normalThresholdTenths ?? 30,
    );
  }

  const entryProbPpb = probToPpb(prob);
  const payout = payoutUsdc(req.stakeUsdc, entryProbPpb);
  const roiBps =
    req.stakeUsdc > 0n
      ? Number(((payout - req.stakeUsdc) * 10_000n) / req.stakeUsdc)
      : 0;

  return {
    entryProbPpb: entryProbPpb.toString(),
    entryProbPercent: Number(entryProbPpb) / 1e7,
    payoutUsdc: payout.toString(),
    impliedRoiBps: roiBps,
    maxLossNote: "链下预览；实际以池 vault / max-loss 约束为准",
  };
}
