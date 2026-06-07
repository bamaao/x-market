import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { IndexerConfig } from "../config.js";
import { query } from "../db.js";
import {
  parseMoveFields,
  parseObjectId,
  parseAddressList,
  bytesToHex,
  prophecyOutcomeLabel,
} from "../chain/parse.js";

export async function refreshProphecyObject(
  client: SuiJsonRpcClient,
  config: IndexerConfig,
  prophecyId: string,
): Promise<void> {
  const obj = await client.getObject({
    id: prophecyId,
    options: { showContent: true },
  });
  const fields = parseMoveFields(obj.data?.content);
  if (!fields) return;

  const paidBuyers = parseAddressList(fields.paid_buyers);
  const status = Number(fields.status ?? 0);
  const unlockPrice = BigInt(String(fields.unlock_price ?? "0"));

  await query(
    config.databaseUrl,
    `UPDATE prophecies SET
      pool_id = $2, prophet = $3, lock_time = $4, unlock_price = $5,
      predicted_value = $6, status = $7, is_public = $8, unlock_count = $9,
      blob_id = $10, seal_id_hex = $11, plaintext_hash_hex = $12, updated_at = NOW()
     WHERE prophecy_id = $1`,
    [
      prophecyId,
      parseObjectId(fields.market_id),
      String(fields.prophet ?? ""),
      Number(fields.lock_time ?? 0),
      unlockPrice.toString(),
      fields.predicted_value != null ? String(fields.predicted_value) : null,
      status,
      Boolean(fields.is_public),
      Number(fields.unlock_count ?? 0),
      String(fields.blob_id ?? ""),
      bytesToHex(fields.seal_id),
      bytesToHex(fields.plaintext_hash),
    ],
  );

  for (const buyer of paidBuyers) {
    await query(
      config.databaseUrl,
      `INSERT INTO prophecy_unlocks (prophecy_id, buyer, unlock_price, unlocked_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (prophecy_id, buyer) DO NOTHING`,
      [prophecyId, buyer, unlockPrice.toString()],
    );
    const outcome = prophecyOutcomeLabel(status);
    let roiBps: number | null = null;
    if (outcome === "win") roiBps = 10_000;
    else if (outcome === "loss") roiBps = -10_000;
    else if (outcome === "cheat") roiBps = -10_000;

    await query(
      config.databaseUrl,
      `INSERT INTO buyer_roi (
        buyer, prophecy_id, prophet, pool_id, unlock_cost, outcome, predicted_value, roi_bps, audited_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
      ON CONFLICT (buyer, prophecy_id) DO UPDATE SET
        outcome = EXCLUDED.outcome, roi_bps = EXCLUDED.roi_bps,
        audited_at = EXCLUDED.audited_at, updated_at = NOW()`,
      [
        buyer,
        prophecyId,
        String(fields.prophet ?? ""),
        parseObjectId(fields.market_id),
        unlockPrice.toString(),
        outcome,
        fields.predicted_value != null ? String(fields.predicted_value) : null,
        roiBps,
        status !== 0 ? new Date() : null,
      ],
    );
  }
}

export async function refreshAllProphecies(
  client: SuiJsonRpcClient,
  config: IndexerConfig,
): Promise<void> {
  const res = await query<{ prophecy_id: string }>(
    config.databaseUrl,
    "SELECT prophecy_id FROM prophecies ORDER BY updated_at DESC LIMIT 500",
  );
  for (const row of res.rows) {
    await refreshProphecyObject(client, config, row.prophecy_id);
  }
}

export async function refreshArbitrationCase(
  client: SuiJsonRpcClient,
  config: IndexerConfig,
  caseId: string,
): Promise<void> {
  const obj = await client.getObject({
    id: caseId,
    options: { showContent: true },
  });
  const fields = parseMoveFields(obj.data?.content);
  if (!fields) return;

  await query(
    config.databaseUrl,
    `UPDATE arbitration_cases SET
      verdict_type = $2, resolved_value = $3, status = $4,
      required_approvals = $5, approvals = $6, expires_at = $7, updated_at = NOW()
     WHERE case_id = $1`,
    [
      caseId,
      Number(fields.verdict_type ?? 0),
      fields.resolved_value != null ? String(fields.resolved_value) : null,
      Number(fields.status ?? 0),
      Number(fields.required_approvals ?? 0),
      JSON.stringify(parseAddressList(fields.approvals)),
      Number(fields.expires_at ?? 0),
    ],
  );
}

export async function refreshAllArbitrationCases(
  client: SuiJsonRpcClient,
  config: IndexerConfig,
): Promise<void> {
  const res = await query<{ case_id: string }>(
    config.databaseUrl,
    "SELECT case_id FROM arbitration_cases",
  );
  for (const row of res.rows) {
    await refreshArbitrationCase(client, config, row.case_id);
  }
}
