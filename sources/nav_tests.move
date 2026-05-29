#[test_only]
module x_market::nav_tests;

use x_market::nav;
use x_market::risk;

#[test]
fun genesis_mint_one_to_one() {
    let liab = risk::zero_liability();
    let mint = nav::mint_lp_shares(1_000_000, 0, &liab, 0);
    assert!(mint == 1_000_000, 0);
}

#[test]
fun nav_mint_after_first_lp() {
    let liab = risk::zero_liability();
    let nav_ppb = nav::nav_ppb(10_000_000, &liab, 10_000_000);
    assert!(nav_ppb == 1_000_000_000, 0);
    let mint = nav::mint_lp_shares(1_200_000, 10_000_000, &liab, 10_000_000);
    assert!(mint == 1_200_000, 1);
}

#[test]
fun nav_discount_when_equity_grows() {
    let liab = risk::zero_liability();
    // vault 12M, lp 10M shares → NAV 1.2 → deposit 1.2M mints 1M shares
    let mint = nav::mint_lp_shares(1_200_000, 12_000_000, &liab, 10_000_000);
    assert!(mint == 1_000_000, 0);
}

#[test]
fun max_liability_reduces_mint() {
    let mut liab = risk::zero_liability();
    *vector::borrow_mut(&mut liab, 0) = 2_000_000;
    // equity = 10M - 2M = 8M, lp 10M → NAV 0.8
    let mint = nav::mint_lp_shares(800_000, 10_000_000, &liab, 10_000_000);
    assert!(mint == 1_000_000, 0);
}

#[test]
fun redeem_uses_nav() {
    let liab = risk::zero_liability();
    // NAV = 1.2 when vault=12M and shares=10M
    let payout = nav::redeem_usdc_amount(1_000_000, 12_000_000, &liab, 10_000_000);
    assert!(payout == 1_200_000, 0);
}
