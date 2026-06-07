import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { IndexerConfig } from "../config.js";
import { query } from "../db.js";
import { getCheckpoint, setCheckpoint } from "../store/checkpoints.js";
import { refreshProphecyObject, refreshArbitrationCase } from "./refresh.js";

const STREAMS = ["ProphecyCommitted", "ArbitrationCaseOpened"] as const;

export async function runEventWorker(
  client: SuiJsonRpcClient,
  config: IndexerConfig,
): Promise<number> {
  let indexed = 0;
  const pkg = config.packageId;

  for (const short of STREAMS) {
    const eventType = `${pkg}::${short === "ProphecyCommitted" ? "prophet_registry" : "oracle_arbitrator"}::${short}`;
    const stream = short;
    const cursorRaw = await getCheckpoint(config.databaseUrl, stream);
    let cursor: Parameters<SuiJsonRpcClient["queryEvents"]>[0]["cursor"] = cursorRaw
      ? (JSON.parse(cursorRaw) as Parameters<SuiJsonRpcClient["queryEvents"]>[0]["cursor"])
      : undefined;

    for (let page = 0; page < 20; page++) {
      const res = await client.queryEvents({
        query: { MoveEventType: eventType },
        cursor,
        limit: 50,
        order: "ascending",
      });

      for (const ev of res.data) {
        const parsed = (ev.parsedJson ?? {}) as Record<string, unknown>;
        await query(
          config.databaseUrl,
          `INSERT INTO chain_events (event_type, tx_digest, event_seq, timestamp_ms, parsed_json)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (event_type, tx_digest, event_seq) DO NOTHING`,
          [
            eventType,
            ev.id.txDigest,
            Number(ev.id.eventSeq ?? 0),
            Number(ev.timestampMs ?? 0),
            JSON.stringify(parsed),
          ],
        );

        if (short === "ProphecyCommitted") {
          const prophecyId = String(parsed.prophecy_id ?? "");
          const poolId = String(parsed.market_id ?? "");
          const prophet = String(parsed.prophet ?? "");
          await query(
            config.databaseUrl,
            `INSERT INTO prophecies (
              prophecy_id, pool_id, prophet, lock_time, unlock_price, committed_at, tx_digest, event_seq, updated_at
            ) VALUES ($1,$2,$3,$4,$5,to_timestamp($6::double precision / 1000.0),$7,$8,NOW())
            ON CONFLICT (prophecy_id) DO UPDATE SET
              pool_id = EXCLUDED.pool_id, prophet = EXCLUDED.prophet, updated_at = NOW()`,
            [
              prophecyId,
              poolId,
              prophet,
              Number(parsed.lock_time ?? 0),
              String(parsed.unlock_price ?? "0"),
              Number(ev.timestampMs ?? 0),
              ev.id.txDigest,
              Number(ev.id.eventSeq ?? 0),
            ],
          );
          await refreshProphecyObject(client, config, prophecyId);
        }

        if (short === "ArbitrationCaseOpened") {
          const caseId = String(parsed.case_id ?? "");
          await query(
            config.databaseUrl,
            `INSERT INTO arbitration_cases (
              case_id, assertion_id, feed_id, pool_id, proposer, disputer, claimed_value,
              created_at, expires_at, opened_tx_digest, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
            ON CONFLICT (case_id) DO NOTHING`,
            [
              caseId,
              String(parsed.assertion_id ?? ""),
              String(parsed.feed_id ?? ""),
              String(parsed.pool_id ?? ""),
              String(parsed.proposer ?? ""),
              String(parsed.disputer ?? ""),
              String(parsed.claimed_value ?? "0"),
              Math.floor(Number(ev.timestampMs ?? 0) / 1000),
              Math.floor(Number(ev.timestampMs ?? 0) / 1000) + 604800,
              ev.id.txDigest,
            ],
          );
          await refreshArbitrationCase(client, config, caseId);
        }
        indexed++;
      }

      if (res.hasNextPage && res.nextCursor) {
        cursor = res.nextCursor;
        await setCheckpoint(config.databaseUrl, stream, JSON.stringify(cursor));
      } else {
        if (cursor) await setCheckpoint(config.databaseUrl, stream, JSON.stringify(cursor));
        break;
      }
    }
  }
  return indexed;
}
