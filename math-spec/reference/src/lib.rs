//! Reference f64 implementation for cross-validation with on-chain Q32.32 code.

const FACTORIAL: [f64; 15] = [
    1.0, 1.0, 2.0, 6.0, 24.0, 120.0, 720.0, 5040.0, 40320.0, 362880.0, 3628800.0, 39916800.0,
    479001600.0, 6227020800.0, 87178291200.0,
];

const EXP_NEG_LUT_STEPS: usize = 801;

/// Ground truth e^{-λ}, λ ∈ [0, 8]
pub fn exp_neg(lambda: f64) -> f64 {
    assert!(lambda >= 0.0 && lambda <= 8.0);
    (-lambda).exp()
}

/// On-chain equivalent: LUT index = round(λ * 100), step 0.01
pub fn exp_neg_lut(lambda: f64) -> f64 {
    assert!(lambda >= 0.0 && lambda <= 8.0);
    let idx = (lambda * 100.0).round() as usize;
    let idx = idx.min(EXP_NEG_LUT_STEPS - 1);
    let step = idx as f64 / 100.0;
    (-step).exp()
}

/// Taylor 14 — only for λ ≤ 3 sanity checks; not used for λ > 3 production path
pub fn exp_neg_taylor(lambda: f64, order: usize) -> f64 {
    assert!(lambda >= 0.0 && lambda <= 8.0);
    let mut sum = 1.0_f64;
    let mut term = 1.0_f64;
    for n in 1..=order {
        term *= lambda / (n as f64);
        if n % 2 == 1 {
            sum -= term;
        } else {
            sum += term;
        }
    }
    sum.clamp(0.0, 1.0)
}

pub fn poisson_pmf(lambda: f64, k: u8) -> f64 {
    assert!(lambda >= 0.0 && lambda <= 8.0);
    let k = k as usize;
    assert!(k < FACTORIAL.len());
    lambda.powi(k as i32) * (-lambda).exp() / FACTORIAL[k]
}

pub fn poisson_interval(lambda: f64, a: u8, b: u8) -> f64 {
    assert!(a <= b);
    let mut sum = 0.0;
    for k in a..=b {
        sum += poisson_pmf(lambda, k);
    }
    sum.min(1.0)
}

pub fn poisson_tail(lambda: f64, k_min: u8) -> f64 {
    if k_min == 0 {
        return 1.0;
    }
    1.0 - poisson_interval(lambda, 0, k_min - 1)
}

pub fn dirichlet_prob(alphas: &[f64], i: usize) -> f64 {
    let sum: f64 = alphas.iter().sum();
    assert!(sum > 0.0);
    alphas[i] / sum
}

/// Abramowitz & Stegun 7.1.26 erf approximation
pub fn erf(z: f64) -> f64 {
    let sign = if z < 0.0 { -1.0 } else { 1.0 };
    let z = z.abs();
    let t = 1.0 / (1.0 + 0.3275911 * z);
    let a1 = 0.254829592;
    let a2 = -0.284496736;
    let a3 = 1.421413741;
    let a4 = -1.453152027;
    let a5 = 1.061405429;
    let y = 1.0
        - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t)
            * (-z * z).exp();
    sign * y
}

pub fn normal_interval(mu: f64, sigma: f64, a: f64, b: f64) -> f64 {
    assert!(sigma > 0.0);
    let sqrt2 = std::f64::consts::SQRT_2;
    let za = (a - mu) / (sigma * sqrt2);
    let zb = (b - mu) / (sigma * sqrt2);
    0.5 * (erf(zb) - erf(za))
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn poisson_pmf_lambda_2_5_k_3() {
        assert_relative_eq!(poisson_pmf(2.5, 3), 0.21376301724965408, max_relative = 1e-12);
    }

    #[test]
    fn poisson_interval_lambda_2_5_a_2_b_3() {
        assert_relative_eq!(poisson_interval(2.5, 2, 3), 0.470278637949239, max_relative = 1e-12);
    }

    #[test]
    fn exp_neg_lambda_2_5() {
        assert_relative_eq!(exp_neg(2.5), 0.08208499862386716, max_relative = 1e-12);
    }

    #[test]
    fn exp_neg_lut_matches_ground_truth() {
        for i in 0..=800 {
            let lam = i as f64 / 100.0;
            assert_relative_eq!(exp_neg_lut(lam), exp_neg(lam), max_relative = 5e-4);
        }
    }

    #[test]
    fn dirichlet_equal_prior() {
        assert_relative_eq!(dirichlet_prob(&[10.0, 10.0, 10.0], 0), 1.0 / 3.0, max_relative = 1e-12);
    }
}
