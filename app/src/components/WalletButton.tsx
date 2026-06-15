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

import dynamic from "next/dynamic";
import { useClientMounted } from "@/hooks/useClientMounted";
import { useT } from "@/i18n/context";

const ConnectButton = dynamic(
  () => import("@mysten/dapp-kit").then((mod) => mod.ConnectButton),
  { ssr: false },
);

export function WalletButton() {
  const t = useT();
  const mounted = useClientMounted();

  if (!mounted) {
    return (
      <button type="button" className="primary wallet-connect-placeholder" disabled>
        {t("wallet.connect")}
      </button>
    );
  }

  return <ConnectButton />;
}
