/**
 * E2E: Seal → Walrus → Gas Station 赞助 Commit（等同 /prophet 页流程）
 * 用法: npx tsx scripts/e2e-commit.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
  const { decodeSuiPrivateKey } = await import("@mysten/sui/cryptography");
  const { Ed25519Keypair } = await import("@mysten/sui/keypairs/ed25519");
  const { SuiJsonRpcClient, getJsonRpcFullnodeUrl } = await import(
    "@mysten/sui/jsonRpc"
  );
  const { Transaction } = await import("@mysten/sui/transactions");
  const { fromBase64 } = await import("@mysten/sui/utils");
  const {
    appendCommitPrivateProphecy,
    resolveCommitUnlockPrice,
    buildProphecyPayload,
    canonicalProphecyJson,
    extractProphecyIdFromTx,
    hashProphecyPlaintext,
  } = await import("../src/lib/prophet");
  const { buildTransactionKind, requestSponsor } = await import(
    "../src/lib/gas-station"
  );
  const { encryptProphecyPayload, generateSealId } = await import(
    "../src/lib/seal-prophet"
  );
  const { uploadBlobToWalrus } = await import("../src/lib/walrus");

  function loadGasPayerKey() {
    const envPath = join(appRoot, "../services/gas-station/.env.local");
    const text = readFileSync(envPath, "utf8");
    const line = text
      .split("\n")
      .find((l) => l.startsWith("GAS_PAYER_PRIVATE_KEY="));
    if (!line) throw new Error("GAS_PAYER_PRIVATE_KEY not found");
    const raw = line.split("=").slice(1).join("=").trim();
    const { secretKey } = decodeSuiPrivateKey(raw);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }

  const registryId = process.env.NEXT_PUBLIC_PROPHET_REGISTRY_ID;
  const poolId = process.env.NEXT_PUBLIC_POOL_POISSON;
  const packageId = process.env.NEXT_PUBLIC_PACKAGE_ID;
  if (!registryId || !poolId || !packageId) {
    throw new Error("Missing env: PROPHET_REGISTRY / POOL / PACKAGE_ID");
  }
  console.log("package:", packageId);

  const keypair = loadGasPayerKey();
  const sender = keypair.getPublicKey().toSuiAddress();
  const client = new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl("testnet"),
    network: "testnet",
  });

  const poolObj = await client.getObject({
    id: poolId,
    options: { showContent: true },
  });
  const fields = (poolObj.data?.content as { fields?: { maturity_ts?: string } })
    ?.fields;
  const maturity = Number(fields?.maturity_ts ?? 0);
  if (!maturity) throw new Error("pool maturity_ts missing");

  const analysis = `E2E commit ${new Date().toISOString()} — Phase 4 Gas Station`;
  const payload = buildProphecyPayload(poolId, 2, analysis);
  const hash = hashProphecyPlaintext(payload);
  const json = canonicalProphecyJson(payload);
  const sealId = generateSealId();

  console.log("[1/5] Seal 加密…");
  const encrypted = await encryptProphecyPayload(
    sealId,
    new TextEncoder().encode(json),
  );

  console.log("[2/5] Walrus 上传…");
  const blobId = await uploadBlobToWalrus(encrypted);
  console.log("  blobId:", blobId);

  console.log("[3/5] 构建 PTB + 请求 Gas Station…");
  const tx = new Transaction();
  appendCommitPrivateProphecy(tx, {
    registryId,
    poolId,
    blobId,
    sealId,
    plaintextHash: hash,
    predictedValue: 2,
    unlockPrice: resolveCommitUnlockPrice(0n),
    lockTime: maturity,
  });

  const kindBytes = await buildTransactionKind(tx, client, sender);
  const sponsored = await requestSponsor(kindBytes, sender);
  const bytes = fromBase64(sponsored.transactionBytes);

  console.log("[4/5] 双签并执行…");
  const { signature: userSignature } = await keypair.signTransaction(bytes);
  const signatures =
    sender === sponsored.gasOwner
      ? [userSignature]
      : [userSignature, sponsored.sponsorSignature];
  const result = await client.executeTransactionBlock({
    transactionBlock: bytes,
    signature: signatures,
    options: { showEffects: true, showObjectChanges: true },
  });

  if (result.effects?.status.status !== "success") {
    throw new Error(result.effects?.status.error ?? "execute failed");
  }

  console.log("[5/5] 链上确认");
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
