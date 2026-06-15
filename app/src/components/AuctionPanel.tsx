"use client";

import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { defaultPoolId, type SeedMarket } from "@/lib/markets";
import {
  appendAuctionBid,
  appendFinalizeAuction,
} from "@/lib/auction";
import { parseUsdcAmount } from "@/lib/usdc";
import { prepareUsdcPayment } from "@/lib/usdc";
import { localizedAuctionBucketLabel } from "@/i18n/domain";
import { useT } from "@/i18n/context";
import { MintUsdcButton } from "./MintUsdcButton";
import { UsdcBalance } from "./UsdcBalance";

const CLOCK_ID =
  process.env.NEXT_PUBLIC_SUI_CLOCK ??
  "0x6";

type Props = { market: SeedMarket };

export function AuctionPanel({ market }: Props) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const t = useT();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [poolId, setPoolId] = useState(() => defaultPoolId(market));
  const [bucket, setBucket] = useState("0");
  const [amount, setAmount] = useState("10");
  const [status, setStatus] = useState<string | null>(null);
  const [balanceKey, setBalanceKey] = useState(0);

  const labels = ([0, 1, 2] as const).map((i) =>
    localizedAuctionBucketLabel(market.kind, i, t),
  );

  const bid = async () => {
    if (!account?.address) {
      setStatus(t("common.connectWallet"));
      return;
    }
    if (!poolId) {
      setStatus(t("auction.fillPoolId"));
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
            setStatus(t("auction.bidSuccess", { digest: r.digest?.slice(0, 18) ?? "" })),
          onError: (e) => setStatus(t("trade.failed", { message: e.message })),
        },
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t("common.txFailed"));
    }
  };

  const finalize = () => {
    if (!poolId) {
      setStatus(t("common.fillPoolId"));
      return;
    }
    const tx = new Transaction();
    appendFinalizeAuction(tx, market.kind, poolId, CLOCK_ID);
    signAndExecute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { transaction: tx as any },
      {
        onSuccess: (r) =>
          setStatus(t("auction.finalizeSuccess", { digest: r.digest?.slice(0, 18) ?? "" })),
        onError: (e) => setStatus(t("trade.failed", { message: e.message })),
      },
    );
  };

  return (
    <div className="card panel">
      <h2>{t("auction.title")}</h2>
      <p className="hint">{t("auction.desc")}</p>
      {account && (
        <>
          <UsdcBalance key={balanceKey} />
          <MintUsdcButton onMinted={() => setBalanceKey((k) => k + 1)} />
        </>
      )}
      <label>{t("auction.poolIdLabel")}</label>
      <input value={poolId} onChange={(e) => setPoolId(e.target.value)} />
      <label>{t("auction.bucket")}</label>
      <select value={bucket} onChange={(e) => setBucket(e.target.value)}>
        <option value="0">{labels[0]}</option>
        <option value="1">{labels[1]}</option>
        <option value="2">{labels[2]}</option>
      </select>
      <label>{t("auction.bidUsdc")}</label>
      <input value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div className="btn-row">
        <button
          type="button"
          className="secondary"
          disabled={!account || isPending}
          onClick={() => void bid()}
        >
          {t("auction.bid")}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={isPending}
          onClick={finalize}
        >
          {t("auction.finalize")}
        </button>
      </div>
      {status && <p className="hint">{status}</p>}
    </div>
  );
}
