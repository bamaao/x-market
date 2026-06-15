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

"use client";

import { useEffect, useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import type { SeedMarket } from "@/lib/markets";
import { defaultPoolId } from "@/lib/markets";
import { prepareUsdcPayment } from "@/lib/usdc";
import {
  appendBuyMoveCall,
  defaultTradeParams,
  type ContractMode,
} from "@/lib/trade";
import { MintUsdcButton } from "./MintUsdcButton";
import { UsdcBalance } from "./UsdcBalance";
import { fetchQuotePreview, type QuotePreview } from "@/lib/pricing";
import { useT } from "@/i18n/context";

type Props = { market: SeedMarket };

export function TradePanel({ market }: Props) {
  const t = useT();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [poolId, setPoolId] = useState(() => defaultPoolId(market));
  const [mode, setMode] = useState<ContractMode>("interval");
  const [stakeUsdc, setStakeUsdc] = useState("1");
  const [status, setStatus] = useState<string | null>(null);
  const [balanceKey, setBalanceKey] = useState(0);
  const [quote, setQuote] = useState<QuotePreview | null>(null);

  const [poissonA, setPoissonA] = useState("2");
  const [poissonB, setPoissonB] = useState("3");
  const [poissonK, setPoissonK] = useState("2");
  const [dirichletOutcome, setDirichletOutcome] = useState("0");
  const [normalA, setNormalA] = useState("25");
  const [normalB, setNormalB] = useState("27");
  const [normalThreshold, setNormalThreshold] = useState("30");
  const [normalStrike, setNormalStrike] = useState("25");
  const [normalCap, setNormalCap] = useState("30");
  const [normalLower, setNormalLower] = useState("24");
  const [normalUpper, setNormalUpper] = useState("28");
  const [normalBarrier, setNormalBarrier] = useState("26");
  const [betaA, setBetaA] = useState("350");
  const [betaB, setBetaB] = useState("400");

  const modeHint = (() => {
    if (market.kind !== "normal") return null;
    if (mode === "linear_call") return t("trade.modeLinearCall");
    if (mode === "linear_put") return t("trade.modeLinearPut");
    if (mode === "straddle") return t("trade.modeStraddle");
    if (mode === "variance_swap") return t("trade.modeVarianceSwap");
    if (mode === "structured_note") return t("trade.modeStructuredNote");
    if (mode === "range_note") return t("trade.modeRangeNote");
    if (mode === "barrier_note") return t("trade.modeBarrierNote");
    return null;
  })();

  useEffect(() => {
    const stakeBase = Math.max(1, Math.floor(Number(stakeUsdc || "1") * 1e6));
    const q = new URLSearchParams({
      kind: market.kind,
      stake_usdc: String(stakeBase),
      mode: market.kind === "poisson" && mode === "digital" ? "digital" : "interval",
      lambda_tenths: String(market.params.lambda_tenths ?? 25),
      poisson_a: poissonA,
      poisson_b: poissonB,
      poisson_k: poissonK,
      alphas: "10,10,10",
      outcome: dirichletOutcome,
      mu_tenths: String(market.params.mu_tenths ?? 25),
      sigma_tenths: String(market.params.sigma_tenths ?? 4),
      threshold_tenths: normalThreshold,
    });
    void fetchQuotePreview(q).then(setQuote);
  }, [
    market.kind,
    market.params,
    mode,
    stakeUsdc,
    poissonA,
    poissonB,
    poissonK,
    dirichletOutcome,
    normalThreshold,
  ]);

  const buildBuyTx = async () => {
    if (!account?.address) {
      setStatus(t("common.connectWallet"));
      return;
    }
    if (!poolId) {
      setStatus(t("common.fillPoolId"));
      return;
    }
    if (market.kind === "normal" && mode === "structured_note") {
      if (Number(normalCap) <= Number(normalStrike)) {
        setStatus(t("trade.errStructuredNote"));
        return;
      }
    }
    if (market.kind === "normal" && mode === "range_note") {
      if (Number(normalUpper) < Number(normalLower)) {
        setStatus(t("trade.errRangeNote"));
        return;
      }
    }
    try {
      const { parseUsdcAmount } = await import("@/lib/usdc");
      const stakeBase = parseUsdcAmount(stakeUsdc);
      const tx = new Transaction();
      const payment = await prepareUsdcPayment(
        tx,
        client,
        account.address,
        stakeBase,
      );

      appendBuyMoveCall(tx, market.kind, payment, poolId, {
        poolId,
        mode,
        poissonA: Number(poissonA),
        poissonB: Number(poissonB),
        poissonK: Number(poissonK),
        dirichletOutcome: Number(dirichletOutcome),
        normalA: Number(normalA),
        normalB: Number(normalB),
        normalThreshold: Number(normalThreshold),
        normalStrike: Number(normalStrike),
        normalCap: Number(normalCap),
        normalLower: Number(normalLower),
        normalUpper: Number(normalUpper),
        normalBarrier: Number(normalBarrier),
        betaA: Number(betaA),
        betaB: Number(betaB),
      });

      signAndExecute(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { transaction: tx as any },
        {
          onSuccess: (r) => {
            setStatus(t("trade.success", { digest: r.digest?.slice(0, 20) ?? "" }));
            setBalanceKey((k) => k + 1);
          },
          onError: (e) => setStatus(t("trade.failed", { message: e.message })),
        },
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t("trade.buildFailed"));
    }
  };

  const showDirichletOnly =
    market.kind === "dirichlet" || market.kind === "beta";

  return (
    <div className="card panel">
      <h2>{t("trade.panelTitle")}</h2>
      {!account && (
        <p className="hint">{t("trade.connectHint")}</p>
      )}
      {modeHint && <p className="hint">{modeHint}</p>}
      {account && (
        <>
          <UsdcBalance key={balanceKey} />
          <MintUsdcButton onMinted={() => setBalanceKey((k) => k + 1)} />
        </>
      )}

      <label>{t("trade.poolObjectId")}</label>
      <input
        value={poolId}
        onChange={(e) => setPoolId(e.target.value)}
        placeholder="0x…"
      />

      {!showDirichletOnly && (
        <>
          <label>{t("trade.contractType")}</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ContractMode)}
          >
            <option value="interval">{t("trade.interval")}</option>
            <option value="digital">{t("trade.digital")}</option>
            {market.kind === "normal" && (
              <>
                <option value="linear_call">{t("trade.modeLinearCall")}</option>
                <option value="linear_put">{t("trade.modeLinearPut")}</option>
                <option value="straddle">{t("trade.modeStraddle")}</option>
                <option value="variance_swap">{t("trade.modeVarianceSwap")}</option>
                <option value="structured_note">{t("trade.modeStructuredNote")}</option>
                <option value="range_note">{t("trade.modeRangeNote")}</option>
                <option value="barrier_note">{t("trade.modeBarrierNote")}</option>
              </>
            )}
          </select>
        </>
      )}

      {market.kind === "poisson" && mode === "interval" && (
        <div className="field-row">
          <div>
            <label>{t("trade.poissonIntervalA")}</label>
            <input value={poissonA} onChange={(e) => setPoissonA(e.target.value)} />
          </div>
          <div>
            <label>{t("trade.poissonIntervalB")}</label>
            <input value={poissonB} onChange={(e) => setPoissonB(e.target.value)} />
          </div>
        </div>
      )}
      {market.kind === "poisson" && mode === "digital" && (
        <>
          <label>{t("trade.poissonDigitalK")}</label>
          <input value={poissonK} onChange={(e) => setPoissonK(e.target.value)} />
        </>
      )}

      {market.kind === "beta" && (
        <div className="field-row">
          <div>
            <label>{t("trade.betaLowerHint")}</label>
            <input value={betaA} onChange={(e) => setBetaA(e.target.value)} />
          </div>
          <div>
            <label>{t("trade.betaUpperHint")}</label>
            <input value={betaB} onChange={(e) => setBetaB(e.target.value)} />
          </div>
        </div>
      )}

      {market.kind === "dirichlet" && (
        <>
          <label>{t("trade.dirichletOutcome")}</label>
          <select
            value={dirichletOutcome}
            onChange={(e) => setDirichletOutcome(e.target.value)}
          >
            <option value="0">{t("trade.dirichletHome")}</option>
            <option value="1">{t("trade.dirichletDraw")}</option>
            <option value="2">{t("trade.dirichletAway")}</option>
          </select>
        </>
      )}

      {market.kind === "normal" && mode === "interval" && (
        <div className="field-row">
          <div>
            <label>{t("trade.normalIntervalLower")}</label>
            <input value={normalA} onChange={(e) => setNormalA(e.target.value)} />
          </div>
          <div>
            <label>{t("trade.normalIntervalUpper")}</label>
            <input value={normalB} onChange={(e) => setNormalB(e.target.value)} />
          </div>
        </div>
      )}
      {market.kind === "normal" && mode === "digital" && (
        <>
          <label>{t("trade.normalDigitalThreshold")}</label>
          <input
            value={normalThreshold}
            onChange={(e) => setNormalThreshold(e.target.value)}
          />
        </>
      )}
      {market.kind === "normal" &&
        (mode === "linear_call" ||
          mode === "linear_put" ||
          mode === "straddle" ||
          mode === "variance_swap") && (
          <>
            <label>{t("trade.normalStrikeTenths")}</label>
            <input
              value={normalStrike}
              onChange={(e) => setNormalStrike(e.target.value)}
            />
          </>
        )}
      {market.kind === "normal" && mode === "structured_note" && (
        <div className="field-row">
          <div>
            <label>{t("trade.normalStrikeTenths")}</label>
            <input
              value={normalStrike}
              onChange={(e) => setNormalStrike(e.target.value)}
            />
          </div>
          <div>
            <label>{t("trade.normalCapTenths")}</label>
            <input value={normalCap} onChange={(e) => setNormalCap(e.target.value)} />
          </div>
        </div>
      )}
      {market.kind === "normal" && mode === "range_note" && (
        <div className="field-row">
          <div>
            <label>{t("trade.normalLowerTenths")}</label>
            <input value={normalLower} onChange={(e) => setNormalLower(e.target.value)} />
          </div>
          <div>
            <label>{t("trade.normalUpperTenths")}</label>
            <input value={normalUpper} onChange={(e) => setNormalUpper(e.target.value)} />
          </div>
        </div>
      )}
      {market.kind === "normal" && mode === "barrier_note" && (
        <>
          <label>{t("trade.normalBarrierTenths")}</label>
          <input
            value={normalBarrier}
            onChange={(e) => setNormalBarrier(e.target.value)}
          />
        </>
      )}

      <label>{t("trade.stakeUsdc")}</label>
      <input
        value={stakeUsdc}
        onChange={(e) => setStakeUsdc(e.target.value)}
        placeholder="1.0"
      />
      <p className="hint">
        {t("trade.stakeHint")}
        {market.kind === "dirichlet" && t("trade.stakeHintDirichlet")}
        {market.kind === "beta" && t("trade.stakeHintBeta")}
      </p>

      {quote && (
        <ul className="pos-meta">
          <li>{t("trade.quoteWin", { percent: quote.entryProbPercent.toFixed(2) })}</li>
          <li>{t("trade.quotePayout", { amount: (Number(quote.payoutUsdc) / 1e6).toFixed(4) })}</li>
          <li>{t("trade.quoteRoi", { roi: (quote.impliedRoiBps / 100).toFixed(2) })}</li>
        </ul>
      )}

      <button
        type="button"
        className="primary"
        disabled={!account || isPending}
        onClick={() => void buildBuyTx()}
      >
        {isPending ? t("trade.signing") : t("trade.buyUsdc")}
      </button>
      {status && <p className="hint">{status}</p>}
      <p className="hint">
        {t("trade.preset", { json: JSON.stringify(defaultTradeParams(market.kind, mode)) })}
      </p>
    </div>
  );
}
