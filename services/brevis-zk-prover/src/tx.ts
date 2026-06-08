import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import type { ZkProverConfig } from "./config.js";
import type { ProverOutput } from "./prover/hash.js";

const SUI_CLOCK_ID = "0x6";

export async function submitZkVerification(
  client: SuiJsonRpcClient,
  keypair: Ed25519Keypair,
  config: ZkProverConfig,
  poolId: string,
  output: ProverOutput,
): Promise<{ submitDigest: string; verifyDigest: string }> {
  const submitTx = new Transaction();
  submitTx.moveCall({
    target: `${config.packageId}::zk_coprocessor::submit_proof`,
    arguments: [
      submitTx.object(poolId),
      submitTx.pure.vector("u8", Array.from(output.proofHash)),
      submitTx.object(SUI_CLOCK_ID),
    ],
  });
  const submitRes = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: submitTx,
    options: { showEffects: true, showObjectChanges: true },
  });
  await client.waitForTransaction({ digest: submitRes.digest });
  if (submitRes.effects?.status?.status !== "success") {
    throw new Error(submitRes.effects?.status?.error ?? "submit_proof failed");
  }

  const ticketId = submitRes.objectChanges?.find(
    (c) =>
      c.type === "created" &&
      "objectType" in c &&
      c.objectType?.includes("ZkProofTicket"),
  );
  if (!ticketId || ticketId.type !== "created") {
    throw new Error("ZkProofTicket id not found after submit_proof");
  }

  const verifyTx = new Transaction();
  verifyTx.moveCall({
    target: `${config.packageId}::zk_coprocessor::verify_proof_with_policy`,
    arguments: [
      verifyTx.object(config.verifierPolicyId),
      verifyTx.object(poolId),
      verifyTx.object(ticketId.objectId),
      verifyTx.pure.u8(output.statusCode),
      verifyTx.pure.u8(output.proofSchemeCode),
      verifyTx.pure.vector("u8", Array.from(output.publicInputsHash)),
      verifyTx.object(SUI_CLOCK_ID),
    ],
  });
  const verifyRes = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: verifyTx,
    options: { showEffects: true },
  });
  await client.waitForTransaction({ digest: verifyRes.digest });
  if (verifyRes.effects?.status?.status !== "success") {
    throw new Error(
      verifyRes.effects?.status?.error ?? "verify_proof_with_policy failed",
    );
  }

  return { submitDigest: submitRes.digest, verifyDigest: verifyRes.digest };
}
