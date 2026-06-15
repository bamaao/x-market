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

export const ACTIONABLE_QUEUE_STATUSES = [
  "pending_propose",
  "active_assertion",
  "in_arbitration",
  "no_feed",
] as const;

const QUEUE_BASE_CTE = `
  WITH queue_rows AS (
    SELECT
      m.pool_id,
      m.slug,
      m.title,
      m.description,
      m.kind,
      m.maturity_ts,
      m.resolved,
      m.feed_id AS market_feed_id,
      f.feed_id,
      f.feed_status,
      f.active_assertion_id,
      f.event_ts,
      f.liveness_secs,
      ac.case_id AS open_case_id,
      COALESCE(f.feed_id, m.feed_id) AS effective_feed_id,
      CASE
        WHEN m.maturity_ts > $1::bigint THEN 'awaiting_maturity'
        WHEN ac.case_id IS NOT NULL THEN 'in_arbitration'
        WHEN COALESCE(f.active_assertion_id, '') <> '' THEN 'active_assertion'
        WHEN COALESCE(f.feed_id, m.feed_id) IS NOT NULL
          AND COALESCE(f.feed_status, 0) = 0 THEN 'pending_propose'
        WHEN COALESCE(f.feed_id, m.feed_id) IS NULL THEN 'no_feed'
        ELSE 'other'
      END AS queue_status,
      CASE
        WHEN ac.case_id IS NOT NULL THEN 0
        WHEN COALESCE(f.active_assertion_id, '') <> '' THEN 1
        WHEN COALESCE(f.feed_id, m.feed_id) IS NOT NULL
          AND COALESCE(f.feed_status, 0) = 0 THEN 2
        WHEN COALESCE(f.feed_id, m.feed_id) IS NULL THEN 3
        ELSE 4
      END AS queue_priority
    FROM markets m
    LEFT JOIN feeds f ON f.pool_id = m.pool_id
    LEFT JOIN (
      SELECT DISTINCT ON (pool_id) pool_id, case_id
      FROM arbitration_cases
      WHERE status = 0
      ORDER BY pool_id, created_at DESC
    ) ac ON ac.pool_id = m.pool_id
    WHERE m.resolved = FALSE
`;

export function buildOracleQueueQueries(options: {
  nowSec: number;
  search: string;
  statusFilter: string;
  limit: number;
  offset: number;
}): { countSql: string; dataSql: string; params: unknown[] } {
  const params: unknown[] = [options.nowSec];
  let i = 2;

  let searchSql = "";
  if (options.search) {
    searchSql = ` AND (
      LOWER(m.title) LIKE $${i}
      OR LOWER(m.description) LIKE $${i}
      OR LOWER(COALESCE(m.slug, '')) LIKE $${i}
      OR LOWER(m.pool_id) LIKE $${i}
    )`;
    params.push(`%${options.search}%`);
    i++;
  }

  let statusSql = "";
  if (options.statusFilter === "all") {
    statusSql = "queue_status <> 'settled'";
  } else if (options.statusFilter === "actionable") {
    statusSql = `queue_status = ANY($${i}::text[])`;
    params.push([...ACTIONABLE_QUEUE_STATUSES]);
    i++;
  } else {
    statusSql = `queue_status = $${i}`;
    params.push(options.statusFilter);
    i++;
  }

  const limitIdx = i++;
  const offsetIdx = i++;
  params.push(options.limit, options.offset);

  const cteEnd = `${searchSql}
  )`;

  const countSql = `${QUEUE_BASE_CTE}${cteEnd}
    SELECT COUNT(*)::int AS total FROM queue_rows WHERE ${statusSql}`;

  const dataSql = `${QUEUE_BASE_CTE}${cteEnd}
    SELECT
      pool_id,
      slug,
      title,
      description,
      kind,
      maturity_ts,
      resolved,
      market_feed_id,
      feed_id,
      feed_status,
      active_assertion_id,
      event_ts,
      liveness_secs,
      open_case_id,
      effective_feed_id,
      queue_status
    FROM queue_rows
    WHERE ${statusSql}
    ORDER BY queue_priority ASC, maturity_ts ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

  return { countSql, dataSql, params };
}
