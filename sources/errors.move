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
const E_NOT_FINALIZED: u64 = 22;
const E_ALREADY_FINALIZED: u64 = 23;
const E_ASSERTION_ACTIVE: u64 = 24;
const E_NOT_DISPUTED: u64 = 25;
const E_DISPUTED: u64 = 26;
const E_LIVENESS_ACTIVE: u64 = 27;
const E_BOND_TOO_LOW: u64 = 28;
const E_EVENT_NOT_OCCURRED: u64 = 29;
const E_FEED_NULLIFIED: u64 = 30;
const E_NOT_ARBITRATOR: u64 = 31;
const E_NOT_COMMITTEE: u64 = 32;
const E_CASE_EXECUTED: u64 = 33;
const E_VERDICT_MISMATCH: u64 = 34;
const E_FEED_ALREADY_EXISTS: u64 = 35;
const E_NOT_POOL_AUTHORITY: u64 = 36;

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
public fun not_finalized(): u64 { E_NOT_FINALIZED }
public fun already_finalized(): u64 { E_ALREADY_FINALIZED }
public fun assertion_active(): u64 { E_ASSERTION_ACTIVE }
public fun not_disputed(): u64 { E_NOT_DISPUTED }
public fun disputed(): u64 { E_DISPUTED }
public fun liveness_active(): u64 { E_LIVENESS_ACTIVE }
public fun bond_too_low(): u64 { E_BOND_TOO_LOW }
public fun event_not_occurred(): u64 { E_EVENT_NOT_OCCURRED }
public fun feed_nullified(): u64 { E_FEED_NULLIFIED }
public fun not_arbitrator(): u64 { E_NOT_ARBITRATOR }
public fun not_committee(): u64 { E_NOT_COMMITTEE }
public fun case_executed(): u64 { E_CASE_EXECUTED }
public fun verdict_mismatch(): u64 { E_VERDICT_MISMATCH }
public fun feed_already_exists(): u64 { E_FEED_ALREADY_EXISTS }
public fun not_pool_authority(): u64 { E_NOT_POOL_AUTHORITY }
