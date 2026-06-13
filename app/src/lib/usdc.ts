import type { Transaction } from "@mysten/sui/transactions";
import { NETWORK } from "./markets";

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

/** Circle native USDC on Sui (see https://developers.circle.com/stablecoins/usdc-contract-addresses). */
export const CIRCLE_USDC_COIN_TYPE = {
  testnet:
    "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
  mainnet:
    "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
} as const;

export function usdcType(): string {
  const override = process.env.NEXT_PUBLIC_USDC_COIN_TYPE?.trim();
  if (override) return override;
  return NETWORK === "mainnet"
    ? CIRCLE_USDC_COIN_TYPE.mainnet
    : CIRCLE_USDC_COIN_TYPE.testnet;
}

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
  coinType: string = usdcType(),
): Promise<{ id: string; balance: bigint }[]> {
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
  coinType?: string,
): Promise<bigint> {
  const coins = await listUsdcCoins(client, owner, coinType);
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
  coinType: string = usdcType(),
) {
  if (amount <= 0n) {
    throw new Error("金额须大于 0");
  }
  const coins = await listUsdcCoins(client, owner, coinType);
  if (coins.length === 0) {
    throw new Error("钱包中没有 USDC，请先转入或领取测试网 USDC");
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
