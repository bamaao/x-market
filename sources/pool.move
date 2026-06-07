/// Entry functions: pool lifecycle, auction, trading (USDC vault).
module x_market::pool;

use sui::clock::{Self, Clock};
use sui::coin::Coin;

use x_market::coin_util;
use x_market::errors;
use x_market::macro_oracle::{Self, FeedRegistry, OracleConfig};
use x_market::market_pool::{Self, MarketPool};
use x_market::math_dirichlet;
use x_market::math_fixed_point as fp;
use x_market::math_normal;
use x_market::math_poisson;
use x_market::lp_token;
use x_market::lp_guard;
use x_market::nav;
use x_market::position;
use x_market::risk;
use x_market::usdc::USDC;

// --- Pool creation (3 seed market templates) ---

public entry fun create_poisson_pool(
    lambda_tenths: u16,
    maturity_ts: u64,
    fee_bps: u16,
    ctx: &mut TxContext,
) {
    if (lambda_tenths > 80) {
        abort errors::out_of_bounds()
    };
    let pool = market_pool::new_poisson_trading(
        ctx.sender(),
        lambda_tenths,
        maturity_ts,
        fee_bps,
        ctx,
    );
    market_pool::share_pool(pool);
}

public entry fun create_dirichlet_pool(
    alpha0: u32,
    alpha1: u32,
    alpha2: u32,
    maturity_ts: u64,
    fee_bps: u16,
    ctx: &mut TxContext,
) {
    let alphas = vector[alpha0, alpha1, alpha2];
    let pool = market_pool::new_dirichlet_trading(
        ctx.sender(),
        alphas,
        maturity_ts,
        fee_bps,
        ctx,
    );
    market_pool::share_pool(pool);
}

public entry fun create_normal_pool(
    mu_tenths: u32,
    sigma_tenths: u32,
    maturity_ts: u64,
    fee_bps: u16,
    ctx: &mut TxContext,
) {
    if (sigma_tenths == 0) {
        abort errors::out_of_bounds()
    };
    let pool = market_pool::new_normal_trading(
        ctx.sender(),
        mu_tenths,
        sigma_tenths,
        maturity_ts,
        fee_bps,
        ctx,
    );
    market_pool::share_pool(pool);
}

public entry fun create_normal_pool_wide(
    mu_units: u64,
    sigma_units: u64,
    maturity_ts: u64,
    fee_bps: u16,
    ctx: &mut TxContext,
) {
    if (
        sigma_units < math_normal::sigma_min_units() ||
            sigma_units > math_normal::sigma_max_units()
    ) {
        abort errors::out_of_bounds()
    };
    let pool = market_pool::new_normal_trading_wide(
        ctx.sender(),
        mu_units,
        sigma_units,
        maturity_ts,
        fee_bps,
        ctx,
    );
    market_pool::share_pool(pool);
}

/// Backward-compatible alias.
public entry fun create_pool(
    lambda_tenths: u16,
    maturity_ts: u64,
    fee_bps: u16,
    ctx: &mut TxContext,
) {
    create_poisson_pool(lambda_tenths, maturity_ts, fee_bps, ctx);
}

// --- Pool + Oracle feed (auto-register, same PTB) ---

public entry fun create_poisson_pool_with_feed(
    oracle: &OracleConfig,
    registry: &mut FeedRegistry,
    lambda_tenths: u16,
    maturity_ts: u64,
    fee_bps: u16,
    identifier: vector<u8>,
    ancillary_data: vector<u8>,
    ctx: &mut TxContext,
) {
    if (lambda_tenths > 80) {
        abort errors::out_of_bounds()
    };
    let pool = market_pool::new_poisson_trading(
        ctx.sender(),
        lambda_tenths,
        maturity_ts,
        fee_bps,
        ctx,
    );
    macro_oracle::register_feed_for_pool(
        oracle,
        registry,
        &pool,
        identifier,
        maturity_ts,
        0,
        0,
        ancillary_data,
        ctx,
    );
    market_pool::share_pool(pool);
}

public entry fun create_dirichlet_pool_with_feed(
    oracle: &OracleConfig,
    registry: &mut FeedRegistry,
    alpha0: u32,
    alpha1: u32,
    alpha2: u32,
    maturity_ts: u64,
    fee_bps: u16,
    identifier: vector<u8>,
    ancillary_data: vector<u8>,
    ctx: &mut TxContext,
) {
    let alphas = vector[alpha0, alpha1, alpha2];
    let pool = market_pool::new_dirichlet_trading(
        ctx.sender(),
        alphas,
        maturity_ts,
        fee_bps,
        ctx,
    );
    macro_oracle::register_feed_for_pool(
        oracle,
        registry,
        &pool,
        identifier,
        maturity_ts,
        0,
        0,
        ancillary_data,
        ctx,
    );
    market_pool::share_pool(pool);
}

