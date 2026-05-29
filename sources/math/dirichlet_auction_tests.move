#[test_only]
module x_market::math_dirichlet_auction_tests;

use x_market::math_dirichlet;

#[test]
fun alphas_from_equal_buckets() {
    let buckets = vector[100u64, 100, 100];
    let alphas = math_dirichlet::alphas_from_auction_buckets(&buckets);
    assert!(alphas[0] == 40 && alphas[1] == 40 && alphas[2] == 40, 0);
}

#[test]
fun alphas_skew_home_win() {
    let buckets = vector[200u64, 50, 50];
    let alphas = math_dirichlet::alphas_from_auction_buckets(&buckets);
    assert!(alphas[0] > alphas[1], 0);
    assert!(alphas[0] > alphas[2], 1);
}
