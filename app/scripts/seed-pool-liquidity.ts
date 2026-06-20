/**
 * 为 deploy/testnet-v2.json 种子池注入初始 LP（create_*_pool_with_feed 后 Vault=0）
 * 用法: cd app && npx tsx scripts/seed-pool-liquidity.ts [amountUsdc]
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(appRoot, "..");
const SUI_CLOCK = "0x6";
const USDC_UNIT = 1_000_000n;
const CIRCLE_USDC_TESTNET =
  "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

import { loadKeeperKeypair } from "./lib/load-keeper-key.js";

function loadEnv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    process.env[t.slice(0, i)] = t.slice(i + 1);
  }
}

async function main() {
  const amountUsdc = Number(process.argv[2] ?? "50");
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    throw new Error("amountUsdc must be a positive number");
  }
  const amount = BigInt(Math.round(amountUsdc * 1_000_000));

  loadEnv(join(appRoot, ".env.local"));
  const deploy = JSON.parse(
    readFileSync(join(repoRoot, "deploy/testnet-v2.json"), "utf8"),
  ) as {
    packageId: string;
    seedMarkets: {
      poisson_goals: { poolId: string };
      dirichlet_wdl: { poolId: string };
      normal_cpi: { poolId: string };
    };
  };

  const { SuiJsonRpcClient, getJsonRpcFullnodeUrl } = await import(
    "@mysten/sui/jsonRpc"
  );
  const { Transaction } = await import("@mysten/sui/transactions");

  const keypair = await loadKeeperKeypair();
  const sender = keypair.getPublicKey().toSuiAddress();
  const client = new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl("testnet"),
  });

  async function getUsdcCoin(): Promise<string> {
    const coins = await client.listCoins({ owner: sender, coinType: CIRCLE_USDC_TESTNET });
    const c = coins.data.find((x) => BigInt(x.balance) >= amount);
    if (!c) {
      throw new Error(`Need ${amountUsdc} USDC on ${sender} (Circle testnet USDC)`);
    }
    return c.coinObjectId;
  }

  const pools = [
    ["poisson_goals", deploy.seedMarkets.poisson_goals.poolId],
    ["dirichlet_wdl", deploy.seedMarkets.dirichlet_wdl.poolId],
    ["normal_cpi", deploy.seedMarkets.normal_cpi.poolId],
  ] as const;

  const pkg = deploy.packageId;
  console.log(`Sender: ${sender}`);
  console.log(`Package: ${pkg}`);
  console.log(`Amount per pool: ${amountUsdc} USDC\n`);

  for (const [name, poolId] of pools) {
    if (!poolId) continue;
    const usdcId = await getUsdcCoin();
    const tx = new Transaction();
    const [lpPay] = tx.splitCoins(tx.object(usdcId), [amount]);
    tx.moveCall({
      target: `${pkg}::pool::deposit_liquidity`,
      arguments: [tx.object(poolId), lpPay, tx.object(SUI_CLOCK)],
    });
    tx.setSender(sender);
    const bytes = await tx.build({ client });
    const sig = await keypair.signTransaction(bytes);
    const res = await client.executeTransactionBlock({
      transactionBlock: bytes,
      signature: sig.signature,
      options: { showEffects: true },
    });
    const ok = res.effects?.status?.status === "success";
    console.log(
      `${ok ? "OK" : "FAIL"} deposit_liquidity ${name} ${poolId} -> ${res.digest}`,
    );
    if (!ok) {
      console.error(res.effects?.status);
      process.exitCode = 1;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
