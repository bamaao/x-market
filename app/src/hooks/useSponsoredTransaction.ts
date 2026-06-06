"use client";

import { useCallback, useState } from "react";
import {
  useCurrentAccount,
  useSignTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";
import {
  buildTransactionKind,
  isGasStationEnabled,
  requestSponsor,
} from "@/lib/gas-station";

export interface SponsoredExecuteResult {
  digest: string;
}

export function useSponsoredTransaction() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const [isPending, setIsPending] = useState(false);

  const executeSponsored = useCallback(
    async (tx: Transaction): Promise<SponsoredExecuteResult> => {
      if (!account?.address) {
        throw new Error("请先连接钱包");
      }
      if (!isGasStationEnabled()) {
        throw new Error("Gas Station 未配置（NEXT_PUBLIC_GAS_STATION_URL）");
      }
      setIsPending(true);
      try {
        const kindBytes = await buildTransactionKind(tx, client, account.address);
        const sponsored = await requestSponsor(kindBytes, account.address);
        const bytes = fromBase64(sponsored.transactionBytes);
        const { signature: userSignature } = await signTransaction({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          transaction: bytes as any,
        });
        const signatures =
          account.address === sponsored.gasOwner
            ? [userSignature]
            : [userSignature, sponsored.sponsorSignature];
        const result = await client.executeTransactionBlock({
          transactionBlock: bytes,
          signature: signatures,
          options: { showEffects: true },
        });
        if (result.effects?.status.status !== "success") {
          throw new Error(
            result.effects?.status.error ?? "赞助交易执行失败",
          );
        }
        return { digest: result.digest };
      } finally {
        setIsPending(false);
      }
    },
    [account?.address, client, signTransaction],
  );

  return {
    executeSponsored,
    isPending,
    enabled: isGasStationEnabled(),
  };
}