public entry fun create_normal_pool_with_feed(
    oracle: &OracleConfig,
    registry: &mut FeedRegistry,
    mu_tenths: u32,
    sigma_tenths: u32,
    maturity_ts: u64,
    fee_bps: u16,
    identifier: vector<u8>,
    ancillary_data: vector<u8>,
    ctx: &mut TxContext,
) {
    if (sigma_tenths == 0) {
        abort errors::out_of_bounds()
    };
    let pool = market_pool::new_normal_trading(
        ctx.sender(),
        mu_tenths,
        sigma_tenths,
        maturity_ts,
        fee_bps,
        ctx,
    );
    macro_oracle::register_feed_for_pool(
        oracle,
        registry,
        &pool,
        identifier,
        maturity_ts,
        0,
        0,
        ancillary_data,
        ctx,
    );
    market_pool::share_pool(pool);
}

// --- Opening Auction (Poisson) ---

public entry fun start_poisson_auction(
    auction_end_ts: u64,
    maturity_ts: u64,
    fee_bps: u16,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    if (auction_end_ts <= clock::timestamp_ms(clock) / 1000) {
        abort errors::out_of_bounds()
    };
    let pool = market_pool::new_poisson_auction(
        ctx.sender(),
        auction_end_ts,
        maturity_ts,
        fee_bps,
        ctx,
    );
    market_pool::share_pool(pool);
}

public entry fun auction_bid(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    bucket_index: u8,
    clock: &Clock,
) {
    if (!market_pool::is_auction(pool)) {
        abort errors::not_auction()
    };
    if (bucket_index >= 3) {
        abort errors::invalid_bucket()
    };
    let now = clock::timestamp_ms(clock) / 1000;
    if (now >= market_pool::auction_end_ts(pool)) {
        abort errors::auction_ended()
    };
    let amount = sui::coin::value(&payment);
    if (amount == 0) {
        abort errors::out_of_bounds()
    };
    let buckets = market_pool::auction_buckets_mut(pool);
    let cur = *vector::borrow(buckets, bucket_index as u64);
    *vector::borrow_mut(buckets, bucket_index as u64) = cur + amount;
    coin_util::deposit_to_vault(pool, payment);
}

public entry fun finalize_poisson_auction(
    pool: &mut MarketPool,
    clock: &Clock,
    _ctx: &TxContext,
) {
    if (!market_pool::is_auction(pool)) {
        abort errors::not_auction()
    };
    let now = clock::timestamp_ms(clock) / 1000;
    if (now < market_pool::auction_end_ts(pool)) {
        abort errors::auction_not_ended()
    };
    let buckets = market_pool::auction_buckets(pool);
    let lambda_tenths = math_poisson::lambda_tenths_from_auction_buckets(buckets);
    market_pool::finalize_poisson_auction(pool, lambda_tenths);
}

// --- Opening Auction (Dirichlet W/D/L) ---

public entry fun start_dirichlet_auction(
    auction_end_ts: u64,
    maturity_ts: u64,
    fee_bps: u16,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    if (auction_end_ts <= clock::timestamp_ms(clock) / 1000) {
        abort errors::out_of_bounds()
    };
    let pool = market_pool::new_dirichlet_auction(
        ctx.sender(),
        auction_end_ts,
        maturity_ts,
        fee_bps,
        ctx,
    );
    market_pool::share_pool(pool);
}

public entry fun finalize_dirichlet_auction(
    pool: &mut MarketPool,
    clock: &Clock,
    _ctx: &TxContext,
) {
    if (!market_pool::is_auction(pool)) {
        abort errors::not_auction()
    };
    if (!market_pool::is_dirichlet(pool)) {
        abort errors::unsupported_distribution()
    };
    let now = clock::timestamp_ms(clock) / 1000;
    if (now < market_pool::auction_end_ts(pool)) {
        abort errors::auction_not_ended()
    };
    let buckets = market_pool::auction_buckets(pool);
    let alphas = math_dirichlet::alphas_from_auction_buckets(buckets);
    market_pool::finalize_dirichlet_auction(pool, alphas);
}

// --- Opening Auction (Normal μ/σ) ---

public entry fun start_normal_auction(
    auction_end_ts: u64,
    maturity_ts: u64,
    fee_bps: u16,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    if (auction_end_ts <= clock::timestamp_ms(clock) / 1000) {
        abort errors::out_of_bounds()
    };
    let pool = market_pool::new_normal_auction(
        ctx.sender(),
        auction_end_ts,
        maturity_ts,
        fee_bps,
        ctx,
    );
    market_pool::share_pool(pool);
}

