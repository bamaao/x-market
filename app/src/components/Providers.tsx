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

import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import "@mysten/dapp-kit/dist/index.css";
import { NETWORK } from "@/lib/markets";
import { primaryRpcUrl } from "@/lib/rpc-urls";
import { I18nProvider } from "@/i18n/context";
import type { Locale } from "@/i18n/types";

const queryClient = new QueryClient();

const networks = {
  testnet: { url: primaryRpcUrl("testnet"), network: "testnet" as const },
  devnet: { url: getJsonRpcFullnodeUrl("devnet"), network: "devnet" as const },
  mainnet: { url: primaryRpcUrl("mainnet"), network: "mainnet" as const },
};

export function Providers({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider initialLocale={initialLocale}>
        <SuiClientProvider networks={networks} defaultNetwork={NETWORK}>
          <WalletProvider autoConnect>{children}</WalletProvider>
        </SuiClientProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
