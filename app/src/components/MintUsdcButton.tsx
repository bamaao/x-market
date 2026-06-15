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

import { useCurrentAccount } from "@mysten/dapp-kit";
import { NETWORK } from "@/lib/markets";
import { useT } from "@/i18n/context";

const TESTNET_USDC_FAUCET_URL =
  "https://developers.circle.com/stablecoins/quickstart-setup-transfer-usdc-sui";

type Props = { onMinted?: () => void };

/** Testnet: link to Circle USDC faucet. Mainnet: no mint (use real USDC). */
export function MintUsdcButton(_props: Props) {
  const account = useCurrentAccount();
  const t = useT();

  if (!account || NETWORK === "mainnet") return null;

  return (
    <div className="mint-row">
      <p className="hint">
        {t("wallet.testnetHint")}{" "}
        <a href={TESTNET_USDC_FAUCET_URL} target="_blank" rel="noreferrer">
          {t("wallet.circleFaucet")}
        </a>
        {t("wallet.orTransfer")}
      </p>
    </div>
  );
}
