#[test_only]
module x_market::math_normal_auction_tests;

use x_market::math_normal;

#[test]
fun mu_sigma_from_equal_buckets() {
    let buckets = vector[100u64, 100, 100];
    let (mu, sigma) = math_normal::mu_sigma_tenths_from_auction_buckets(&buckets);
    assert!(mu == 25, 0);
    assert!(sigma == 4, 1);
}

#[test]
fun mu_sigma_skew_high_expectation() {
    let buckets = vector[50u64, 50, 200];
    let (mu, sigma) = math_normal::mu_sigma_tenths_from_auction_buckets(&buckets);
    assert!(mu > 25, 0);
    assert!(sigma > 4, 1);
}
