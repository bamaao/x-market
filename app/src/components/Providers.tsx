"use client";

import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import "@mysten/dapp-kit/dist/index.css";
import { NETWORK } from "@/lib/markets";
import { primaryRpcUrl } from "@/lib/rpc-urls";
import { I18nProvider } from "@/i18n/context";

const queryClient = new QueryClient();

const networks = {
  testnet: { url: primaryRpcUrl("testnet"), network: "testnet" as const },
  devnet: { url: getJsonRpcFullnodeUrl("devnet"), network: "devnet" as const },
  mainnet: { url: primaryRpcUrl("mainnet"), network: "mainnet" as const },
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <SuiClientProvider networks={networks} defaultNetwork={NETWORK}>
          <WalletProvider autoConnect>{children}</WalletProvider>
        </SuiClientProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
