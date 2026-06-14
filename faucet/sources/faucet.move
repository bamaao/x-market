/// Legacy dev faucet — Circle USDC has no deployer TreasuryCap; use Circle testnet faucet instead.
module x_market_faucet::faucet;

use sui::coin::{Self, TreasuryCap};
use usdc::usdc::USDC;

public entry fun mint_to_sender(
    treasury: &mut TreasuryCap<USDC>,
    amount: u64,
    ctx: &mut TxContext,
) {
    let c = coin::mint(treasury, amount, ctx);
    transfer::public_transfer(c, ctx.sender());
}

public entry fun mint_to(
    treasury: &mut TreasuryCap<USDC>,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    let c = coin::mint(treasury, amount, ctx);
    transfer::public_transfer(c, recipient);
}
