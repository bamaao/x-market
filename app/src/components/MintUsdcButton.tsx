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
