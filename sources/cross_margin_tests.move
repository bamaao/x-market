#[test_only]
module x_market::cross_margin_tests;

use x_market::cross_margin;

#[test]
fun max_liability_from_slots_works() {
    let slots = vector[100u64, 220, 180, 90];
    let max_v = cross_margin::max_liability_from_slots(&slots);
    assert!(max_v == 220, 0);
}