public entry fun finalize_normal_auction(
    pool: &mut MarketPool,
    clock: &Clock,
    _ctx: &TxContext,
) {
    if (!market_pool::is_auction(pool)) {
        abort errors::not_auction()
    };
    if (!market_pool::is_normal(pool)) {
        abort errors::unsupported_distribution()
    };
    let now = clock::timestamp_ms(clock) / 1000;
    if (now < market_pool::auction_end_ts(pool)) {
        abort errors::auction_not_ended()
    };
    let buckets = market_pool::auction_buckets(pool);
    let (mu_tenths, sigma_tenths) =
        math_normal::mu_sigma_tenths_from_auction_buckets(buckets);
    market_pool::finalize_normal_auction(pool, mu_tenths, sigma_tenths);
}

public entry fun deposit_liquidity(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    if (!market_pool::is_trading(pool)) {
        abort errors::not_trading()
    };
    let amount = sui::coin::value(&payment);
    if (amount == 0) {
        abort errors::out_of_bounds()
    };
    let now = clock::timestamp_ms(clock) / 1000;
    lp_guard::assert_deposit_window_open(
        now,
        market_pool::created_ts(pool),
        market_pool::maturity_ts(pool),
        market_pool::deposit_cutoff_bps(pool),
    );
    let vault_before = market_pool::collateral_value(pool);
    let liability = market_pool::liability_by_k(pool);
    let lp_before = market_pool::lp_shares(pool);
    let mint_shares = nav::mint_lp_shares(amount, vault_before, liability, lp_before);
    coin_util::deposit_to_vault(pool, payment);
    let vault_after = market_pool::collateral_value(pool);
    if (market_pool::is_dirichlet(pool) && vault_before > 0) {
        let len = market_pool::dirichlet_len(pool);
        math_dirichlet::scale_dirichlet_alphas(
            market_pool::dirichlet_alphas_mut(pool),
            len,
            vault_before,
            vault_after,
        );
    };
    market_pool::add_lp_shares(pool, mint_shares);
    let market_id = market_pool::pool_id(pool);
    let lp = lp_token::mint(market_id, mint_shares, ctx);
    lp_token::transfer_to_sender(lp, ctx);
}

public entry fun withdraw_liquidity(
    pool: &mut MarketPool,
    lp: lp_token::LpShare,
    _clock: &Clock,
    ctx: &mut TxContext,
) {
    let pool_id = market_pool::pool_id(pool);
    if (lp_token::market_id(&lp) != pool_id) {
        abort errors::lp_market_mismatch()
    };
    let burn_shares = lp_token::burn(lp);
    let payout = nav::redeem_usdc_amount(
        burn_shares,
        market_pool::collateral_value(pool),
        market_pool::liability_by_k(pool),
        market_pool::lp_shares(pool),
    );
    market_pool::sub_lp_shares(pool, burn_shares);
    let coin = coin_util::withdraw_from_vault(pool, payout, ctx);
    transfer::public_transfer(coin, ctx.sender());
}

public entry fun set_lp_guard_params(
    pool: &mut MarketPool,
    fee_multiplier_bps: u16,
    sigma_virtual_tenths: u32,
    concentration_virtual: u32,
    deposit_cutoff_bps: u16,
    resolution_window_ts: u64,
    ctx: &TxContext,
) {
    assert_authority(pool, ctx);
    market_pool::set_lp_guard_params(
        pool,
        fee_multiplier_bps,
        sigma_virtual_tenths,
        concentration_virtual,
        deposit_cutoff_bps,
        resolution_window_ts,
    );
}

public entry fun set_market_paused(
    pool: &mut MarketPool,
    paused: bool,
    ctx: &TxContext,
) {
    assert_authority(pool, ctx);
    market_pool::set_paused(pool, paused);
}

// --- Poisson ---

public entry fun buy_poisson_interval(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    interval_a: u8,
    interval_b: u8,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_poisson_trading(pool);
    let now = clock::timestamp_ms(clock) / 1000;
    lp_guard::assert_buy_window_open(
        now,
        market_pool::maturity_ts(pool),
        market_pool::resolution_window_ts(pool),
    );
    if (interval_a > interval_b) {
        abort errors::invalid_interval()
    };
    let stake_raw = sui::coin::value(&payment);
    if (stake_raw == 0) {
        abort errors::out_of_bounds()
    };
    let fee_eff = lp_guard::effective_fee_bps(
        market_pool::fee_bps(pool),
        market_pool::fee_multiplier_bps(pool),
    );
    let stake = lp_guard::net_stake_after_fee(stake_raw, fee_eff);
    let vault_usdc = market_pool::collateral_value(pool);
    let lambda = market_pool::poisson_lambda_fp(pool);
    let entry_prob = math_poisson::poisson_interval(lambda, interval_a, interval_b);
    let entry_prob_ppb = prob_to_ppb(entry_prob);
    risk::assert_max_loss_bounded(
        market_pool::liability_by_k(pool),
        interval_a,
        interval_b,
        stake,
        entry_prob_ppb,
        vault_usdc,
    );
    execute_poisson_buy(
        pool,
        payment,
        stake,
        interval_a,
        interval_b,
        entry_prob,
        entry_prob_ppb,
        ctx,
    );
}

