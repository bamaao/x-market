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
import {
  appendAuctionBid,
  appendFinalizeAuction,
} from "@/lib/auction";
import { parseUsdcAmount } from "@/lib/usdc";
import { prepareUsdcPayment } from "@/lib/usdc";
import { MintUsdcButton } from "./MintUsdcButton";
import { UsdcBalance } from "./UsdcBalance";

const CLOCK_ID =
  process.env.NEXT_PUBLIC_SUI_CLOCK ??
  "0x6";

type Props = { market: SeedMarket };

const BUCKET_LABELS: Record<string, [string, string, string]> = {
  poisson: ["低进球 (λ≈1.5)", "中 (λ≈2.5)", "高 (λ≈5.0)"],
  dirichlet: ["主胜", "平局", "客胜"],
  normal: ["低预期 (μ≈2.0%)", "中 (μ≈2.5%)", "高 (μ≈3.0%)"],
};

export function AuctionPanel({ market }: Props) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [poolId, setPoolId] = useState(() => defaultPoolId(market.id));
  const [bucket, setBucket] = useState("0");
  const [amount, setAmount] = useState("10");
  const [status, setStatus] = useState<string | null>(null);
  const [balanceKey, setBalanceKey] = useState(0);

  const labels = BUCKET_LABELS[market.kind] ?? BUCKET_LABELS.poisson;

  const bid = async () => {
    if (!account?.address) {
      setStatus("请先连接钱包");
      return;
    }
    if (!poolId) {
      setStatus("请填写竞价池 Pool ID（Auction 状态）");
      return;
    }
    try {
      const base = parseUsdcAmount(amount);
      const tx = new Transaction();
      const payment = await prepareUsdcPayment(
        tx,
        client,
        account.address,
        base,
      );
      appendAuctionBid(tx, poolId, payment, Number(bucket), CLOCK_ID);
      signAndExecute(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { transaction: tx as any },
        {
          onSuccess: (r) =>
            setStatus(`竞价成功: ${r.digest?.slice(0, 18)}…`),
          onError: (e) => setStatus(`失败: ${e.message}`),
        },
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "交易失败");
    }
  };

  const finalize = () => {
    if (!poolId) {
      setStatus("请填写 Pool ID");
      return;
    }
    const tx = new Transaction();
    appendFinalizeAuction(tx, market.kind, poolId, CLOCK_ID);
    signAndExecute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { transaction: tx as any },
      {
        onSuccess: (r) =>
          setStatus(`定标完成 → Trading: ${r.digest?.slice(0, 18)}…`),
        onError: (e) => setStatus(`失败: ${e.message}`),
      },
    );
  };

  return (
    <div className="card panel">
      <h2>Opening Auction（Phase 1.5）</h2>
      <p className="hint">
        Auction → Trading：竞价 USDC 入桶，截止后 finalize 定标 Prior，Vault 内资金按 1:1 记为初始 LP。
      </p>
      {account && (
        <>
          <UsdcBalance key={balanceKey} />
          <MintUsdcButton onMinted={() => setBalanceKey((k) => k + 1)} />
        </>
      )}
      <label>Auction Pool ID</label>
      <input value={poolId} onChange={(e) => setPoolId(e.target.value)} />
      <label>桶（0/1/2）</label>
      <select value={bucket} onChange={(e) => setBucket(e.target.value)}>
        <option value="0">{labels[0]}</option>
        <option value="1">{labels[1]}</option>
        <option value="2">{labels[2]}</option>
      </select>
      <label>竞价 USDC</label>
      <input value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div className="btn-row">
        <button
          type="button"
          className="secondary"
          disabled={!account || isPending}
          onClick={() => void bid()}
        >
          auction_bid
        </button>
        <button
          type="button"
          className="secondary"
          disabled={isPending}
          onClick={finalize}
        >
          finalize_auction
        </button>
      </div>
      {status && <p className="hint">{status}</p>}
    </div>
  );
}
