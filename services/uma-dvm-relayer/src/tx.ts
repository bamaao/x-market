import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import type { UmaDvmRelayerConfig } from "./config.js";

const SUI_CLOCK_ID = "0x6";

export async function submitUmaDvmArbitration(
  client: SuiJsonRpcClient,
  keypair: Ed25519Keypair,
  config: UmaDvmRelayerConfig,
  args: {
    caseId: string;
    feedId: string;
    poolId: string;
    assertionId: string;
    verdictType: number;
    resolvedValue: bigint;
  },
): Promise<string> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${config.packageId}::oracle_arbitrator::execute_uma_dvm_arbitration`,
    arguments: [
      tx.object(config.arbitratorId),
      tx.object(config.oracleConfigId),
      tx.object(args.caseId),
      tx.object(args.feedId),
      tx.object(args.poolId),
      tx.object(args.assertionId),
      tx.pure.u8(args.verdictType),
      tx.pure.u64(args.resolvedValue),
      tx.object(SUI_CLOCK_ID),
    ],
  });
  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true },
  });
  await client.waitForTransaction({ digest: result.digest });
  if (result.effects?.status?.status !== "success") {
    throw new Error(result.effects?.status?.error ?? "execute_uma_dvm_arbitration failed");
  }
  return result.digest;
}
