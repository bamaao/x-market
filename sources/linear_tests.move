#[test_only]
module x_market::linear_tests;

use x_market::position;
use x_market::risk;

#[test]
fun call_payout_positive_above_strike() {
    let payout = risk::linear_payout_usdc(position::linear_call_kind(), 5, 9, 1_000_000);
    // diff=4, divisor=10 => 400_000
    assert!(payout == 400_000, 0);
}

#[test]
fun put_payout_positive_below_strike() {
    let payout = risk::linear_payout_usdc(position::linear_put_kind(), 8, 3, 2_000_000);
    // diff=5, divisor=10 => 1_000_000
    assert!(payout == 1_000_000, 0);
}

#[test]
fun straddle_payout_is_symmetric() {
    let up = risk::linear_payout_usdc(position::straddle_kind(), 7, 10, 1_500_000);
    let down = risk::linear_payout_usdc(position::straddle_kind(), 7, 4, 1_500_000);
    assert!(up == down, 0);
}
