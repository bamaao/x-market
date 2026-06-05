/// Settlement-only oracle relay (PRD §3.5). Does not update λ/μ/σ priors.
/// Production path: `macro_oracle` optimistic propose → finalize → `set_resolution`.
/// This admin entry remains for testnet fast-path drills.
module x_market::settlement_oracle;

use sui::clock::Clock;
use x_market::config::{Self, AdminCap, GlobalConfig};
use x_market::errors;
use x_market::macro_oracle;
use x_market::market_pool::{Self, MarketPool};

/// Posted settlement value for a market at maturity.
public struct MarketResolution has key {
    id: UID,
    market_id: ID,
    resolved_value: u64,
    resolved_at: u64,
}

public entry fun report_resolution(
    config: &GlobalConfig,
    _cap: &AdminCap,
    pool: &mut MarketPool,
    resolved_value: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    config::assert_admin(config, _cap, ctx.sender());
    let now = sui::clock::timestamp_ms(clock) / 1000;
    if (now < market_pool::maturity_ts(pool)) {
        abort errors::out_of_bounds()
    };
    if (market_pool::is_resolved(pool)) {
        abort errors::out_of_bounds()
    };
    macro_oracle::assert_valid_resolution(pool, resolved_value);
    market_pool::set_resolution(pool, resolved_value);
    let resolution = MarketResolution {
        id: object::new(ctx),
        market_id: market_pool::pool_id(pool),
        resolved_value,
        resolved_at: now,
    };
    transfer::share_object(resolution);
}
