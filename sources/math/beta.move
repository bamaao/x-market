/// Beta distribution CDF on [0, 1] — integer shape parameters (Tier 1).
module x_market::math_beta;

use x_market::errors;
use x_market::math_fixed_point::{Self as fp, one};

const PERMILLE_MAX: u64 = 1000;
const ALPHA_MIN: u32 = 1;
const ALPHA_MAX: u32 = 1_000_000;
const TERM_EPS: u128 = 4295; // ~1e-9 in Q32.32
const STAKE_TO_ALPHA: u64 = 1000;
const MAX_SHAPE_STEPS: u32 = 128;

public fun permille_max(): u64 { PERMILLE_MAX }
public fun alpha_min(): u32 { ALPHA_MIN }
public fun alpha_max(): u32 { ALPHA_MAX }

public fun assert_shape(alpha: u32, beta: u32) {
    if (alpha < ALPHA_MIN || alpha > ALPHA_MAX || beta < ALPHA_MIN || beta > ALPHA_MAX) {
        abort errors::out_of_bounds()
    };
}

public fun from_permille(p: u64): u128 {
    if (p > PERMILLE_MAX) {
        abort errors::out_of_bounds()
    };
    fp::from_rational(p, PERMILLE_MAX)
}

fun pow_fp(base: u128, exp: u32): u128 {
    if (exp == 0) {
        return one()
    };
    let mut result = one();
    let mut i = 0u32;
    while (i < exp) {
        result = fp::mul(result, base);
        i = i + 1;
    };
    result
}

fun int_mul_fp(term: u128, factor: u64): u128 {
    let wide = (term as u256) * (factor as u256);
    if (wide > 18446744073709551615) {
        abort errors::math_overflow()
    };
    wide as u128
}

fun int_div_fp(term: u128, divisor: u64): u128 {
    term / (divisor as u128)
}

/// Regularized incomplete beta I_x(α, β) for integer α, β via binomial identity.
fun beta_cdf_fp(alpha: u32, beta: u32, x_fp: u128): u128 {
    assert_shape(alpha, beta);
    if (x_fp == 0) {
        return 0
    };
    if (x_fp >= one()) {
        return one()
    };
    if (beta > alpha) {
        let one_x = fp::sub(one(), x_fp);
        let comp = beta_cdf_fp(beta, alpha, one_x);
        return fp::sub(one(), comp)
    };
    let n = (alpha as u64) + (beta as u64) - 1;
    let one_minus_x = fp::sub(one(), x_fp);
    let mut term = fp::mul(pow_fp(x_fp, alpha), pow_fp(one_minus_x, beta - 1));
    let mut i = 1u32;
    while (i <= alpha) {
        let num = n - (alpha as u64) + (i as u64);
        term = int_mul_fp(term, num);
        term = int_div_fp(term, i as u64);
        i = i + 1;
    };
    let mut sum = term;
    let mut k = alpha;
    while (k < alpha + beta - 1) {
        let nk = n - (k as u64);
        let kp1 = (k + 1) as u64;
        let ratio = fp::div(
            fp::mul(fp::from_u64(nk), x_fp),
            fp::mul(fp::from_u64(kp1), one_minus_x),
        );
        term = fp::mul(term, ratio);
        sum = sum + term;
        if (term < TERM_EPS) {
            break
        };
        k = k + 1;
    };
    fp::clamp_prob(sum)
}

public fun beta_cdf_permille(alpha: u32, beta: u32, x_permille: u64): u128 {
    beta_cdf_fp(alpha, beta, from_permille(x_permille))
}

/// P(a ≤ X ≤ b) with bounds in permille (0 = 0%, 1000 = 100%).
public fun beta_interval_permille(
    alpha: u32,
    beta: u32,
    a_permille: u64,
    b_permille: u64,
): u128 {
    if (a_permille > b_permille || b_permille > PERMILLE_MAX) {
        abort errors::invalid_interval()
    };
    let cdf_b = beta_cdf_permille(alpha, beta, b_permille);
    let cdf_a = beta_cdf_permille(alpha, beta, a_permille);
    if (cdf_b < cdf_a) {
        abort errors::math_overflow()
    };
    fp::clamp_prob(cdf_b - cdf_a)
}

