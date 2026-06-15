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

/// LP share receipt (Phase 1.5); Phase 2 adds `withdraw_liquidity` burn.
module x_market::lp_token;

public struct LpShare has key, store {
    id: UID,
    market_id: ID,
    shares: u64,
}

public(package) fun mint(
    market_id: ID,
    shares: u64,
    ctx: &mut TxContext,
): LpShare {
    LpShare {
        id: object::new(ctx),
        market_id,
        shares,
    }
}

public fun shares(lp: &LpShare): u64 {
    lp.shares
}

public fun market_id(lp: &LpShare): ID {
    lp.market_id
}

public fun transfer_to_sender(lp: LpShare, ctx: &TxContext) {
    transfer::public_transfer(lp, ctx.sender());
}

public fun burn(lp: LpShare): u64 {
    let LpShare { id, market_id: _, shares } = lp;
    object::delete(id);
    shares
}
