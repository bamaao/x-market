"use client";

import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";
import { parseUsdcAmount, FAUCET_PACKAGE_ID, TREASURY_CAP_ID } from "@/lib/usdc";

type Props = { onMinted?: () => void };

export function MintUsdcButton({ onMinted }: Props) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [amount, setAmount] = useState("1000");
  const [msg, setMsg] = useState<string | null>(null);

  const mint = () => {
    if (!TREASURY_CAP_ID) {
      setMsg("未配置 NEXT_PUBLIC_TREASURY_CAP");
      return;
    }
    try {
      const base = parseUsdcAmount(amount);
      const tx = new Transaction();
      tx.moveCall({
        target: `${FAUCET_PACKAGE_ID}::faucet::mint_to_sender`,
        arguments: [tx.object(TREASURY_CAP_ID), tx.pure.u64(base)],
      });
      signAndExecute(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { transaction: tx as any },
        {
          onSuccess: () => {
            setMsg(`已铸造 ${amount} USDC`);
            onMinted?.();
          },
          onError: (e) => setMsg(`失败: ${e.message}`),
        },
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "无效金额");
    }
  };

  if (!account) return null;

  return (
    <div className="mint-row">
      <label>铸造测试 USDC（Testnet）</label>
      <div className="mint-inline">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1000"
        />
        <button
          type="button"
          className="secondary"
          disabled={isPending}
          onClick={mint}
        >
          {isPending ? "…" : "铸造"}
        </button>
      </div>
      {msg && <p className="hint">{msg}</p>}
    </div>
  );
}