/// Digital: P(X = k).
public entry fun buy_poisson_digital(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    k: u8,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_poisson_trading(pool);
    let now = clock::timestamp_ms(clock) / 1000;
    lp_guard::assert_buy_window_open(
        now,
        market_pool::maturity_ts(pool),
        market_pool::resolution_window_ts(pool),
    );
    let stake_raw = sui::coin::value(&payment);
    if (stake_raw == 0) {
        abort errors::out_of_bounds()
    };
    let fee_eff = lp_guard::effective_fee_bps(
        market_pool::fee_bps(pool),
        market_pool::fee_multiplier_bps(pool),
    );
    let stake = lp_guard::net_stake_after_fee(stake_raw, fee_eff);
    let vault_usdc = market_pool::collateral_value(pool);
    let lambda = market_pool::poisson_lambda_fp(pool);
    let entry_prob = math_poisson::poisson_pmf(lambda, k);
    let entry_prob_ppb = prob_to_ppb(entry_prob);
    risk::assert_max_loss_bounded(
        market_pool::liability_by_k(pool),
        k,
        k,
        stake,
        entry_prob_ppb,
        vault_usdc,
    );
    execute_poisson_buy(pool, payment, stake, k, k, entry_prob, entry_prob_ppb, ctx);
}

// --- Dirichlet (win/draw/loss) ---

public entry fun buy_dirichlet_outcome(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    outcome: u8,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_dirichlet_trading(pool);
    let now = clock::timestamp_ms(clock) / 1000;
    lp_guard::assert_buy_window_open(
        now,
        market_pool::maturity_ts(pool),
        market_pool::resolution_window_ts(pool),
    );
    let len = market_pool::dirichlet_len(pool);
    if (outcome >= len) {
        abort errors::out_of_bounds()
    };
    let stake_raw = sui::coin::value(&payment);
    if (stake_raw == 0) {
        abort errors::out_of_bounds()
    };
    let fee_eff = lp_guard::effective_fee_bps(
        market_pool::fee_bps(pool),
        market_pool::fee_multiplier_bps(pool),
    );
    let stake = lp_guard::net_stake_after_fee(stake_raw, fee_eff);
    let alphas = market_pool::dirichlet_alphas(pool);
    let mut alpha_sum = 0u64;
    let mut i = 0u64;
    while (i < (len as u64)) {
        alpha_sum = alpha_sum + (*vector::borrow(alphas, i) as u64);
        i = i + 1;
    };
    let entry_prob = lp_guard::dirichlet_prob_with_virtual(
        *vector::borrow(alphas, outcome as u64),
        alpha_sum,
        len,
        market_pool::concentration_virtual(pool),
    );
    let entry_prob_ppb = prob_to_ppb(entry_prob);
    let vault_usdc = market_pool::collateral_value(pool);
    risk::assert_dirichlet_max_loss_bounded(
        market_pool::liability_by_k(pool),
        outcome,
        stake,
        entry_prob_ppb,
        vault_usdc,
    );
    math_dirichlet::update_dirichlet_buy_u32(
        market_pool::dirichlet_alphas_mut(pool),
        outcome as u64,
        stake,
    );
    coin_util::deposit_to_vault(pool, payment);
    let payout = risk::position_payout_usdc(stake, entry_prob_ppb);
    risk::add_dirichlet_liability(
        market_pool::liability_by_k_mut(pool),
        outcome,
        payout,
    );
    let market_id = market_pool::pool_id(pool);
    let pos = position::new_digital(
        market_id,
        outcome,
        stake,
        entry_prob_ppb,
        ctx,
    );
    position::transfer_to_sender(pos, ctx);
}

// --- Normal ---

