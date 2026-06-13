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
