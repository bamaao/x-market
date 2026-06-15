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

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { IndexerConfig } from "../config.js";
import { query } from "../db.js";
import {
  balanceValue,
  computeIvMetrics,
  kindFromCode,
  liabilitySum,
  parseMoveFields,
  bytesToHex,
  bytesToText,
  parseObjectId,
} from "../chain/parse.js";

export async function runSnapshotWorker(
  client: SuiJsonRpcClient,
  config: IndexerConfig,
): Promise<number> {
  const markets = await query<{ pool_id: string; feed_id: string | null }>(
    config.databaseUrl,
    "SELECT pool_id, feed_id FROM markets",
  );
  const nowSec = Math.floor(Date.now() / 1000);
  let count = 0;

  for (const row of markets.rows) {
    const obj = await client.getObject({
      id: row.pool_id,
      options: { showContent: true },
    });
    const fields = parseMoveFields(obj.data?.content);
    if (!fields) continue;

    const kind = kindFromCode(Number(fields.kind ?? 0));
    const vault = balanceValue(fields, "vault");
    const liability = liabilitySum(fields);
    const snapshotTs = nowSec;

    await query(
      config.databaseUrl,
      `UPDATE markets SET
        authority = $2, status = $3, lambda_tenths = $4, mu_tenths = $5, sigma_tenths = $6,
        fee_bps = $7, maturity_ts = $8, paused = $9, resolved = $10, resolved_value = $11, updated_at = NOW()
       WHERE pool_id = $1`,
      [
        row.pool_id,
        String(fields.authority ?? ""),
        Number(fields.status ?? 0),
        Number(fields.lambda_tenths ?? 0) || null,
        Number(fields.mu_tenths ?? 0) || null,
        Number(fields.sigma_tenths ?? 0) || null,
        Number(fields.fee_bps ?? 0),
        Number(fields.maturity_ts ?? 0),
        Boolean(fields.paused),
        Boolean(fields.resolved),
        fields.resolved_value != null ? String(fields.resolved_value) : null,
      ],
    );

    await query(
      config.databaseUrl,
      `INSERT INTO pool_snapshots (
        pool_id, vault_usdc, collateral_usdc, lp_shares, fee_bps, fee_multiplier_bps,
        sigma_tenths, sigma_virtual_tenths, concentration_virtual, lambda_tenths, mu_tenths,
        paused, resolved, liability_sum, snapshot_ts, captured_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())`,
      [
        row.pool_id,
        vault.toString(),
        String(fields.collateral_usdc ?? "0"),
        String(fields.lp_shares ?? "0"),
        Number(fields.fee_bps ?? 0),
        Number(fields.fee_multiplier_bps ?? 10_000),
        Number(fields.sigma_tenths ?? 0) || null,
        Number(fields.sigma_virtual_tenths ?? 0) || null,
        Number(fields.concentration_virtual ?? 0) || null,
        Number(fields.lambda_tenths ?? 0) || null,
        Number(fields.mu_tenths ?? 0) || null,
        Boolean(fields.paused),
        Boolean(fields.resolved),
        liability.toString(),
        snapshotTs,
      ],
    );

    const iv = computeIvMetrics({
      kind,
      sigmaTenths: Number(fields.sigma_tenths ?? 0),
      sigmaVirtualTenths: Number(fields.sigma_virtual_tenths ?? 0),
      lambdaTenths: Number(fields.lambda_tenths ?? 0),
      maturityTs: Number(fields.maturity_ts ?? nowSec + 1),
      createdTs: Number(fields.created_ts ?? nowSec - 86400),
      nowSec,
    });

    await query(
      config.databaseUrl,
      `INSERT INTO iv_history (
        pool_id, iv_tenths, tau_bps, vol_crush_bps, sigma_eff_tenths, snapshot_ts, captured_at
      ) VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
      [
        row.pool_id,
        iv.ivTenths,
        iv.tauBps,
        iv.volCrushBps,
        iv.sigmaEffTenths,
        snapshotTs,
      ],
    );

    if (row.feed_id) {
      const feedObj = await client.getObject({
        id: row.feed_id,
        options: { showContent: true },
      });
      const ff = parseMoveFields(feedObj.data?.content) ?? {};
      const active = ff.active_assertion as { fields?: { vec?: unknown[] } } | undefined;
      const activeId =
        Array.isArray(active?.fields?.vec) && active!.fields!.vec!.length
          ? parseObjectId(active!.fields!.vec![0])
          : null;
      await query(
        config.databaseUrl,
        `UPDATE feeds SET
          identifier_hex = $2, identifier_text = $3, event_ts = $4, liveness_secs = $5,
          bond_required = $6, feed_status = $7, finalized_value = $8, active_assertion_id = $9, updated_at = NOW()
         WHERE feed_id = $1`,
        [
          row.feed_id,
          bytesToHex(ff.identifier),
          bytesToText(ff.identifier),
          Number(ff.event_ts ?? 0),
          Number(ff.liveness_secs ?? 0),
          String(ff.bond_required ?? "0"),
          Number(ff.feed_status ?? 0),
          ff.finalized_value != null ? String(ff.finalized_value) : null,
          activeId,
        ],
      );
    }
    count++;
  }
  return count;
}