public fun scale_beta_shapes(
    alphas: &mut vector<u32>,
    vault_before: u64,
    vault_after: u64,
) {
    if (vector::length(alphas) < 2) {
        abort errors::out_of_bounds()
    };
    if (vault_before == 0) {
        abort errors::out_of_bounds()
    };
    let mut i = 0u64;
    while (i < 2) {
        let a = (*vector::borrow(alphas, i) as u128) * (vault_after as u128) / (vault_before as u128);
        if (a < (ALPHA_MIN as u128)) {
            abort errors::out_of_bounds()
        };
        if (a > (ALPHA_MAX as u128)) {
            abort errors::math_overflow()
        };
        *vector::borrow_mut(alphas, i) = (a as u32);
        i = i + 1;
    };
}

/// Opening prior: α₀, β₀ from two auction buckets (vote share low / high).
public fun shapes_from_auction_buckets(buckets: &vector<u64>): vector<u32> {
    let total = buckets[0] + buckets[1];
    if (total == 0) {
        abort errors::out_of_bounds()
    };
    let alpha = 10u32 + (((buckets[0] as u128) * 90) / (total as u128) as u32);
    let beta = 10u32 + (((buckets[1] as u128) * 90) / (total as u128) as u32);
    vector[alpha, beta]
}

fun mean_permille(alpha: u32, beta: u32): u64 {
    ((alpha as u64) * PERMILLE_MAX) / ((alpha as u64) + (beta as u64))
}

fun bump_shape_until_target(
    alpha: u32,
    beta: u32,
    a_permille: u64,
    b_permille: u64,
    target_fp: u128,
    raise_alpha: bool,
): (u32, u32) {
    let mut a = alpha;
    let mut b = beta;
    let mut i = 0u32;
    while (i < MAX_SHAPE_STEPS) {
        if (beta_interval_permille(a, b, a_permille, b_permille) >= target_fp) {
            return (a, b)
        };
        if (raise_alpha) {
            if (a >= ALPHA_MAX) {
                abort errors::math_overflow()
            };
            a = a + 1;
        } else {
            if (b >= ALPHA_MAX) {
                abort errors::math_overflow()
            };
            b = b + 1;
        };
        i = i + 1;
    };
    (a, b)
}

public fun update_beta_buy(
    alpha: u32,
    beta: u32,
    a_permille: u64,
    b_permille: u64,
    delta_prob_fp: u128,
): (u32, u32) {
    let current = beta_interval_permille(alpha, beta, a_permille, b_permille);
    let target = fp::clamp_prob(current + delta_prob_fp);
    let center = (a_permille + b_permille) / 2;
    let mean = mean_permille(alpha, beta);
    let raise_alpha = center >= mean;
    bump_shape_until_target(alpha, beta, a_permille, b_permille, target, raise_alpha)
}

public fun update_beta_buy_u32(
    alphas: &mut vector<u32>,
    a_permille: u64,
    b_permille: u64,
    stake_usdc: u64,
    vault_usdc: u64,
) {
    if (vector::length(alphas) < 2) {
        abort errors::out_of_bounds()
    };
    let delta = stake_usdc / STAKE_TO_ALPHA;
    if (delta == 0) {
        abort errors::out_of_bounds()
    };
    let alpha = *vector::borrow(alphas, 0);
    let beta = *vector::borrow(alphas, 1);
    let delta_fp = fp::div(fp::from_u64(stake_usdc), fp::from_u64(vault_usdc + stake_usdc));
    let (new_alpha, new_beta) = update_beta_buy(alpha, beta, a_permille, b_permille, delta_fp);
    let half = delta / 2;
    let alpha_next = (new_alpha as u128) + (half as u128) + ((delta - half * 2) as u128);
    let beta_next = (new_beta as u128) + (half as u128);
    if (alpha_next > (ALPHA_MAX as u128) || beta_next > (ALPHA_MAX as u128)) {
        abort errors::math_overflow()
    };
    *vector::borrow_mut(alphas, 0) = (alpha_next as u32);
    *vector::borrow_mut(alphas, 1) = (beta_next as u32);
}
