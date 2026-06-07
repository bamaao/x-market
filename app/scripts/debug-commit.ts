import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

async function main() {
  const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  for (const line of readFileSync(join(appRoot, ".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    process.env[t.slice(0, i)] = t.slice(i + 1);
  }

  const { SuiJsonRpcClient, getJsonRpcFullnodeUrl } = await import(
    "@mysten/sui/jsonRpc"
  );
  const { Transaction } = await import("@mysten/sui/transactions");
  const {
    appendCommitPrivateProphecy,
    buildProphecyPayload,
    hashProphecyPlaintext,
  } = await import("../src/lib/prophet");

  const client = new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl("testnet"),
    network: "testnet",
  });
  const poolId = process.env.NEXT_PUBLIC_POOL_NORMAL!;
  const registryId = process.env.NEXT_PUBLIC_PROPHET_REGISTRY_ID!;
  const pool = await client.getObject({
    id: poolId,
    options: { showContent: true },
  });
  const maturity = Number(
    (pool.data?.content as { fields: { maturity_ts: string } }).fields
      .maturity_ts,
  );
  const payload = buildProphecyPayload(poolId, 25, "debug");
  const hash = hashProphecyPlaintext(payload);
  const sealId = new Uint8Array(32).fill(7);

  console.log({
    maturity,
    hashLen: hash.length,
    sealLen: sealId.length,
    blobLen: "6uOP48rcVFRChVO80qH6mtJMl8RcHDdBUBGf5mw5elg".length,
  });

  const tx = new Transaction();
  appendCommitPrivateProphecy(tx, {
    registryId,
    poolId,
    blobId: "6uOP48rcVFRChVO80qH6mtJMl8RcHDdBUBGf5mw5elg",
    sealId,
    plaintextHash: hash,
    predictedValue: 25,
    unlockPrice: 0n,
    lockTime: maturity,
  });

  const data = tx.getData();
  console.log(
    "lock_time pure bytes",
    data.inputs[7],
  );

  const inspect = await client.devInspectTransactionBlock({
    sender:
      "0x87e487cd6b1c7a53f91999eb3a5372ced201b614b26924ba4cc1d282a2240c07",
    transactionBlock: tx,
  });
  console.log("error:", inspect.error);
  console.log("status:", inspect.effects?.status);
}

main();
