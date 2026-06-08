#[test_only]
module x_market::math_beta_tests;

use x_market::math_beta;
use x_market::math_fixed_point as fp;

#[test]
fun symmetric_beta_cdf_half() {
    let p = math_beta::beta_cdf_permille(2, 2, 500);
    let half = fp::one() / 2;
    let tol = 50_000_000u128;
    assert!(p + tol >= half && p <= half + tol, 0);
}

#[test]
fun uniform_prior_cdf_half() {
    let p = math_beta::beta_cdf_permille(10, 10, 500);
    let half = fp::one() / 2;
    let tol = 50_000_000u128;
    assert!(p + tol >= half && p <= half + tol, 0);
}

#[test]
fun vote_share_interval_35_40() {
    let p = math_beta::beta_interval_permille(10, 10, 350, 400);
    let lo = 380_000_000u128;
    let hi = 470_000_000u128;
    assert!(p >= lo && p <= hi, 0);
}

#[test]
fun interval_monotone() {
    let p1 = math_beta::beta_interval_permille(5, 15, 200, 300);
    let p2 = math_beta::beta_interval_permille(5, 15, 200, 350);
    assert!(p2 >= p1, 0);
}

#[test]
fun update_increases_interval_prob() {
    let before = math_beta::beta_interval_permille(10, 10, 350, 400);
    let delta = fp::div(fp::from_u64(1_000_000), fp::from_u64(10_000_000));
    let (new_alpha, new_beta) = math_beta::update_beta_buy(10, 10, 350, 400, delta);
    let after = math_beta::beta_interval_permille(new_alpha, new_beta, 350, 400);
    assert!(after >= before, 0);
}

#[test]
fun auction_shapes() {
    let shapes = math_beta::shapes_from_auction_buckets(&vector[60_000_000, 40_000_000]);
    assert!(shapes[0] > shapes[1], 0);
}
