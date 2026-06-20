/**
 * E2E: Seal → Indexer blob → 钱包 Commit（等同 /prophet 页流程）
 * 用法: npx tsx scripts/e2e-commit.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadKeeperKeypair } from "./lib/load-keeper-key.js";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path: string) {
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i);
    const v = t.slice(i + 1);
    process.env[k] = v;
  }
}

loadEnvFile(join(appRoot, ".env.local"));

async function main() {
  const { SuiJsonRpcClient, getJsonRpcFullnodeUrl } = await import(
    "@mysten/sui/jsonRpc"
  );
  const { Transaction } = await import("@mysten/sui/transactions");
  const {
    appendCommitPrivateProphecy,
    buildProphecyPayload,
    canonicalProphecyJson,
    extractProphecyIdFromTx,
    hashProphecyPlaintext,
  } = await import("../src/lib/prophet.js");
  const { encryptProphecyPayload, generateSealId } = await import(
    "../src/lib/seal-prophet.js"
  );
  const { uploadProphecyBlob } = await import("../src/lib/prophet-blob-upload.js");

  const registryId = process.env.NEXT_PUBLIC_PROPHET_REGISTRY_ID;
  const poolId = process.env.NEXT_PUBLIC_POOL_POISSON;
  const packageId = process.env.NEXT_PUBLIC_PACKAGE_ID;
  if (!registryId || !poolId || !packageId) {
    throw new Error("Missing env: PROPHET_REGISTRY / POOL / PACKAGE_ID");
  }
  console.log("package:", packageId);

  const keypair = await loadKeeperKeypair();
  const sender = keypair.getPublicKey().toSuiAddress();
  const client = new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl("testnet"),
  });

  const poolObj = await client.getObject({
    id: poolId,
    options: { showContent: true },
  });
  const fields = (poolObj.data?.content as { fields?: { maturity_ts?: string } })
    ?.fields;
  const maturity = Number(fields?.maturity_ts ?? 0);
  if (!maturity) throw new Error("Could not read pool maturity_ts");

  const payload = buildProphecyPayload(poolId, 2, "e2e-commit test analysis");
  const json = canonicalProphecyJson(payload);
  const hash = hashProphecyPlaintext(payload, poolId, 0n);
  const sealId = generateSealId();

  console.log("[1/4] Seal 加密…");
  const encrypted = await encryptProphecyPayload(
    sealId,
    new TextEncoder().encode(json),
  );

  console.log("[2/4] Indexer 上传 blob…");
  const uploaded = await uploadProphecyBlob(poolId, encrypted);
  if (!uploaded.ok) throw new Error(uploaded.error);
  const blobId = uploaded.blobId;
  console.log("  blobId:", blobId);

  console.log("[3/4] 构建 PTB 并签名…");
  const tx = new Transaction();
  appendCommitPrivateProphecy(tx, {
    registryId,
    poolId,
    blobId,
    sealId,
    plaintextHash: hash,
    predictedValue: 2,
    predictedLow: 2,
    predictedHigh: 2,
    unlockPrice: 0n,
    lockTime: maturity,
  });
  tx.setSender(sender);
  const bytes = await tx.build({ client });
  const { signature } = await keypair.signTransaction(bytes);

  console.log("[4/4] 执行链上 Commit…");
  const result = await client.executeTransactionBlock({
    transactionBlock: bytes,
    signature,
    options: { showEffects: true, showObjectChanges: true },
  });

  if (result.effects?.status.status !== "success") {
    throw new Error(result.effects?.status.error ?? "execute failed");
  }

  console.log("  digest:", result.digest);
  let prophecyId: string | null = null;
  prophecyId = await extractProphecyIdFromTx(
    client as Parameters<typeof extractProphecyIdFromTx>[0],
    result.digest,
  );
  if (!prophecyId) {
    for (const ch of result.objectChanges ?? []) {
      if (
        ch.type === "created" &&
        "objectType" in ch &&
        String(ch.objectType).includes("PrivateProphecy")
      ) {
        prophecyId = (ch as { objectId: string }).objectId;
      }
    }
  }
  console.log("  prophecyId:", prophecyId);
  console.log(
    "\n✅ E2E Commit 成功 — 在 http://localhost:3000/prophet 选择 Poisson 池可看到预测",
  );
  return prophecyId;
}

main().catch((e) => {
  console.error("E2E failed:", (e as Error).message);
  process.exit(1);
});
