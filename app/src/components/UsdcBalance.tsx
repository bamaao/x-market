"use client";

import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { formatUsdcBaseUnits, usdcType } from "@/lib/usdc";
import { PACKAGE_ID } from "@/lib/markets";

export function UsdcBalance() {
  const account = useCurrentAccount();
  const { data, isPending, refetch } = useSuiClientQuery(
    "getBalance",
    {
      owner: account?.address ?? "",
      coinType: usdcType(),
    },
    { enabled: !!account?.address && PACKAGE_ID !== "0x0" },
  );

  if (!account) return null;

  const total = data?.totalBalance ? BigInt(data.totalBalance) : 0n;

  return (
    <p className="hint">
      USDC 余额:{" "}
      {isPending ? "…" : formatUsdcBaseUnits(total)}{" "}
      <button
        type="button"
        className="link-btn"
        onClick={() => refetch()}
        aria-label="刷新余额"
      >
        ↻
      </button>
    </p>
  );
}
