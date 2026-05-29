module x_market::market_pool;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use x_market::market_status;
use x_market::risk;
use x_market::usdc::USDC;

/// 0 = Poisson, 1 = Dirichlet, 2 = Normal
const KIND_POISSON: u8 = 0;
const KIND_DIRICHLET: u8 = 1;
const KIND_NORMAL: u8 = 2;

public struct MarketPool has key {
    id: UID,
    authority: address,
    kind: u8,
    status: u8,
    lambda_tenths: u16,
    /// Normal: μ, σ in tenths (2.5 → 25). Wide markets use `mu_units` as integer scale.
    mu_tenths: u32,
    sigma_tenths: u32,
    mu_units: u64,
    sigma_units: u64,
    dirichlet_alphas: vector<u32>,
    dirichlet_len: u8,
    vault: Balance<USDC>,
    collateral_usdc: u64,
    liability_by_k: vector<u64>,
    auction_end_ts: u64,
    auction_buckets: vector<u64>,
    lp_shares: u64,
    created_ts: u64,
    maturity_ts: u64,
    fee_bps: u16,
    fee_multiplier_bps: u16,
    sigma_virtual_tenths: u32,
    concentration_virtual: u32,
    deposit_cutoff_bps: u16,
    resolution_window_ts: u64,
    paused: bool,
    resolved: bool,
    /// Poisson: resolved k; Dirichlet: winning bucket; Normal: resolved value (units).
    resolved_value: u64,
}

public fun poisson_lambda_fp(pool: &MarketPool): u128 {
    x_market::math_fixed_point::from_tenths(pool.lambda_tenths as u64)
}

public fun is_poisson(pool: &MarketPool): bool {
    pool.kind == KIND_POISSON
}

public fun is_dirichlet(pool: &MarketPool): bool {
    pool.kind == KIND_DIRICHLET
}

public fun is_normal(pool: &MarketPool): bool {
    pool.kind == KIND_NORMAL
}

public fun is_trading(pool: &MarketPool): bool {
    market_status::is_trading(pool.status)
}

public fun is_auction(pool: &MarketPool): bool {
    market_status::is_auction(pool.status)
}

public fun is_settled(pool: &MarketPool): bool {
    market_status::is_settled(pool.status)
}

public fun lambda_tenths(pool: &MarketPool): u16 {
    pool.lambda_tenths
}

public fun set_lambda_tenths(pool: &mut MarketPool, tenths: u16) {
    pool.lambda_tenths = tenths;
}

public fun mu_tenths(pool: &MarketPool): u32 {
    pool.mu_tenths
}

public fun sigma_tenths(pool: &MarketPool): u32 {
    pool.sigma_tenths
}

public fun mu_units(pool: &MarketPool): u64 {
    pool.mu_units
}

public fun sigma_units(pool: &MarketPool): u64 {
    pool.sigma_units
}

public fun uses_tenths(pool: &MarketPool): bool {
    pool.sigma_tenths > 0
}

public fun set_mu_tenths(pool: &mut MarketPool, mu: u32) {
    pool.mu_tenths = mu;
}

public fun set_mu_units(pool: &mut MarketPool, mu: u64) {
    pool.mu_units = mu;
}

public fun status(pool: &MarketPool): u8 {
    pool.status
}

public fun auction_end_ts(pool: &MarketPool): u64 {
    pool.auction_end_ts
}

public fun maturity_ts(pool: &MarketPool): u64 {
    pool.maturity_ts
}

public fun created_ts(pool: &MarketPool): u64 {
    pool.created_ts
}

public fun authority(pool: &MarketPool): address {
    pool.authority
}

public fun fee_bps(pool: &MarketPool): u16 {
    pool.fee_bps
}

public fun fee_multiplier_bps(pool: &MarketPool): u16 {
    pool.fee_multiplier_bps
}

