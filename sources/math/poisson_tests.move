#[test_only]
module x_market::math_poisson_tests;

use x_market::math_fixed_point as fp;
use x_market::math_poisson;

#[test]
fun pmf_lambda_2_5_k_3() {
    let lambda = fp::from_tenths(25);
    let p = math_poisson::poisson_pmf(lambda, 3);
    assert!(p > 917000000u128 && p < 919000000u128, 0);
}

#[test]
fun interval_lambda_2_5_a_2_b_3() {
    let lambda = fp::from_tenths(25);
    let p = math_poisson::poisson_interval(lambda, 2, 3);
    assert!(p > 2019000000u128 && p < 2021000000u128, 0);
}
