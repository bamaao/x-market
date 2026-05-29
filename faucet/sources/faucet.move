/// Testnet USDC faucet — uses published `x_market::usdc::USDC` + deployer `TreasuryCap`.
module x_market_faucet::faucet;

use sui::coin::{Self, TreasuryCap};
use x_market::usdc::USDC;

public entry fun mint_to_sender(
    treasury: &mut TreasuryCap<USDC>,
    amount: u64,
    ctx: &mut TxContext,
) {
    let payment = coin::mint(treasury, amount, ctx);
    transfer::public_transfer(payment, ctx.sender());
}

public entry fun mint_to_address(
    treasury: &mut TreasuryCap<USDC>,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    let payment = coin::mint(treasury, amount, ctx);
    transfer::public_transfer(payment, recipient);
}