public fun sigma_virtual_tenths(pool: &MarketPool): u32 {
    pool.sigma_virtual_tenths
}

public fun concentration_virtual(pool: &MarketPool): u32 {
    pool.concentration_virtual
}

public fun deposit_cutoff_bps(pool: &MarketPool): u16 {
    pool.deposit_cutoff_bps
}

public fun resolution_window_ts(pool: &MarketPool): u64 {
    pool.resolution_window_ts
}

public fun liability_by_k(pool: &MarketPool): &vector<u64> {
    &pool.liability_by_k
}

public fun liability_by_k_mut(pool: &mut MarketPool): &mut vector<u64> {
    &mut pool.liability_by_k
}

public fun auction_buckets(pool: &MarketPool): &vector<u64> {
    &pool.auction_buckets
}

public fun auction_buckets_mut(pool: &mut MarketPool): &mut vector<u64> {
    &mut pool.auction_buckets
}

public fun is_paused(pool: &MarketPool): bool {
    pool.paused
}

public(package) fun set_paused(pool: &mut MarketPool, paused: bool) {
    pool.paused = paused;
}

public(package) fun set_lp_guard_params(
    pool: &mut MarketPool,
    fee_multiplier_bps: u16,
    sigma_virtual_tenths: u32,
    concentration_virtual: u32,
    deposit_cutoff_bps: u16,
    resolution_window_ts: u64,
) {
    pool.fee_multiplier_bps = fee_multiplier_bps;
    pool.sigma_virtual_tenths = sigma_virtual_tenths;
    pool.concentration_virtual = concentration_virtual;
    pool.deposit_cutoff_bps = deposit_cutoff_bps;
    pool.resolution_window_ts = resolution_window_ts;
}

public fun collateral_value(pool: &MarketPool): u64 {
    pool.collateral_usdc
}

public fun is_resolved(pool: &MarketPool): bool {
    pool.resolved
}

public fun resolved_value(pool: &MarketPool): u64 {
    pool.resolved_value
}

public fun sync_collateral_usdc(pool: &mut MarketPool) {
    pool.collateral_usdc = balance::value(&pool.vault);
}

public fun join_vault(pool: &mut MarketPool, payment: Coin<USDC>) {
    balance::join(&mut pool.vault, coin::into_balance(payment));
    sync_collateral_usdc(pool);
}

public fun withdraw_vault(
    pool: &mut MarketPool,
    amount: u64,
    ctx: &mut TxContext,
): Coin<USDC> {
    let split = balance::split(&mut pool.vault, amount);
    sync_collateral_usdc(pool);
    coin::from_balance(split, ctx)
}

public(package) fun new_poisson_trading(
    authority: address,
    lambda_tenths: u16,
    maturity_ts: u64,
    fee_bps: u16,
    ctx: &mut TxContext,
): MarketPool {
    MarketPool {
        id: object::new(ctx),
        authority,
        kind: KIND_POISSON,
        status: market_status::status_trading(),
        lambda_tenths,
        mu_tenths: 0,
        sigma_tenths: 0,
        mu_units: 0,
        sigma_units: 0,
        dirichlet_alphas: vector[0, 0, 0],
        dirichlet_len: 0,
        vault: balance::zero(),
        collateral_usdc: 0,
        liability_by_k: risk::zero_liability(),
        auction_end_ts: 0,
        auction_buckets: vector[0, 0, 0],
        lp_shares: 0,
        created_ts: 0,
        maturity_ts,
        fee_bps,
        fee_multiplier_bps: 0,
        sigma_virtual_tenths: 0,
        concentration_virtual: 0,
        deposit_cutoff_bps: 0,
        resolution_window_ts: 0,
        paused: false,
        resolved: false,
        resolved_value: 0,
    }
}

