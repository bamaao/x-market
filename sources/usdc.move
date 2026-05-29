/// Dev / testnet USDC coin type (6 decimals), mirrors Solana SPL USDC vault semantics.
///
/// Mainnet: replace `x_market::usdc::USDC` with Circle's published `usdc::usdc::USDC`
/// and remove this module's `init` after adding the dependency in `Move.toml`.
module x_market::usdc;

use sui::coin::{Self, Coin, TreasuryCap};

/// One-time witness for `coin::create_currency`.
public struct USDC has drop {}

/// Circle USDC uses 6 decimals (same as Solana SPL).
const DECIMALS: u8 = 6;

public fun decimals(): u8 {
    DECIMALS
}

fun init(otw: USDC, ctx: &mut TxContext) {
    x_market::config::bootstrap(ctx);
    let (treasury_cap, metadata) = coin::create_currency(
        otw,
        DECIMALS,
        b"USDC",
        b"USD Coin (X-Market Dev)",
        b"Dev mirror of USDC vault; swap type on mainnet",
        option::none(),
        ctx,
    );
    transfer::public_share_object(metadata);
    transfer::public_transfer(treasury_cap, ctx.sender());
}

/// Mint test USDC (dev only; requires `TreasuryCap<USDC>` from deployer).
public fun mint(
    treasury: &mut TreasuryCap<USDC>,
    amount: u64,
    ctx: &mut TxContext,
): Coin<USDC> {
    coin::mint(treasury, amount, ctx)
}

public fun burn(treasury: &mut TreasuryCap<USDC>, coin: Coin<USDC>) {
    coin::burn(treasury, coin);
}

/// Testnet only: mint dev USDC to sender (requires `TreasuryCap`).
public entry fun mint_to_sender(
    treasury: &mut TreasuryCap<USDC>,
    amount: u64,
    ctx: &mut TxContext,
) {
    let c = mint(treasury, amount, ctx);
    transfer::public_transfer(c, ctx.sender());
}
