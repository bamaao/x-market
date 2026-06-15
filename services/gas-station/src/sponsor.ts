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

import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64, toBase64 } from "@mysten/sui/utils";
import { validateTransactionData } from "./whitelist.js";

export interface SponsorRequest {
  transactionKindBcs: string;
  sender: string;
}

export interface SponsorResponse {
  transactionBytes: string;
  sponsorSignature: string;
  gasOwner: string;
}

function loadGasPayerKeypair(): Ed25519Keypair {
  const raw = process.env.GAS_PAYER_PRIVATE_KEY;
  if (!raw) {
    throw new Error("GAS_PAYER_PRIVATE_KEY is not set");
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith("suiprivkey")) {
    const { secretKey } = decodeSuiPrivateKey(trimmed);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }
  const bytes = fromBase64(trimmed);
  return Ed25519Keypair.fromSecretKey(bytes);
}

async function pickGasCoins(
  client: SuiJsonRpcClient,
  owner: string,
  minBalance: bigint = 50_000_000n,
) {
  const coins = await client.getCoins({ owner, coinType: "0x2::sui::SUI" });
  const sorted = coins.data
    .filter((c: { balance: string }) => BigInt(c.balance) >= minBalance)
    .sort(
      (a: { balance: string }, b: { balance: string }) =>
        Number(BigInt(b.balance) - BigInt(a.balance)),
    );
  if (!sorted.length) {
    throw new Error("Gas payer has no SUI coins with sufficient balance");
  }
  const primary = sorted[0];
  return [
    {
      objectId: primary.coinObjectId,
      version: primary.version,
      digest: primary.digest,
    },
  ];
}

export async function sponsorTransaction(
  req: SponsorRequest,
): Promise<SponsorResponse> {
  const network =
    process.env.SUI_NETWORK === "mainnet" ? "mainnet" : "testnet";
  const rpcUrl =
    process.env.SUI_RPC_URL ?? getJsonRpcFullnodeUrl(network);
  const client = new SuiJsonRpcClient({ url: rpcUrl, network });
  const gasPayer = loadGasPayerKeypair();
  const gasOwner = gasPayer.getPublicKey().toSuiAddress();

  const kindBytes = fromBase64(req.transactionKindBcs);
  const tx = Transaction.fromKind(kindBytes);
  tx.setSender(req.sender);
  tx.setGasOwner(gasOwner);
  tx.setGasPayment(await pickGasCoins(client, gasOwner));

  const built = await tx.build({ client });
  const parsed = Transaction.from(built);
  const data = parsed.getData();
  const validation = validateTransactionData({
    commands: data.commands as Array<Record<string, unknown>>,
    inputs: data.inputs as Array<{ Pure?: { bytes: string } }>,
  });
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const dryRun = await client.dryRunTransactionBlock({
    transactionBlock: toBase64(built),
  });
  if (dryRun.effects.status.status !== "success") {
    const err = dryRun.effects.status.error ?? "dry-run failed";
    throw new Error(`dry-run: ${err}`);
  }

  const { signature } = await gasPayer.signTransaction(built);
  return {
    transactionBytes: toBase64(built),
    sponsorSignature: signature,
    gasOwner,
  };
}