public(package) fun new_dirichlet_trading(
    authority: address,
    alphas: vector<u32>,
    maturity_ts: u64,
    fee_bps: u16,
    ctx: &mut TxContext,
): MarketPool {
    let len = vector::length(&alphas);
    if (len < 2 || len > 16) {
        abort x_market::errors::out_of_bounds()
    };
    MarketPool {
        id: object::new(ctx),
        authority,
        kind: KIND_DIRICHLET,
        status: market_status::status_trading(),
        lambda_tenths: 0,
        mu_tenths: 0,
        sigma_tenths: 0,
        mu_units: 0,
        sigma_units: 0,
        dirichlet_alphas: alphas,
        dirichlet_len: (len as u8),
        vault: balance::zero(),
        collateral_usdc: 0,
        liability_by_k: risk::zero_liability(),
        auction_end_ts: 0,
        auction_buckets: vector[0, 0, 0],
        lp_shares: 0,
        created_ts: 0,
        maturity_ts,
        fee_bps,
        fee_multiplier_bps: 0,
        sigma_virtual_tenths: 0,
        concentration_virtual: 0,
        deposit_cutoff_bps: 0,
        resolution_window_ts: 0,
        paused: false,
        resolved: false,
        resolved_value: 0,
    }
}

public(package) fun new_normal_trading_wide(
    authority: address,
    mu_units: u64,
    sigma_units: u64,
    maturity_ts: u64,
    fee_bps: u16,
    ctx: &mut TxContext,
): MarketPool {
    MarketPool {
        id: object::new(ctx),
        authority,
        kind: KIND_NORMAL,
        status: market_status::status_trading(),
        lambda_tenths: 0,
        mu_tenths: 0,
        sigma_tenths: 0,
        mu_units,
        sigma_units,
        dirichlet_alphas: vector[0, 0, 0],
        dirichlet_len: 0,
        vault: balance::zero(),
        collateral_usdc: 0,
        liability_by_k: risk::zero_liability(),
        auction_end_ts: 0,
        auction_buckets: vector[0, 0, 0],
        lp_shares: 0,
        created_ts: 0,
        maturity_ts,
        fee_bps,
        fee_multiplier_bps: 0,
        sigma_virtual_tenths: 0,
        concentration_virtual: 0,
        deposit_cutoff_bps: 0,
        resolution_window_ts: 0,
        paused: false,
        resolved: false,
        resolved_value: 0,
    }
}

public(package) fun new_normal_trading(
    authority: address,
    mu_tenths: u32,
    sigma_tenths: u32,
    maturity_ts: u64,
    fee_bps: u16,
    ctx: &mut TxContext,
): MarketPool {
    MarketPool {
        id: object::new(ctx),
        authority,
        kind: KIND_NORMAL,
        status: market_status::status_trading(),
        lambda_tenths: 0,
        mu_tenths,
        sigma_tenths,
        mu_units: 0,
        sigma_units: 0,
        dirichlet_alphas: vector[0, 0, 0],
        dirichlet_len: 0,
        vault: balance::zero(),
        collateral_usdc: 0,
        liability_by_k: risk::zero_liability(),
        auction_end_ts: 0,
        auction_buckets: vector[0, 0, 0],
        lp_shares: 0,
        created_ts: 0,
        maturity_ts,
        fee_bps,
        fee_multiplier_bps: 0,
        sigma_virtual_tenths: 0,
        concentration_virtual: 0,
        deposit_cutoff_bps: 0,
        resolution_window_ts: 0,
        paused: false,
        resolved: false,
        resolved_value: 0,
    }
}

