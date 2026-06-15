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
