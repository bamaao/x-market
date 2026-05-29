/// Normal CDF interval — Abramowitz & Stegun 7.1.26 erf (Tier 1).
module x_market::math_normal;

use x_market::errors;
use x_market::math_erf_lut;
use x_market::math_fixed_point::{Self as fp, one};

const SQRT2_FP: u128 = 6074000999;
const ERF_SAT_Z_FP: u128 = 25769803776;

const MU_MAX_UNITS: u64 = 1_000_000;
const SIGMA_MIN_UNITS: u64 = 1;
const SIGMA_MAX_UNITS: u64 = 100_000;

public fun mu_max_units(): u64 { MU_MAX_UNITS }
public fun sigma_min_units(): u64 { SIGMA_MIN_UNITS }
public fun sigma_max_units(): u64 { SIGMA_MAX_UNITS }

/// Signed difference `x - mu` as (magnitude, is_negative).
fun diff_units(x_units: u64, x_negative: bool, mu_units: u64): (u64, bool) {
    if (!x_negative) {
        if (x_units >= mu_units) {
            (x_units - mu_units, false)
        } else {
            (mu_units - x_units, true)
        }
    } else {
        (x_units + mu_units, true)
    }
}

fun erf_mag(z_fp: u128): u128 {
    if (z_fp >= ERF_SAT_Z_FP) {
        one()
    } else {
        math_erf_lut::erf_lut(z_fp)
    }
}

fun assert_sigma(sigma_units: u64) {
    if (sigma_units < SIGMA_MIN_UNITS || sigma_units > SIGMA_MAX_UNITS) {
        abort errors::out_of_bounds()
    };
}

/// Φ(x): CDF at x (x may be negative via `x_negative`).
fun normal_cdf_at(
    x_units: u64,
    x_negative: bool,
    mu_units: u64,
    sigma_units: u64,
): u128 {
    assert_sigma(sigma_units);
    let (diff_mag, diff_neg) = diff_units(x_units, x_negative, mu_units);
    let diff_fp = fp::from_u64(diff_mag);
    let sigma_fp = fp::from_u64(sigma_units);
    let z_fp = fp::div(diff_fp, fp::mul(sigma_fp, SQRT2_FP));
    let erf_val = erf_mag(z_fp);
    let half = one() / 2;
    let half_erf = erf_val / 2;
    if (diff_neg) {
        if (half_erf >= half) {
            0
        } else {
            half - half_erf
        }
    } else {
        half + half_erf
    }
}

/// Interval [a, b]; pass `*_negative` when bound is below zero.
public fun normal_interval(
    mu_units: u64,
    sigma_units: u64,
    a_units: u64,
    a_negative: bool,
    b_units: u64,
    b_negative: bool,
): u128 {
    assert_sigma(sigma_units);
    if (mu_units > MU_MAX_UNITS) {
        abort errors::out_of_bounds()
    };
    if (a_negative == b_negative && a_units > b_units) {
        abort errors::invalid_interval()
    };
    if (!a_negative && !b_negative && a_units > b_units) {
        abort errors::invalid_interval()
    };
    let cdf_b = normal_cdf_at(b_units, b_negative, mu_units, sigma_units);
    let cdf_a = normal_cdf_at(a_units, a_negative, mu_units, sigma_units);
    if (cdf_b < cdf_a) {
        abort errors::math_overflow()
    };
    fp::clamp_prob(cdf_b - cdf_a)
}

/// P(X >= threshold).
public fun normal_tail(
    mu_units: u64,
    sigma_units: u64,
    threshold_units: u64,
    threshold_negative: bool,
): u128 {
    let cdf = normal_cdf_at(threshold_units, threshold_negative, mu_units, sigma_units);
    if (cdf >= one()) {
        0
    } else {
        fp::sub(one(), cdf)
    }
}

fun diff_tenths_units(x_t: u64, x_negative: bool, mu_t: u64): (u64, bool) {
    if (!x_negative) {
        if (x_t >= mu_t) {
            (x_t - mu_t, false)
        } else {
            (mu_t - x_t, true)
        }
    } else {
        (x_t + mu_t, true)
    }
}

