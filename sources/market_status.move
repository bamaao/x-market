/// Market lifecycle per PRD §5.
module x_market::market_status;

const STATUS_AUCTION: u8 = 0;
const STATUS_TRADING: u8 = 1;
const STATUS_SETTLED: u8 = 2;

public fun status_auction(): u8 { STATUS_AUCTION }
public fun status_trading(): u8 { STATUS_TRADING }
public fun status_settled(): u8 { STATUS_SETTLED }

public fun is_auction(status: u8): bool {
    status == STATUS_AUCTION
}

public fun is_trading(status: u8): bool {
    status == STATUS_TRADING
}

public fun is_settled(status: u8): bool {
    status == STATUS_SETTLED
}
