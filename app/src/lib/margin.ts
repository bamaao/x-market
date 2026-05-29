import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID } from "./markets";

export function appendOpenMarginAccount(tx: Transaction, poolId: string) {
  tx.moveCall({
    target: `${PACKAGE_ID}::cross_margin::open_account`,
    arguments: [tx.object(poolId)],
  });
}

export function appendRegisterPosition(
  tx: Transaction,
  marginAccountId: string,
  poolId: string,
  positionId: string,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::cross_margin::register_position`,
    arguments: [tx.object(marginAccountId), tx.object(poolId), tx.object(positionId)],
  });
}

export function appendUnregisterPosition(
  tx: Transaction,
  marginAccountId: string,
  poolId: string,
  positionId: string,
) {
  tx.moveCall({
    target: `${PACKAGE_ID}::cross_margin::unregister_position`,
    arguments: [tx.object(marginAccountId), tx.object(poolId), tx.object(positionId)],
  });
}
