#[test_only]
module x_market::math_dirichlet_tests;

use x_market::math_dirichlet;
use x_market::math_fixed_point as fp;

#[test]
fun equal_prior() {
    let s = fp::scale();
    let alphas = vector[10 * s, 10 * s, 10 * s];
    let p = math_dirichlet::dirichlet_prob(&alphas, 0);
    assert!(p == fp::one() / 3, 0);
}
