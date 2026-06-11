"use client";

import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { defaultPoolId } from "@/lib/markets";
import type { SeedMarket } from "@/lib/markets";
import { appendDepositLiquidity } from "@/lib/lp";
import { parseUsdcAmount } from "@/lib/usdc";
import { MintUsdcButton } from "./MintUsdcButton";
import { UsdcBalance } from "./UsdcBalance";

type Props = { market: SeedMarket };

export function LpDepositPanel({ market }: Props) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [poolId, setPoolId] = useState(() => defaultPoolId(market));
  const [amount, setAmount] = useState("100");
  const [status, setStatus] = useState<string | null>(null);
  const [balanceKey, setBalanceKey] = useState(0);

  const deposit = async () => {
    if (!account?.address) {
      setStatus("请先连接钱包");
      return;
    }
    if (!poolId) {
      setStatus("请填写 Pool ID");
      return;
    }
    try {
      const base = parseUsdcAmount(amount);
      const tx = new Transaction();
      await appendDepositLiquidity(tx, client, account.address, poolId, base);
      signAndExecute(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { transaction: tx as any },
        {
          onSuccess: (r) => {
            setStatus(`LP 份额已铸造: ${r.digest?.slice(0, 18)}…`);
            setBalanceKey((k) => k + 1);
          },
          onError: (e) => setStatus(`失败: ${e.message}`),
        },
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "交易失败");
    }
  };

  return (
    <div className="card panel">
      <h2>LP 申购（Phase 1.5）</h2>
      <p className="hint">
        按 NAV 铸造 LpShare；Dirichlet 池会等比放大 α，概率形状不变。
      </p>
      {account && (
        <>
          <UsdcBalance key={balanceKey} />
          <MintUsdcButton onMinted={() => setBalanceKey((k) => k + 1)} />
        </>
      )}
      <label>MarketPool ID</label>
      <input value={poolId} onChange={(e) => setPoolId(e.target.value)} />
      <label>注入 USDC</label>
      <input value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button
        type="button"
        className="secondary"
        disabled={!account || isPending}
        onClick={() => void deposit()}
      >
        {isPending ? "签名中…" : "deposit_liquidity"}
      </button>
      {status && <p className="hint">{status}</p>}
    </div>
  );
}