public entry fun buy_normal_interval(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    a_units: u64,
    b_units: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_normal_trading(pool);
    let now = clock::timestamp_ms(clock) / 1000;
    lp_guard::assert_buy_window_open(
        now,
        market_pool::maturity_ts(pool),
        market_pool::resolution_window_ts(pool),
    );
    if (a_units > b_units) {
        abort errors::invalid_interval()
    };
    if (!risk::is_valid_slot(b_units)) {
        abort errors::out_of_bounds()
    };
    let a_slot = a_units as u8;
    let b_slot = b_units as u8;
    let stake_raw = sui::coin::value(&payment);
    if (stake_raw == 0) {
        abort errors::out_of_bounds()
    };
    let fee_eff = lp_guard::effective_fee_bps(
        market_pool::fee_bps(pool),
        market_pool::fee_multiplier_bps(pool),
    );
    let stake = lp_guard::net_stake_after_fee(stake_raw, fee_eff);
    let sigma_virtual = market_pool::sigma_virtual_tenths(pool) as u64;
    let sigma_tenths = (market_pool::sigma_tenths(pool) as u64) + sigma_virtual;
    let entry_prob = if (market_pool::uses_tenths(pool)) {
        math_normal::normal_interval_tenths(
            (market_pool::mu_tenths(pool) as u64),
            sigma_tenths,
            a_units,
            false,
            b_units,
            false,
        )
    } else {
        math_normal::normal_interval(
            market_pool::mu_units(pool),
            market_pool::sigma_units(pool) + sigma_virtual,
            a_units,
            false,
            b_units,
            false,
        )
    };
    let entry_prob_ppb = prob_to_ppb(entry_prob);
    let vault_usdc = market_pool::collateral_value(pool);
    risk::assert_max_loss_bounded(
        market_pool::liability_by_k(pool),
        a_slot,
        b_slot,
        stake,
        entry_prob_ppb,
        vault_usdc,
    );
    let delta_fp = math_poisson::delta_prob_from_stake(stake, vault_usdc);
    coin_util::deposit_to_vault(pool, payment);
    if (market_pool::uses_tenths(pool)) {
        let new_mu = math_normal::update_mu_buy_tenths(
            (market_pool::mu_tenths(pool) as u64),
            sigma_tenths,
            a_units,
            false,
            b_units,
            false,
            delta_fp,
        );
        market_pool::set_mu_tenths(pool, (new_mu as u32));
    } else {
        let new_mu = math_normal::update_mu_buy(
            market_pool::mu_units(pool),
            market_pool::sigma_units(pool) + sigma_virtual,
            a_units,
            false,
            b_units,
            false,
            delta_fp,
        );
        market_pool::set_mu_units(pool, new_mu);
    };
    let payout = risk::position_payout_usdc(stake, entry_prob_ppb);
    risk::add_position_liability(
        market_pool::liability_by_k_mut(pool),
        a_slot,
        b_slot,
        payout,
    );
    let market_id = market_pool::pool_id(pool);
    let pos = position::new_interval(
        market_id,
        a_slot,
        b_slot,
        stake,
        entry_prob_ppb,
        ctx,
    );
    position::transfer_to_sender(pos, ctx);
}

/// Digital: P(X >= threshold_units).
public entry fun buy_normal_digital(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    threshold_units: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_normal_trading(pool);
    let now = clock::timestamp_ms(clock) / 1000;
    lp_guard::assert_buy_window_open(
        now,
        market_pool::maturity_ts(pool),
        market_pool::resolution_window_ts(pool),
    );
    let stake_raw = sui::coin::value(&payment);
    if (stake_raw == 0) {
        abort errors::out_of_bounds()
    };
    let fee_eff = lp_guard::effective_fee_bps(
        market_pool::fee_bps(pool),
        market_pool::fee_multiplier_bps(pool),
    );
    let stake = lp_guard::net_stake_after_fee(stake_raw, fee_eff);
    let sigma_virtual = market_pool::sigma_virtual_tenths(pool) as u64;
    let entry_prob = if (market_pool::uses_tenths(pool)) {
        math_normal::normal_tail_tenths(
            (market_pool::mu_tenths(pool) as u64),
            (market_pool::sigma_tenths(pool) as u64) + sigma_virtual,
            threshold_units,
            false,
        )
    } else {
        math_normal::normal_tail(
            market_pool::mu_units(pool),
            market_pool::sigma_units(pool) + sigma_virtual,
            threshold_units,
            false,
        )
    };
    let entry_prob_ppb = prob_to_ppb(entry_prob);
    let vault_usdc = market_pool::collateral_value(pool);
    if (!risk::is_valid_slot(threshold_units)) {
        abort errors::out_of_bounds()
    };
    let slot = threshold_units as u8;
    risk::assert_dirichlet_max_loss_bounded(
        market_pool::liability_by_k(pool),
        slot,
        stake,
        entry_prob_ppb,
        vault_usdc,
    );
    coin_util::deposit_to_vault(pool, payment);
    let payout = risk::position_payout_usdc(stake, entry_prob_ppb);
    risk::add_dirichlet_liability(
        market_pool::liability_by_k_mut(pool),
        slot,
        payout,
    );
    let market_id = market_pool::pool_id(pool);
    let pos = position::new_digital(
        market_id,
        slot,
        stake,
        entry_prob_ppb,
        ctx,
    );
    position::transfer_to_sender(pos, ctx);
}

public entry fun buy_normal_linear_call(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    strike_units: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    buy_normal_linear(pool, payment, strike_units, position::linear_call_kind(), clock, ctx);
}

