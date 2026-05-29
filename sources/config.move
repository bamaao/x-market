/// Global fee defaults and admin capability (PRD §3.3).
module x_market::config;

public struct GlobalConfig has key {
    id: UID,
    admin: address,
    default_fee_bps: u16,
    paused: bool,
}

public struct AdminCap has key, store {
    id: UID,
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
