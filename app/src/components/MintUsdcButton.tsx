"use client";

import { useCurrentAccount } from "@mysten/dapp-kit";
import { NETWORK } from "@/lib/markets";

const TESTNET_USDC_FAUCET_URL =
  "https://developers.circle.com/stablecoins/quickstart-setup-transfer-usdc-sui";

type Props = { onMinted?: () => void };

/** Testnet: link to Circle USDC faucet. Mainnet: no mint (use real USDC). */
export function MintUsdcButton(_props: Props) {
  const account = useCurrentAccount();

  if (!account || NETWORK === "mainnet") return null;

  return (
    <div className="mint-row">
      <p className="hint">
        测试网 USDC 可从{" "}
        <a href={TESTNET_USDC_FAUCET_URL} target="_blank" rel="noreferrer">
          Circle 测试网水龙头
        </a>
        领取，或从已有地址转入钱包。
      </p>
    </div>
  );
}
