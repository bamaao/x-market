// Copyright (c) 2026 zouyc zouyccq@gmail.com.
// All rights reserved.
//
// Licensed under the Business Source License 1.1 (BSL 1.1).
// You may not use this file except in compliance with the License.
//
// Change Date: 2031-01-01
// On the Change Date, or the fourth anniversary of the first publicly available
// distribution of the code under the BSL, whichever comes first, the code
// automatically becomes available under the Apache License 2.0.

/// Q32.32 fixed-point helpers.
module x_market::math_fixed_point;

use x_market::errors;

const SCALE: u128 = 4294967296; // 2^32
const ONE: u128 = 4294967296;
const LAMBDA_MAX_FP: u128 = 34359738368; // 8.0 * SCALE

public fun scale(): u128 { SCALE }
public fun one(): u128 { ONE }
public fun lambda_max_fp(): u128 { LAMBDA_MAX_FP }

public fun from_u64(v: u64): u128 {
    (v as u128) * SCALE
}

public fun from_tenths(v: u64): u128 {
    from_u64(v) / 10
}

/// `num / den` in Q32.32 (e.g. 25/10 = 2.5).
public fun from_rational(num: u64, den: u64): u128 {
    if (den == 0) {
        abort errors::div_by_zero()
    };
    ((num as u128) * SCALE) / (den as u128)
}

public fun sub(a: u128, b: u128): u128 {
    if (a < b) {
        abort errors::math_overflow()
    };
    a - b
}

public fun mul(a: u128, b: u128): u128 {
    (a * b) >> 32
}

public fun div(a: u128, b: u128): u128 {
    if (b == 0) {
        abort errors::div_by_zero()
    };
    let wide = a << 32;
    wide / b
}

public fun clamp_prob(v: u128): u128 {
    if (v > ONE) ONE else v
}
