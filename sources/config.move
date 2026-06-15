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

/// Global fee defaults and admin capability (PRD §3.3).
module x_market::config;

/// One-time witness for package init (GlobalConfig bootstrap).
public struct CONFIG has drop {}

public struct GlobalConfig has key {
    id: UID,
    admin: address,
    default_fee_bps: u16,
    paused: bool,
}

public struct AdminCap has key, store {
    id: UID,
}

fun init(_: CONFIG, ctx: &mut TxContext) {
    bootstrap(ctx);
}

public(package) fun bootstrap(ctx: &mut TxContext) {
    let cap = AdminCap { id: object::new(ctx) };
    let config = GlobalConfig {
        id: object::new(ctx),
        admin: ctx.sender(),
        default_fee_bps: 30,
        paused: false,
    };
    transfer::share_object(config);
    transfer::transfer(cap, ctx.sender());
}

public fun admin(config: &GlobalConfig): address {
    config.admin
}

public fun assert_admin(config: &GlobalConfig, cap: &AdminCap, sender: address) {
    if (config.admin != sender) {
        abort x_market::errors::not_admin()
    };
    let _ = cap;
}

public fun default_fee_bps(config: &GlobalConfig): u16 {
    config.default_fee_bps
}
