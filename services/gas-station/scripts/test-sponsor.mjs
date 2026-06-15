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

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const envText = readFileSync(join(root, "app/.env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const PACKAGE_ID = env.NEXT_PUBLIC_PACKAGE_ID;
const REGISTRY = env.NEXT_PUBLIC_PROPHET_REGISTRY_ID;
const POOL = env.NEXT_PUBLIC_POOL_POISSON;
const SENDER = "0x87e487cd6b1c7a53f91999eb3a5372ced201b614b26924ba4cc1d282a2240c07";

const client = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl("testnet"),
  network: "testnet",
});

const poolObj = await client.getObject({
  id: POOL,
  options: { showContent: true },
});
const maturity = Number(poolObj.data?.content?.fields?.maturity_ts ?? 0);
if (!maturity) {
  throw new Error("failed to read pool maturity_ts");
}

const tx = new Transaction();
tx.setSender(SENDER);
tx.moveCall({
  target: `${PACKAGE_ID}::prophet_registry::commit_private_prophecy`,
  arguments: [
    tx.object(REGISTRY),
    tx.object(POOL),
    tx.pure.vector(
      "u8",
      Array.from(new TextEncoder().encode("testnet:local:gasstation01")),
    ),
    tx.pure.vector("u8", new Uint8Array(32).fill(1)),
    tx.pure.vector("u8", new Uint8Array(32).fill(2)),
    tx.pure.u64(2),
    tx.pure.u64(0),
    tx.pure.u64(maturity),
  ],
});

const kindBytes = await tx.build({ client, onlyTransactionKind: true });
const res = await fetch("http://localhost:8787/v1/sponsor", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    transactionKindBcs: toBase64(kindBytes),
    sender: SENDER,
  }),
});
const body = await res.json();
if (!res.ok) {
  console.error("Sponsor failed:", body);
  process.exit(1);
}
console.log("Sponsor OK");
console.log("gasOwner:", body.gasOwner);
console.log("txBytes length:", body.transactionBytes?.length ?? 0);
console.log("sponsorSignature length:", body.sponsorSignature?.length ?? 0);