public entry fun buy_normal_linear_put(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    strike_units: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    buy_normal_linear(pool, payment, strike_units, position::linear_put_kind(), clock, ctx);
}

public entry fun buy_normal_straddle(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    strike_units: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    buy_normal_linear(pool, payment, strike_units, position::straddle_kind(), clock, ctx);
}

public entry fun buy_normal_variance_swap(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    strike_units: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    buy_normal_linear(pool, payment, strike_units, position::variance_swap_kind(), clock, ctx);
}

public entry fun buy_normal_structured_note(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    strike_units: u64,
    cap_units: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_normal_trading(pool);
    let now = clock::timestamp_ms(clock) / 1000;
    lp_guard::assert_buy_window_open(
        now,
        market_pool::maturity_ts(pool),
        market_pool::resolution_window_ts(pool),
    );
    if (
        !risk::is_valid_slot(strike_units) ||
            !risk::is_valid_slot(cap_units) ||
            cap_units <= strike_units
    ) {
        abort errors::out_of_bounds()
    };
    let strike_slot = strike_units as u8;
    let cap_slot = cap_units as u8;
    let stake_raw = sui::coin::value(&payment);
    if (stake_raw == 0) {
        abort errors::out_of_bounds()
    };
    let fee_eff = lp_guard::effective_fee_bps(
        market_pool::fee_bps(pool),
        market_pool::fee_multiplier_bps(pool),
    );
    let stake = lp_guard::net_stake_after_fee(stake_raw, fee_eff);
    let vault_usdc = market_pool::collateral_value(pool);
    risk::assert_structured_max_loss_bounded(
        market_pool::liability_by_k(pool),
        position::structured_note_kind(),
        strike_slot,
        cap_slot,
        stake,
        vault_usdc,
    );
    coin_util::deposit_to_vault(pool, payment);
    risk::add_structured_liability(
        market_pool::liability_by_k_mut(pool),
        position::structured_note_kind(),
        strike_slot,
        cap_slot,
        stake,
    );

    let delta_fp = math_poisson::delta_prob_from_stake(stake, vault_usdc);
    if (market_pool::uses_tenths(pool)) {
        let new_mu = math_normal::update_mu_buy_tenths(
            market_pool::mu_tenths(pool) as u64,
            market_pool::sigma_tenths(pool) as u64,
            strike_units,
            false,
            cap_units,
            false,
            delta_fp,
        );
        market_pool::set_mu_tenths(pool, new_mu as u32);
    } else {
        let new_mu = math_normal::update_mu_buy(
            market_pool::mu_units(pool),
            market_pool::sigma_units(pool),
            strike_units,
            false,
            cap_units,
            false,
            delta_fp,
        );
        market_pool::set_mu_units(pool, new_mu);
    };

    let market_id = market_pool::pool_id(pool);
    let pos = position::new_structured_note(market_id, strike_slot, cap_slot, stake, ctx);
    position::transfer_to_sender(pos, ctx);
}

public entry fun buy_normal_range_note(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    lower_units: u64,
    upper_units: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_normal_trading(pool);
    let now = clock::timestamp_ms(clock) / 1000;
    lp_guard::assert_buy_window_open(
        now,
        market_pool::maturity_ts(pool),
        market_pool::resolution_window_ts(pool),
    );
    if (
        !risk::is_valid_slot(lower_units) ||
            !risk::is_valid_slot(upper_units) ||
            upper_units < lower_units
    ) {
        abort errors::out_of_bounds()
    };
    let lower_slot = lower_units as u8;
    let upper_slot = upper_units as u8;
    let stake_raw = sui::coin::value(&payment);
    if (stake_raw == 0) {
        abort errors::out_of_bounds()
    };
    let fee_eff = lp_guard::effective_fee_bps(
        market_pool::fee_bps(pool),
        market_pool::fee_multiplier_bps(pool),
    );
    let stake = lp_guard::net_stake_after_fee(stake_raw, fee_eff);
    let vault_usdc = market_pool::collateral_value(pool);
    risk::assert_structured_max_loss_bounded(
        market_pool::liability_by_k(pool),
        position::range_note_kind(),
        lower_slot,
        upper_slot,
        stake,
        vault_usdc,
    );
    coin_util::deposit_to_vault(pool, payment);
    risk::add_structured_liability(
        market_pool::liability_by_k_mut(pool),
        position::range_note_kind(),
        lower_slot,
        upper_slot,
        stake,
    );

    let delta_fp = math_poisson::delta_prob_from_stake(stake, vault_usdc);
    if (market_pool::uses_tenths(pool)) {
        let new_mu = math_normal::update_mu_buy_tenths(
            market_pool::mu_tenths(pool) as u64,
            market_pool::sigma_tenths(pool) as u64,
            lower_units,
            false,
            upper_units,
            false,
            delta_fp,
        );
        market_pool::set_mu_tenths(pool, new_mu as u32);
    } else {
        let new_mu = math_normal::update_mu_buy(
            market_pool::mu_units(pool),
            market_pool::sigma_units(pool),
            lower_units,
            false,
            upper_units,
            false,
            delta_fp,
        );
        market_pool::set_mu_units(pool, new_mu);
    };

    let market_id = market_pool::pool_id(pool);
    let pos = position::new_range_note(market_id, lower_slot, upper_slot, stake, ctx);
    position::transfer_to_sender(pos, ctx);
}

