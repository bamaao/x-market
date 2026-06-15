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
import { useT } from "@/i18n/context";
import { MintUsdcButton } from "./MintUsdcButton";
import { UsdcBalance } from "./UsdcBalance";

type Props = { market: SeedMarket };

export function LpDepositPanel({ market }: Props) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const t = useT();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [poolId, setPoolId] = useState(() => defaultPoolId(market));
  const [amount, setAmount] = useState("100");
  const [status, setStatus] = useState<string | null>(null);
  const [balanceKey, setBalanceKey] = useState(0);

  const deposit = async () => {
    if (!account?.address) {
      setStatus(t("common.connectWallet"));
      return;
    }
    if (!poolId) {
      setStatus(t("common.fillPoolId"));
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
            setStatus(t("lp.depositSuccess", { digest: r.digest?.slice(0, 18) ?? "" }));
            setBalanceKey((k) => k + 1);
          },
          onError: (e) => setStatus(t("trade.failed", { message: e.message })),
        },
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t("common.txFailed"));
    }
  };

  return (
    <div className="card panel">
      <h2>{t("lp.deposit")}</h2>
      <p className="hint">{t("lp.subtitle")}</p>
      {account && (
        <>
          <UsdcBalance key={balanceKey} />
          <MintUsdcButton onMinted={() => setBalanceKey((k) => k + 1)} />
        </>
      )}
      <label>{t("lp.poolIdLabel")}</label>
      <input value={poolId} onChange={(e) => setPoolId(e.target.value)} />
      <label>{t("lp.subscribeUsdc")}</label>
      <input value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button
        type="button"
        className="secondary"
        disabled={!account || isPending}
        onClick={() => void deposit()}
      >
        {isPending ? t("trade.signing") : "deposit_liquidity"}
      </button>
      {status && <p className="hint">{status}</p>}
    </div>
  );
}
