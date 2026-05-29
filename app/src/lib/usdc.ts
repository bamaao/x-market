import type { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID } from "./markets";

type CoinPage = {
  data: { coinObjectId: string; balance: string }[];
  hasNextPage: boolean;
  nextCursor?: string | null;
};

export type CoinsClient = {
  getCoins: (input: {
    owner: string;
    coinType: string;
    cursor?: string;
  }) => Promise<CoinPage>;
};

export const USDC_DECIMALS = 6;

export function usdcType(packageId: string = PACKAGE_ID): string {
  return `${packageId}::usdc::USDC`;
}

export const TREASURY_CAP_ID =
  process.env.NEXT_PUBLIC_TREASURY_CAP ??
  "0x665f9aa32bbb18a65749b7fee38be8499d87fe0ddcdb8e8bbf738f4129975eaf";

export const FAUCET_PACKAGE_ID =
  process.env.NEXT_PUBLIC_FAUCET_PACKAGE_ID ??
  "0x70bb4f8ed11991f79dbafef255ad1881d169bb1e337b69b129d997dd4216ebf0";

export function parseUsdcAmount(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("无效金额");
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > USDC_DECIMALS) {
    throw new Error(`最多 ${USDC_DECIMALS} 位小数`);
  }
  const padded = frac.padEnd(USDC_DECIMALS, "0");
  return BigInt(whole + padded);
}

export function formatUsdcBaseUnits(base: bigint): string {
  const s = base.toString().padStart(USDC_DECIMALS + 1, "0");
  const whole = s.slice(0, -USDC_DECIMALS) || "0";
  const frac = s.slice(-USDC_DECIMALS).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export async function listUsdcCoins(
  client: CoinsClient,
  owner: string,
  packageId: string = PACKAGE_ID,
): Promise<{ id: string; balance: bigint }[]> {
  const coinType = usdcType(packageId);
  const out: { id: string; balance: bigint }[] = [];
  let cursor: string | null | undefined = null;
  do {
    const page = await client.getCoins({
      owner,
      coinType,
      cursor: cursor ?? undefined,
    });
    for (const c of page.data) {
      out.push({ id: c.coinObjectId, balance: BigInt(c.balance) });
    }
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);
  return out;
}

export async function totalUsdcBalance(
  client: CoinsClient,
  owner: string,
  packageId?: string,
): Promise<bigint> {
  const coins = await listUsdcCoins(client, owner, packageId);
  return coins.reduce((s, c) => s + c.balance, 0n);
}

/**
 * Merge wallet USDC coins if needed, then split `amount` for `buy_*` payment.
 */
export async function prepareUsdcPayment(
  tx: Transaction,
  client: CoinsClient,
  owner: string,
  amount: bigint,
  packageId: string = PACKAGE_ID,
) {
  if (amount <= 0n) {
    throw new Error("金额须大于 0");
  }
  const coins = await listUsdcCoins(client, owner, packageId);
  if (coins.length === 0) {
    throw new Error("钱包中没有 USDC，请先铸造");
  }
  const total = coins.reduce((s, c) => s + c.balance, 0n);
  if (total < amount) {
    throw new Error(
      `USDC 不足：需要 ${formatUsdcBaseUnits(amount)}，持有 ${formatUsdcBaseUnits(total)}`,
    );
  }

  const sorted = [...coins].sort((a, b) =>
    a.balance === b.balance ? 0 : a.balance > b.balance ? -1 : 1,
  );
  const primary = sorted[0].id;
  const mergeSources = sorted
    .slice(1)
    .map((c) => tx.object(c.id));

  if (mergeSources.length > 0) {
    tx.mergeCoins(tx.object(primary), mergeSources);
  }

  return tx.splitCoins(tx.object(primary), [tx.pure.u64(amount)]);
}
