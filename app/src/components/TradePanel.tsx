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

type Props = { market: SeedMarket };

export function TradePanel({ market }: Props) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [poolId, setPoolId] = useState(() => defaultPoolId(market.id));
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
    if (mode === "linear_call") return "Linear Call：收益随 X 高于 K 的幅度线性增加。";
    if (mode === "linear_put") return "Linear Put：收益随 X 低于 K 的幅度线性增加。";
    if (mode === "straddle") return "Straddle：双向波动受益，|X-K| 越大，收益越高。";
    if (mode === "variance_swap")
      return "Variance Swap：收益与 (X-K)^2 相关，尾部波动最敏感。";
    if (mode === "structured_note")
      return "Structured Note：封顶看涨，收益 = min(max(X-K,0), C-K)。请保证 C > K。";
    if (mode === "range_note")
      return "Range Note：到期结果落在 [L,U] 才有固定票息。请保证 U >= L。";
    if (mode === "barrier_note")
      return "Barrier Note：到期结果达到阈值 B（X>=B）即触发固定票息。";
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
      setStatus("请先连接钱包");
      return;
    }
    if (!poolId) {
      setStatus("请填写 Pool 对象 ID");
      return;
    }
    if (market.kind === "normal" && mode === "structured_note") {
      if (Number(normalCap) <= Number(normalStrike)) {
        setStatus("参数错误：Structured Note 需要 C > K");
        return;
      }
    }
    if (market.kind === "normal" && mode === "range_note") {
      if (Number(normalUpper) < Number(normalLower)) {
        setStatus("参数错误：Range Note 需要 U >= L");
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
            setStatus(`成功: ${r.digest?.slice(0, 20) ?? ""}…`);
            setBalanceKey((k) => k + 1);
          },
          onError: (e) => setStatus(`失败: ${e.message}`),
        },
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "交易构建失败");
    }
  };

  const showDirichletOnly =
    market.kind === "dirichlet" || market.kind === "beta";

  return (
    <div className="card panel">
      <h2>交易面板</h2>
      {!account && (
        <p className="hint">请先连接 Sui 钱包（页眉 Connect）。</p>
      )}
      {modeHint && <p className="hint">{modeHint}</p>}
      {account && (
        <>
          <UsdcBalance key={balanceKey} />
          <MintUsdcButton onMinted={() => setBalanceKey((k) => k + 1)} />
        </>
      )}

      <label>MarketPool 对象 ID</label>
      <input
        value={poolId}
        onChange={(e) => setPoolId(e.target.value)}
        placeholder="0x…"
      />

      {!showDirichletOnly && (
        <>
          <label>合约类型</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ContractMode)}
          >
            <option value="interval">区间合约</option>
            <option value="digital">数字期权</option>
            {market.kind === "normal" && (
              <>
                <option value="linear_call">线性 Call</option>
                <option value="linear_put">线性 Put</option>
                <option value="straddle">Straddle</option>
                <option value="variance_swap">Variance Swap</option>
                <option value="structured_note">Structured Note（封顶看涨）</option>
                <option value="range_note">Range Note（区间票息）</option>
                <option value="barrier_note">Barrier Note（障碍票息）</option>
              </>
            )}
          </select>
        </>
      )}

      {market.kind === "poisson" && mode === "interval" && (
        <div className="field-row">
          <div>
            <label>区间 a (k)</label>
            <input value={poissonA} onChange={(e) => setPoissonA(e.target.value)} />
          </div>
          <div>
            <label>区间 b (k)</label>
            <input value={poissonB} onChange={(e) => setPoissonB(e.target.value)} />
          </div>
        </div>
      )}
      {market.kind === "poisson" && mode === "digital" && (
        <>
          <label>结果 k（P(X=k)）</label>
          <input value={poissonK} onChange={(e) => setPoissonK(e.target.value)} />
        </>
      )}

      {market.kind === "beta" && (
        <div className="field-row">
          <div>
            <label>区间下界 (‰，350=35%)</label>
            <input value={betaA} onChange={(e) => setBetaA(e.target.value)} />
          </div>
          <div>
            <label>区间上界 (‰，400=40%)</label>
            <input value={betaB} onChange={(e) => setBetaB(e.target.value)} />
          </div>
        </div>
      )}

      {market.kind === "dirichlet" && (
        <>
          <label>结果（0=主胜 1=平 2=客胜）</label>
          <select
            value={dirichletOutcome}
            onChange={(e) => setDirichletOutcome(e.target.value)}
          >
            <option value="0">主胜</option>
            <option value="1">平局</option>
            <option value="2">客胜</option>
          </select>
        </>
      )}

      {market.kind === "normal" && mode === "interval" && (
        <div className="field-row">
          <div>
            <label>区间下界 (tenths)</label>
            <input value={normalA} onChange={(e) => setNormalA(e.target.value)} />
          </div>
          <div>
            <label>区间上界 (tenths)</label>
            <input value={normalB} onChange={(e) => setNormalB(e.target.value)} />
          </div>
        </div>
      )}
      {market.kind === "normal" && mode === "digital" && (
        <>
          <label>阈值 (tenths，P(X≥阈值))</label>
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
            <label>执行价 K (tenths)</label>
            <input
              value={normalStrike}
              onChange={(e) => setNormalStrike(e.target.value)}
            />
          </>
        )}
      {market.kind === "normal" && mode === "structured_note" && (
        <div className="field-row">
          <div>
            <label>执行价 K (tenths)</label>
            <input
              value={normalStrike}
              onChange={(e) => setNormalStrike(e.target.value)}
            />
          </div>
          <div>
            <label>封顶价 C (tenths)</label>
            <input value={normalCap} onChange={(e) => setNormalCap(e.target.value)} />
          </div>
        </div>
      )}
      {market.kind === "normal" && mode === "range_note" && (
        <div className="field-row">
          <div>
            <label>区间下界 L (tenths)</label>
            <input value={normalLower} onChange={(e) => setNormalLower(e.target.value)} />
          </div>
          <div>
            <label>区间上界 U (tenths)</label>
            <input value={normalUpper} onChange={(e) => setNormalUpper(e.target.value)} />
          </div>
        </div>
      )}
      {market.kind === "normal" && mode === "barrier_note" && (
        <>
          <label>障碍位 B (tenths，X≥B 生效)</label>
          <input
            value={normalBarrier}
            onChange={(e) => setNormalBarrier(e.target.value)}
          />
        </>
      )}

      <label>Stake (USDC)</label>
      <input
        value={stakeUsdc}
        onChange={(e) => setStakeUsdc(e.target.value)}
        placeholder="1.0"
      />
      <p className="hint">
        自动合并钱包内多枚 USDC 后支付；Gas 仍为 SUI。
        {market.kind === "dirichlet" && " Dirichlet 为单结果买入（类数字期权）。"}
        {market.kind === "beta" && " Beta 为得票率区间买入（链上 CDF 定价）。"}
      </p>

      {quote && (
        <ul className="pos-meta">
          <li>定价预览：胜率约 {quote.entryProbPercent.toFixed(2)}%</li>
          <li>命中兑付约 {(Number(quote.payoutUsdc) / 1e6).toFixed(4)} USDC</li>
          <li>隐含 ROI {(quote.impliedRoiBps / 100).toFixed(2)}%（链下估算）</li>
        </ul>
      )}

      <button
        type="button"
        className="primary"
        disabled={!account || isPending}
        onClick={() => void buildBuyTx()}
      >
        {isPending ? "签名中…" : "用 USDC 买入"}
      </button>
      {status && <p className="hint">{status}</p>}
      <p className="hint">
        预设：{JSON.stringify(defaultTradeParams(market.kind, mode))}
      </p>
    </div>
  );
}
