"use client";

import { useState } from "react";
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

  const [poissonA, setPoissonA] = useState("2");
  const [poissonB, setPoissonB] = useState("3");
  const [poissonK, setPoissonK] = useState("2");
  const [dirichletOutcome, setDirichletOutcome] = useState("0");
  const [normalA, setNormalA] = useState("25");
  const [normalB, setNormalB] = useState("27");
  const [normalThreshold, setNormalThreshold] = useState("30");

  const buildBuyTx = async () => {
    if (!account?.address) {
      setStatus("请先连接钱包");
      return;
    }
    if (!poolId) {
      setStatus("请填写 Pool 对象 ID");
      return;
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

  const showDirichletOnly = market.kind === "dirichlet";

  return (
    <div className="card panel">
      <h2>交易面板</h2>
      {!account && (
        <p className="hint">请先连接 Sui 钱包（页眉 Connect）。</p>
      )}
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

      <label>Stake (USDC)</label>
      <input
        value={stakeUsdc}
        onChange={(e) => setStakeUsdc(e.target.value)}
        placeholder="1.0"
      />
      <p className="hint">
        自动合并钱包内多枚 USDC 后支付；Gas 仍为 SUI。
        {showDirichletOnly && " Dirichlet 为单结果买入（类数字期权）。"}
      </p>

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
