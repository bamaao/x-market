/// LP share receipt (Phase 1.5); Phase 2 adds `withdraw_liquidity` burn.
module x_market::lp_token;

public struct LpShare has key, store {
    id: UID,
    market_id: ID,
    shares: u64,
}

public(package) fun mint(
    _owner: address,
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