public entry fun buy_normal_barrier_note(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    barrier_units: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_normal_trading(pool);
    let now = clock::timestamp_ms(clock) / 1000;
    lp_guard::assert_buy_window_open(
        now,
        market_pool::maturity_ts(pool),
        market_pool::resolution_window_ts(pool),
    );
    if (!risk::is_valid_slot(barrier_units)) {
        abort errors::out_of_bounds()
    };
    let barrier_slot = barrier_units as u8;
    let stake_raw = sui::coin::value(&payment);
    if (stake_raw == 0) {
        abort errors::out_of_bounds()
    };
    let fee_eff = lp_guard::effective_fee_bps(
        market_pool::fee_bps(pool),
        market_pool::fee_multiplier_bps(pool),
    );
    let stake = lp_guard::net_stake_after_fee(stake_raw, fee_eff);
    let vault_usdc = market_pool::collateral_value(pool);
    risk::assert_structured_max_loss_bounded(
        market_pool::liability_by_k(pool),
        position::barrier_note_kind(),
        barrier_slot,
        barrier_slot,
        stake,
        vault_usdc,
    );
    coin_util::deposit_to_vault(pool, payment);
    risk::add_structured_liability(
        market_pool::liability_by_k_mut(pool),
        position::barrier_note_kind(),
        barrier_slot,
        barrier_slot,
        stake,
    );

    let delta_fp = math_poisson::delta_prob_from_stake(stake, vault_usdc);
    let high = (risk::outcome_slots() - 1) as u64;
    if (market_pool::uses_tenths(pool)) {
        let new_mu = math_normal::update_mu_buy_tenths(
            market_pool::mu_tenths(pool) as u64,
            market_pool::sigma_tenths(pool) as u64,
            barrier_units,
            false,
            high,
            false,
            delta_fp,
        );
        market_pool::set_mu_tenths(pool, new_mu as u32);
    } else {
        let new_mu = math_normal::update_mu_buy(
            market_pool::mu_units(pool),
            market_pool::sigma_units(pool),
            barrier_units,
            false,
            high,
            false,
            delta_fp,
        );
        market_pool::set_mu_units(pool, new_mu);
    };

    let market_id = market_pool::pool_id(pool);
    let pos = position::new_barrier_note(market_id, barrier_slot, stake, ctx);
    position::transfer_to_sender(pos, ctx);
}

// --- internals ---

