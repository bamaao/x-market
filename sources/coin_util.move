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

/// USDC vault helpers for X-Market on Sui (SPL vault logic lives in Solana `token_util.rs`).
module x_market::coin_util;

use sui::coin::Coin;
use sui::tx_context::TxContext;

use x_market::market_pool::{Self, MarketPool};
use usdc::usdc::USDC;

/// User / LP / bidder → pool vault (`Balance<USDC>` inside `MarketPool`).
public fun deposit_to_vault(pool: &mut MarketPool, payment: Coin<USDC>) {
    market_pool::join_vault(pool, payment);
}

/// Vault → user (settlement / withdraw).
public fun withdraw_from_vault(
    pool: &mut MarketPool,
    amount: u64,
    ctx: &mut TxContext,
): Coin<USDC> {
    market_pool::withdraw_vault(pool, amount, ctx)
}
