import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import type { KeeperConfig, PoolSnapshot, TargetGuardParams } from "./types.js";

export function buildSetLpGuardTx(
  config: KeeperConfig,
  snapshot: PoolSnapshot,
  target: TargetGuardParams,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::pool::set_lp_guard_params`,
    arguments: [
      tx.object(snapshot.poolId),
      tx.pure.u16(target.feeMultiplierBps),
      tx.pure.u32(target.sigmaVirtualTenths),
      tx.pure.u32(target.concentrationVirtual),
      tx.pure.u16(snapshot.depositCutoffBps),
      tx.pure.u64(snapshot.resolutionWindowTs),
    ],
  });
  return tx;
}

export async function submitSetLpGuard(
  client: SuiJsonRpcClient,
  keypair: Ed25519Keypair,
  config: KeeperConfig,
  snapshot: PoolSnapshot,
  target: TargetGuardParams,
): Promise<string> {
  const sender = keypair.getPublicKey().toSuiAddress();
  const tx = buildSetLpGuardTx(config, snapshot, target);
  tx.setSender(sender);
  const built = await tx.build({ client });
  const { signature } = await keypair.signTransaction(built);
  const result = await client.executeTransactionBlock({
    transactionBlock: built,
    signature,
    options: { showEffects: true },
  });
  const digest = result.digest;
  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `set_lp_guard_params failed: ${result.effects?.status?.error ?? digest}`,
    );
  }
  return digest;
}
