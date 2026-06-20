// Copyright (c) 2026 zouyc zouyccq@gmail.com.
// All rights reserved.
//
// Licensed under the Business Source License 1.1 (BSL 1.1).
//
// Change Date: 2031-01-01
// On the Change Date, or the fourth anniversary of the first publicly available
// distribution of the code under the BSL, whichever comes first, the code
// automatically becomes available under the Apache License 2.0.

/// BCS plaintext for paid prophecies (unlock_price > 0) — prediction hidden until audit.
module x_market::prophet_plain;

use std::bcs;
use sui::hash;
use sui::object::{Self, ID};
use x_market::errors;

const ADDR_LEN: u64 = 32;
const U64_LEN: u64 = 8;

public struct PaidProphecyPlain has copy, drop {
    pool_id: ID,
    predicted_value: u64,
    predicted_low: u64,
    predicted_high: u64,
    analysis: vector<u8>,
}

public fun plaintext_hash(plain: &PaidProphecyPlain): vector<u8> {
    hash::blake2b256(&bcs::to_bytes(plain))
}

/// Manual BCS decode — `std::bcs` only exposes `to_bytes` on-chain.
public fun decode(plaintext: &vector<u8>): PaidProphecyPlain {
    let len = vector::length(plaintext);
    let min = ADDR_LEN + U64_LEN * 3 + 1;
    if (len < min) {
        abort errors::out_of_bounds()
    };
    let (pool_id, off) = read_id(plaintext, 0);
    let (predicted_value, off) = read_u64_le(plaintext, off);
    let (predicted_low, off) = read_u64_le(plaintext, off);
    let (predicted_high, off) = read_u64_le(plaintext, off);
    let (analysis, off) = read_vec_u8(plaintext, off);
    if (off != len) {
        abort errors::out_of_bounds()
    };
    PaidProphecyPlain {
        pool_id,
        predicted_value,
        predicted_low,
        predicted_high,
        analysis,
    }
}

fun read_id(data: &vector<u8>, start: u64): (ID, u64) {
    let end = start + ADDR_LEN;
    if (end > vector::length(data)) {
        abort errors::out_of_bounds()
    };
    let mut bytes = vector[];
    let mut i = start;
    while (i < end) {
        vector::push_back(&mut bytes, *vector::borrow(data, i));
        i = i + 1;
    };
    (object::id_from_bytes(bytes), end)
}

fun read_u64_le(data: &vector<u8>, start: u64): (u64, u64) {
    let end = start + U64_LEN;
    if (end > vector::length(data)) {
        abort errors::out_of_bounds()
    };
    let mut n = 0u64;
    let mut i = 0u8;
    while (i < 8) {
        let b = (*vector::borrow(data, start + (i as u64))) as u64;
        let sh = i * 8;
        n = n + (b << sh);
        i = i + 1;
    };
    (n, end)
}

fun read_uleb128(data: &vector<u8>, start: u64): (u64, u64) {
    let len = vector::length(data);
    let mut result = 0u64;
    let mut shift = 0u8;
    let mut i = start;
    while (i < len) {
        let byte = (*vector::borrow(data, i)) as u64;
        i = i + 1;
        result = result | ((byte & 0x7f) << shift);
        if ((byte & 0x80) == 0) {
            return (result, i)
        };
        shift = shift + 7;
        if (shift > 63) {
            abort errors::out_of_bounds()
        };
    };
    abort errors::out_of_bounds()
}

fun read_vec_u8(data: &vector<u8>, start: u64): (vector<u8>, u64) {
    let (vlen, off) = read_uleb128(data, start);
    let end = off + vlen;
    if (end > vector::length(data)) {
        abort errors::out_of_bounds()
    };
    let mut out = vector[];
    let mut i = off;
    while (i < end) {
        vector::push_back(&mut out, *vector::borrow(data, i));
        i = i + 1;
    };
    (out, end)
}

public fun pool_id(plain: &PaidProphecyPlain): ID {
    plain.pool_id
}

public fun predicted_value(plain: &PaidProphecyPlain): u64 {
    plain.predicted_value
}

public fun predicted_low(plain: &PaidProphecyPlain): u64 {
    plain.predicted_low
}

public fun predicted_high(plain: &PaidProphecyPlain): u64 {
    plain.predicted_high
}