public(package) fun new_poisson_auction(
    authority: address,
    auction_end_ts: u64,
    maturity_ts: u64,
    fee_bps: u16,
    ctx: &mut TxContext,
): MarketPool {
    MarketPool {
        id: object::new(ctx),
        authority,
        kind: KIND_POISSON,
        status: market_status::status_auction(),
        lambda_tenths: 0,
        mu_tenths: 0,
        sigma_tenths: 0,
        mu_units: 0,
        sigma_units: 0,
        dirichlet_alphas: vector[0, 0, 0],
        dirichlet_len: 0,
        vault: balance::zero(),
        collateral_usdc: 0,
        liability_by_k: risk::zero_liability(),
        auction_end_ts,
        auction_buckets: vector[0, 0, 0],
        lp_shares: 0,
        created_ts: auction_end_ts,
        maturity_ts,
        fee_bps,
        fee_multiplier_bps: 0,
        sigma_virtual_tenths: 0,
        concentration_virtual: 0,
        deposit_cutoff_bps: 0,
        resolution_window_ts: 0,
        paused: false,
        resolved: false,
        resolved_value: 0,
    }
}

public(package) fun finalize_poisson_auction(pool: &mut MarketPool, lambda_tenths: u16) {
    pool.lambda_tenths = lambda_tenths;
    pool.status = market_status::status_trading();
    pool.auction_buckets = vector[0, 0, 0];
    sync_collateral_usdc(pool);
    seed_auction_lp_shares(pool);
}

public(package) fun new_dirichlet_auction(
    authority: address,
    auction_end_ts: u64,
    maturity_ts: u64,
    fee_bps: u16,
    ctx: &mut TxContext,
): MarketPool {
    MarketPool {
        id: object::new(ctx),
        authority,
        kind: KIND_DIRICHLET,
        status: market_status::status_auction(),
        lambda_tenths: 0,
        mu_tenths: 0,
        sigma_tenths: 0,
        mu_units: 0,
        sigma_units: 0,
        dirichlet_alphas: vector[10, 10, 10],
        dirichlet_len: 3,
        vault: balance::zero(),
        collateral_usdc: 0,
        liability_by_k: risk::zero_liability(),
        auction_end_ts,
        auction_buckets: vector[0, 0, 0],
        lp_shares: 0,
        created_ts: auction_end_ts,
        maturity_ts,
        fee_bps,
        fee_multiplier_bps: 0,
        sigma_virtual_tenths: 0,
        concentration_virtual: 0,
        deposit_cutoff_bps: 0,
        resolution_window_ts: 0,
        paused: false,
        resolved: false,
        resolved_value: 0,
    }
}

public(package) fun finalize_dirichlet_auction(pool: &mut MarketPool, alphas: vector<u32>) {
    pool.dirichlet_alphas = alphas;
    pool.dirichlet_len = 3;
    pool.status = market_status::status_trading();
    pool.auction_buckets = vector[0, 0, 0];
    sync_collateral_usdc(pool);
    seed_auction_lp_shares(pool);
}

fun seed_auction_lp_shares(pool: &mut MarketPool) {
    if (pool.collateral_usdc > 0 && pool.lp_shares == 0) {
        pool.lp_shares = pool.collateral_usdc;
    };
}

public fun lp_shares(pool: &MarketPool): u64 {
    pool.lp_shares
}

public(package) fun set_resolution(pool: &mut MarketPool, value: u64) {
    pool.resolved = true;
    pool.resolved_value = value;
    pool.status = market_status::status_settled();
}

public(package) fun add_lp_shares(pool: &mut MarketPool, amount: u64) {
    pool.lp_shares = pool.lp_shares + amount;
}

public(package) fun sub_lp_shares(pool: &mut MarketPool, amount: u64) {
    pool.lp_shares = pool.lp_shares - amount;
}

public fun share_pool(pool: MarketPool) {
    transfer::share_object(pool);
}

public fun dirichlet_alphas_mut(pool: &mut MarketPool): &mut vector<u32> {
    &mut pool.dirichlet_alphas
}

public fun dirichlet_alphas(pool: &MarketPool): &vector<u32> {
    &pool.dirichlet_alphas
}

public fun dirichlet_len(pool: &MarketPool): u8 {
    pool.dirichlet_len
}

public fun pool_id(pool: &MarketPool): ID {
    object::id(pool)
}
