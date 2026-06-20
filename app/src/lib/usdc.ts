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

import type { Transaction } from "@mysten/sui/transactions";
import { LocalizedError } from "@/i18n/core";
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

const USDC_STRUCT_SUFFIX = "::usdc::USDC";

/** Coin argument produced by {@link prepareUsdcPayment}. */
export type UsdcPaymentArg = ReturnType<Transaction["coin"]>;

/**
 * Circle USDC must be a full Move struct tag (`0x…::usdc::USDC`).
 * Bare package IDs (common misconfiguration) are normalized automatically.
 */
export function normalizeUsdcCoinType(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new LocalizedError("errors.invalidUsdcCoinType", { value: raw });
  }
  if (trimmed.includes("::")) {
    const parts = trimmed.split("::");
    if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
      return trimmed;
    }
    throw new LocalizedError("errors.invalidUsdcCoinType", { value: raw });
  }
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    return `${trimmed.toLowerCase()}${USDC_STRUCT_SUFFIX}`;
  }
  throw new LocalizedError("errors.invalidUsdcCoinType", { value: raw });
}

export function usdcType(): string {
  const override = process.env.NEXT_PUBLIC_USDC_COIN_TYPE?.trim();
  if (override) return normalizeUsdcCoinType(override);
  return NETWORK === "mainnet"
    ? CIRCLE_USDC_COIN_TYPE.mainnet
    : CIRCLE_USDC_COIN_TYPE.testnet;
}

export function parseUsdcAmount(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new LocalizedError("errors.invalidAmount");
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > USDC_DECIMALS) {
    throw new LocalizedError("errors.maxDecimals", { decimals: USDC_DECIMALS });
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
  const resolvedType = normalizeUsdcCoinType(coinType);
  const out: { id: string; balance: bigint }[] = [];
  let cursor: string | null | undefined = null;
  do {
    const page = await client.getCoins({
      owner,
      coinType: resolvedType,
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
 * Resolve `amount` USDC from the wallet (coins or address balance) for `buy_*` / auction payment.
 */
export async function prepareUsdcPayment(
  tx: Transaction,
  client: CoinsClient,
  owner: string,
  amount: bigint,
  coinType: string = usdcType(),
): Promise<UsdcPaymentArg> {
  if (amount <= 0n) {
    throw new LocalizedError("errors.amountMustBePositive");
  }
  const type = normalizeUsdcCoinType(coinType);
  const total = await totalUsdcBalance(client, owner, type);
  if (total === 0n) {
    throw new LocalizedError("errors.noUsdcInWallet");
  }
  if (total < amount) {
    throw new LocalizedError("errors.insufficientUsdc", {
      need: formatUsdcBaseUnits(amount),
      have: formatUsdcBaseUnits(total),
    });
  }

  return tx.coin({
    type,
    balance: amount,
    useGasCoin: false,
  });
}
