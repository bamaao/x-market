/// Program error codes (abort with u64 code).
module x_market::errors;

const E_MATH_OVERFLOW: u64 = 1;
const E_DIV_BY_ZERO: u64 = 2;
const E_OUT_OF_BOUNDS: u64 = 3;
const E_MARKET_PAUSED: u64 = 4;
const E_UNSUPPORTED_DISTRIBUTION: u64 = 5;
const E_INVALID_INTERVAL: u64 = 6;
const E_MAX_LOSS_EXCEEDED: u64 = 7;
const E_NOT_TRADING: u64 = 8;
const E_NOT_AUCTION: u64 = 9;
const E_AUCTION_ENDED: u64 = 10;
const E_AUCTION_NOT_ENDED: u64 = 11;
const E_INVALID_BUCKET: u64 = 12;
const E_NOT_RESOLVED: u64 = 13;
const E_ALREADY_CLAIMED: u64 = 14;
const E_NOT_ADMIN: u64 = 15;
const E_NOT_WINNER: u64 = 16;
const E_INSUFFICIENT_EQUITY: u64 = 17;
const E_NOT_AUTHORITY: u64 = 18;
const E_LP_MARKET_MISMATCH: u64 = 19;
const E_DEPOSIT_WINDOW_CLOSED: u64 = 20;
const E_BUY_WINDOW_CLOSED: u64 = 21;

public fun math_overflow(): u64 { E_MATH_OVERFLOW }
public fun div_by_zero(): u64 { E_DIV_BY_ZERO }
public fun out_of_bounds(): u64 { E_OUT_OF_BOUNDS }
public fun market_paused(): u64 { E_MARKET_PAUSED }
public fun unsupported_distribution(): u64 { E_UNSUPPORTED_DISTRIBUTION }
public fun invalid_interval(): u64 { E_INVALID_INTERVAL }
public fun max_loss_exceeded(): u64 { E_MAX_LOSS_EXCEEDED }
public fun not_trading(): u64 { E_NOT_TRADING }
public fun not_auction(): u64 { E_NOT_AUCTION }
public fun auction_ended(): u64 { E_AUCTION_ENDED }
public fun auction_not_ended(): u64 { E_AUCTION_NOT_ENDED }
public fun invalid_bucket(): u64 { E_INVALID_BUCKET }
public fun not_resolved(): u64 { E_NOT_RESOLVED }
public fun already_claimed(): u64 { E_ALREADY_CLAIMED }
public fun not_admin(): u64 { E_NOT_ADMIN }
public fun not_winner(): u64 { E_NOT_WINNER }
public fun insufficient_equity(): u64 { E_INSUFFICIENT_EQUITY }
public fun not_authority(): u64 { E_NOT_AUTHORITY }
public fun lp_market_mismatch(): u64 { E_LP_MARKET_MISMATCH }
public fun deposit_window_closed(): u64 { E_DEPOSIT_WINDOW_CLOSED }
public fun buy_window_closed(): u64 { E_BUY_WINDOW_CLOSED }