fun buy_normal_linear(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    strike_units: u64,
    contract_kind: u8,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert_normal_trading(pool);
    let now = clock::timestamp_ms(clock) / 1000;
    lp_guard::assert_buy_window_open(
        now,
        market_pool::maturity_ts(pool),
        market_pool::resolution_window_ts(pool),
    );
    if (!risk::is_valid_slot(strike_units)) {
        abort errors::out_of_bounds()
    };
    let strike_slot = strike_units as u8;
    let stake_raw = sui::coin::value(&payment);
    if (stake_raw == 0) {
        abort errors::out_of_bounds()
    };
    let fee_eff = lp_guard::effective_fee_bps(
        market_pool::fee_bps(pool),
        market_pool::fee_multiplier_bps(pool),
    );
    let stake = lp_guard::net_stake_after_fee(stake_raw, fee_eff);
    let vault_usdc = market_pool::collateral_value(pool);
    risk::assert_linear_max_loss_bounded(
        market_pool::liability_by_k(pool),
        contract_kind,
        strike_slot,
        stake,
        vault_usdc,
    );
    coin_util::deposit_to_vault(pool, payment);
    risk::add_linear_liability(
        market_pool::liability_by_k_mut(pool),
        contract_kind,
        strike_slot,
        stake,
    );

    let delta_fp = math_poisson::delta_prob_from_stake(stake, vault_usdc);
    if (contract_kind == position::linear_call_kind()) {
        let high = (risk::outcome_slots() - 1) as u64;
        if (market_pool::uses_tenths(pool)) {
            let new_mu = math_normal::update_mu_buy_tenths(
                market_pool::mu_tenths(pool) as u64,
                market_pool::sigma_tenths(pool) as u64,
                strike_units,
                false,
                high,
                false,
                delta_fp,
            );
            market_pool::set_mu_tenths(pool, new_mu as u32);
        } else {
            let new_mu = math_normal::update_mu_buy(
                market_pool::mu_units(pool),
                market_pool::sigma_units(pool),
                strike_units,
                false,
                high,
                false,
                delta_fp,
            );
            market_pool::set_mu_units(pool, new_mu);
        };
    } else if (contract_kind == position::linear_put_kind()) {
        if (market_pool::uses_tenths(pool)) {
            let new_mu = math_normal::update_mu_buy_tenths(
                market_pool::mu_tenths(pool) as u64,
                market_pool::sigma_tenths(pool) as u64,
                0,
                false,
                strike_units,
                false,
                delta_fp,
            );
            market_pool::set_mu_tenths(pool, new_mu as u32);
        } else {
            let new_mu = math_normal::update_mu_buy(
                market_pool::mu_units(pool),
                market_pool::sigma_units(pool),
                0,
                false,
                strike_units,
                false,
                delta_fp,
            );
            market_pool::set_mu_units(pool, new_mu);
        };
    } else if (contract_kind == position::straddle_kind()) {
        if (market_pool::uses_tenths(pool)) {
            let sigma = market_pool::sigma_tenths(pool);
            market_pool::set_sigma_tenths(pool, sigma + 1);
        } else {
            let sigma = market_pool::sigma_units(pool);
            market_pool::set_sigma_units(pool, sigma + 1);
        };
    } else {
        // Variance swaps are more vega-sensitive than straddles.
        if (market_pool::uses_tenths(pool)) {
            let sigma = market_pool::sigma_tenths(pool);
            market_pool::set_sigma_tenths(pool, sigma + 2);
        } else {
            let sigma = market_pool::sigma_units(pool);
            market_pool::set_sigma_units(pool, sigma + 2);
        };
    };

    let market_id = market_pool::pool_id(pool);
    let pos = position::new_linear(
        market_id,
        contract_kind,
        strike_slot,
        stake,
        ctx,
    );
    position::transfer_to_sender(pos, ctx);
}

fun assert_poisson_trading(pool: &MarketPool) {
    if (market_pool::is_paused(pool)) {
        abort errors::market_paused()
    };
    if (!market_pool::is_trading(pool)) {
        abort errors::not_trading()
    };
    if (!market_pool::is_poisson(pool)) {
        abort errors::unsupported_distribution()
    };
}

fun assert_dirichlet_trading(pool: &MarketPool) {
    if (market_pool::is_paused(pool)) {
        abort errors::market_paused()
    };
    if (!market_pool::is_trading(pool)) {
        abort errors::not_trading()
    };
    if (!market_pool::is_dirichlet(pool)) {
        abort errors::unsupported_distribution()
    };
}

fun assert_normal_trading(pool: &MarketPool) {
    if (market_pool::is_paused(pool)) {
        abort errors::market_paused()
    };
    if (!market_pool::is_trading(pool)) {
        abort errors::not_trading()
    };
    if (!market_pool::is_normal(pool)) {
        abort errors::unsupported_distribution()
    };
}

fun assert_authority(pool: &MarketPool, ctx: &TxContext) {
    if (ctx.sender() != market_pool::authority(pool)) {
        abort errors::not_authority()
    };
}

fun prob_to_ppb(prob_fp: u128): u64 {
    if (prob_fp == 0) {
        abort errors::out_of_bounds()
    };
    ((prob_fp * 1_000_000_000) / fp::scale()) as u64
}

fun execute_poisson_buy(
    pool: &mut MarketPool,
    payment: Coin<USDC>,
    stake: u64,
    interval_a: u8,
    interval_b: u8,
    entry_prob: u128,
    entry_prob_ppb: u64,
    ctx: &mut TxContext,
) {
    let vault_usdc = market_pool::collateral_value(pool);
    let delta_fp = math_poisson::delta_prob_from_stake(stake, vault_usdc);
    let new_tenths = math_poisson::update_lambda_buy(
        market_pool::lambda_tenths(pool),
        interval_a,
        interval_b,
        delta_fp,
    );
    coin_util::deposit_to_vault(pool, payment);
    market_pool::set_lambda_tenths(pool, new_tenths);
    let payout = risk::position_payout_usdc(stake, entry_prob_ppb);
    risk::add_position_liability(
        market_pool::liability_by_k_mut(pool),
        interval_a,
        interval_b,
        payout,
    );
    let market_id = market_pool::pool_id(pool);
    let pos = if (interval_a == interval_b) {
        position::new_digital(
            market_id,
            interval_a,
            stake,
            entry_prob_ppb,
            ctx,
        )
    } else {
        position::new_interval(
            market_id,
            interval_a,
            interval_b,
            stake,
            entry_prob_ppb,
            ctx,
        )
    };
    let _ = entry_prob;
    position::transfer_to_sender(pos, ctx);
}
