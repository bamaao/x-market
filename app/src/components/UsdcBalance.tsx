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
