"use client";

import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { formatUsdcBaseUnits, usdcType } from "@/lib/usdc";
import { useT } from "@/i18n/context";

export function UsdcBalance() {
  const account = useCurrentAccount();
  const t = useT();
  const { data, isPending, refetch } = useSuiClientQuery(
    "getBalance",
    {
      owner: account?.address ?? "",
      coinType: usdcType(),
    },
    { enabled: !!account?.address },
  );

  if (!account) return null;

  const total = data?.totalBalance ? BigInt(data.totalBalance) : 0n;

  return (
    <p className="hint">
      {t("wallet.usdcBalance", {
        amount: isPending ? "…" : formatUsdcBaseUnits(total),
      })}{" "}
      <button
        type="button"
        className="link-btn"
        onClick={() => refetch()}
        aria-label={t("wallet.refreshBalance")}
      >
        ↻
      </button>
    </p>
  );
}