/// All parameters in tenths (μ=2.5 → `mu_t=25`).
public fun normal_interval_tenths(
    mu_t: u64,
    sigma_t: u64,
    a_t: u64,
    a_negative: bool,
    b_t: u64,
    b_negative: bool,
): u128 {
    let sigma_fp = fp::from_tenths(sigma_t);
    cdf_interval_tenths(mu_t, sigma_fp, a_t, a_negative, b_t, b_negative)
}

fun cdf_interval_tenths(
    mu_t: u64,
    sigma_fp: u128,
    a_t: u64,
    a_negative: bool,
    b_t: u64,
    b_negative: bool,
): u128 {
    if (sigma_fp == 0) {
        abort errors::out_of_bounds()
    };
    let cdf_b = cdf_at_tenths(b_t, b_negative, mu_t, sigma_fp);
    let cdf_a = cdf_at_tenths(a_t, a_negative, mu_t, sigma_fp);
    if (cdf_b < cdf_a) {
        abort errors::math_overflow()
    };
    fp::clamp_prob(cdf_b - cdf_a)
}

fun cdf_at_tenths(
    x_t: u64,
    x_negative: bool,
    mu_t: u64,
    sigma_fp: u128,
): u128 {
    let (diff_t, diff_neg) = diff_tenths_units(x_t, x_negative, mu_t);
    let diff_fp = fp::from_tenths(diff_t);
    let z_fp = fp::div(diff_fp, fp::mul(sigma_fp, SQRT2_FP));
    let erf_val = erf_mag(z_fp);
    let half = one() / 2;
    let half_erf = erf_val / 2;
    if (diff_neg) {
        if (half_erf >= half) {
            0
        } else {
            half - half_erf
        }
    } else {
        half + half_erf
    }
}

public fun update_mu_buy_tenths(
    mu_t: u64,
    sigma_t: u64,
    a_t: u64,
    a_negative: bool,
    b_t: u64,
    b_negative: bool,
    delta_prob_fp: u128,
): u64 {
    let current = normal_interval_tenths(
        mu_t,
        sigma_t,
        a_t,
        a_negative,
        b_t,
        b_negative,
    );
    let target = fp::clamp_prob(current + delta_prob_fp);
    let mut lo: u64 = 0;
    let mut hi: u64 = 10000;
    while (lo < hi) {
        let mid = lo + ((hi - lo) / 2);
        let p = normal_interval_tenths(
            mid,
            sigma_t,
            a_t,
            a_negative,
            b_t,
            b_negative,
        );
        if (p >= target) {
            hi = mid;
        } else {
            lo = mid + 1;
        };
    };
    lo
}

public fun normal_tail_tenths(
    mu_t: u64,
    sigma_t: u64,
    threshold_t: u64,
    threshold_negative: bool,
): u128 {
    let sigma_fp = fp::from_tenths(sigma_t);
    let cdf = cdf_at_tenths(threshold_t, threshold_negative, mu_t, sigma_fp);
    if (cdf >= one()) {
        0
    } else {
        fp::sub(one(), cdf)
    }
}

public fun update_mu_buy(
    mu_units: u64,
    sigma_units: u64,
    a_units: u64,
    a_negative: bool,
    b_units: u64,
    b_negative: bool,
    delta_prob_fp: u128,
): u64 {
    let current = normal_interval(
        mu_units,
        sigma_units,
        a_units,
        a_negative,
        b_units,
        b_negative,
    );
    let target = fp::clamp_prob(current + delta_prob_fp);
    binary_search_mu(a_units, a_negative, b_units, b_negative, sigma_units, target)
}

fun binary_search_mu(
    a_units: u64,
    a_negative: bool,
    b_units: u64,
    b_negative: bool,
    sigma_units: u64,
    target_fp: u128,
): u64 {
    let mut lo: u64 = 0;
    let mut hi: u64 = MU_MAX_UNITS;
    while (lo < hi) {
        let mid = lo + ((hi - lo) / 2);
        let p = normal_interval(
            mid,
            sigma_units,
            a_units,
            a_negative,
            b_units,
            b_negative,
        );
        if (p >= target_fp) {
            hi = mid;
        } else {
            lo = mid + 1;
        };
    };
    lo
}
