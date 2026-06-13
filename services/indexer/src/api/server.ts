import http from "node:http";
import type { IndexerConfig } from "../config.js";
import {
  isSafeCoverFilename,
  readMarketCover,
} from "../covers.js";
import { storeMarketCover } from "../cover-storage.js";
import {
  isSafeProphecyBlobFilename,
  readProphecyBlobLocal,
} from "../prophecy-blobs.js";
import { storeProphecyBlob } from "../prophecy-blob-storage.js";
import { query } from "../db.js";
import {
  attachTagsToMarkets,
  listTags,
  normalizeTagSlugs,
  SEED_MARKET_TAGS,
  syncMarketTags,
} from "../market-tags.js";

type Handler = (
  req: http.IncomingMessage,
  params: Record<string, string>,
) => Promise<{ status: number; body: unknown }>;

function json(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  cors: string,
  methods = "GET, OPTIONS",
) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": cors,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, X-Market-Register-Secret",
  });
  res.end(JSON.stringify(body));
}

async function readRawBody(req: http.IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw new Error("payload too large");
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function checkRegisterSecret(
  req: http.IncomingMessage,
  config: IndexerConfig,
): boolean {
  if (!config.marketRegisterSecret) return true;
  return req.headers["x-market-register-secret"] === config.marketRegisterSecret;
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  return JSON.parse(text) as unknown;
}

function matchRoute(
  method: string,
  url: string,
): { route: string; params: Record<string, string> } | null {
  if (method !== "GET") return null;
  const path = url.split("?")[0];
  const routes: { pattern: RegExp; route: string; keys: string[] }[] = [
    { pattern: /^\/health$/, route: "health", keys: [] },
    { pattern: /^\/v1\/covers\/([^/]+)$/, route: "cover", keys: ["filename"] },
    { pattern: /^\/v1\/prophecies\/blobs\/([^/]+)$/, route: "prophecyBlob", keys: ["filename"] },
    { pattern: /^\/v1\/tags$/, route: "tags", keys: [] },
    { pattern: /^\/v1\/markets$/, route: "markets", keys: [] },
    { pattern: /^\/v1\/markets\/([^/]+)$/, route: "market", keys: ["poolId"] },
    { pattern: /^\/v1\/feeds$/, route: "feeds", keys: [] },
    { pattern: /^\/v1\/feeds\/([^/]+)$/, route: "feed", keys: ["feedId"] },
    { pattern: /^\/v1\/prophet\/leaderboard$/, route: "leaderboard", keys: [] },
    { pattern: /^\/v1\/prophet\/([^/]+)\/stats$/, route: "prophetStats", keys: ["prophet"] },
    { pattern: /^\/v1\/prophet\/([^/]+)\/history$/, route: "prophetHistory", keys: ["prophet"] },
    { pattern: /^\/v1\/prophecies$/, route: "prophecies", keys: [] },
    { pattern: /^\/v1\/pools\/([^/]+)\/snapshots$/, route: "snapshots", keys: ["poolId"] },
    { pattern: /^\/v1\/pools\/([^/]+)\/iv-history$/, route: "ivHistory", keys: ["poolId"] },
    { pattern: /^\/v1\/arbitration\/cases$/, route: "arbitration", keys: [] },
    { pattern: /^\/v1\/buyer-roi\/summary$/, route: "buyerRoiSummary", keys: [] },
    { pattern: /^\/v1\/buyer-roi$/, route: "buyerRoi", keys: [] },
    { pattern: /^\/v1\/prophecies\/([^/]+)\/plaintext$/, route: "prophecyPlaintext", keys: ["prophecyId"] },
    { pattern: /^\/v1\/events$/, route: "events", keys: [] },
    { pattern: /^\/v1\/event-roots$/, route: "eventRoots", keys: [] },
    { pattern: /^\/v1\/event-roots\/([^/]+)$/, route: "eventRoot", keys: ["rootId"] },
    { pattern: /^\/v1\/metrics\/prophet-gmv$/, route: "prophetGmv", keys: [] },
  ];
  for (const r of routes) {
    const m = path.match(r.pattern);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => {
      params[k] = m[i + 1];
    });
    return { route: r.route, params };
  }
  return null;
}

function parseQuery(url: string): URLSearchParams {
  const i = url.indexOf("?");
  return new URLSearchParams(i >= 0 ? url.slice(i + 1) : "");
}

export function createApiServer(config: IndexerConfig, state: { lastEventAt: string | null; lastSnapshotAt: string | null }) {
  const handlers: Record<string, Handler> = {
    health: async () => ({
      status: 200,
      body: {
        ok: true,
        service: "x-market-indexer",
        lastEventAt: state.lastEventAt,
        lastSnapshotAt: state.lastSnapshotAt,
        coverStorage: config.coverStorage,
        prophetStorage: config.prophetStorage,
        ipfsPinProvider:
          config.coverStorage === "ipfs" || config.prophetStorage === "ipfs"
            ? config.ipfsPinProvider
            : null,
      },
    }),

    tags: async () => {
      const rows = await listTags(config.databaseUrl);
      return { status: 200, body: { tags: rows } };
    },

    cover: async (_req, params) => {
      const filename = params.filename ?? "";
      const file = await readMarketCover(config.coversDir, filename);
      if (!file) {
        return { status: 404, body: { error: "cover not found" } };
      }
      return {
        status: 200,
        body: file.data,
        contentType: file.contentType,
        cacheControl: "public, max-age=86400, immutable",
      };
    },

    prophecyBlob: async (_req, params) => {
      const filename = params.filename ?? "";
      if (!isSafeProphecyBlobFilename(filename)) {
        return { status: 400, body: { error: "invalid blob filename" } };
      }
      const data = await readProphecyBlobLocal(config.prophetBlobsDir, filename);
      if (!data) {
        return { status: 404, body: { error: "prophecy blob not found" } };
      }
      return {
        status: 200,
        body: data,
        contentType: "application/octet-stream",
        cacheControl: "public, max-age=86400, immutable",
      };
    },

    markets: async (req) => {
      const q = parseQuery(req.url ?? "");
      const tag = q.get("tag")?.trim().toLowerCase() ?? "";
      const kind = q.get("kind")?.trim().toLowerCase() ?? "";
      const search = q.get("q")?.trim().toLowerCase() ?? "";

      let sql = "SELECT * FROM markets WHERE 1=1";
      const params: unknown[] = [];
      let i = 1;

      if (kind) {
        sql += ` AND kind = $${i++}`;
        params.push(kind);
      }
      if (tag) {
        sql += ` AND pool_id IN (SELECT pool_id FROM market_tags WHERE tag_slug = $${i++})`;
        params.push(tag);
      }
      if (search) {
        sql += ` AND (
          LOWER(title) LIKE $${i}
          OR LOWER(description) LIKE $${i}
          OR LOWER(COALESCE(slug, '')) LIKE $${i}
          OR LOWER(pool_id) LIKE $${i}
        )`;
        params.push(`%${search}%`);
        i++;
      }
      sql += " ORDER BY maturity_ts ASC";

      const res = await query(config.databaseUrl, sql, params);
      const markets = await attachTagsToMarkets(
        config.databaseUrl,
        res.rows as Array<{ pool_id: string }>,
      );
      return { status: 200, body: { markets } };
    },

    market: async (_req, params) => {
      const res = await query(config.databaseUrl, "SELECT * FROM markets WHERE pool_id = $1", [
        params.poolId,
      ]);
      if (!res.rows.length) return { status: 404, body: { error: "not found" } };
      const [market] = await attachTagsToMarkets(
        config.databaseUrl,
        res.rows as Array<{ pool_id: string }>,
      );
      return { status: 200, body: { market } };
    },

    feeds: async () => {
      const res = await query(
        config.databaseUrl,
        `SELECT f.*, m.title AS market_title, m.slug AS market_slug
         FROM feeds f JOIN markets m ON m.pool_id = f.pool_id ORDER BY f.event_ts ASC`,
      );
      return { status: 200, body: { feeds: res.rows } };
    },

    feed: async (_req, params) => {
      const res = await query(config.databaseUrl, "SELECT * FROM feeds WHERE feed_id = $1", [
        params.feedId,
      ]);
      if (!res.rows.length) return { status: 404, body: { error: "not found" } };
      return { status: 200, body: { feed: res.rows[0] } };
    },

    leaderboard: async (req) => {
      const q = parseQuery(req.url ?? "");
      const limit = Math.min(100, Math.max(1, Number(q.get("limit") ?? "50")));
      const res = await query(
        config.databaseUrl,
        `SELECT * FROM prophet_stats ORDER BY rank ASC NULLS LAST, score_bps DESC LIMIT $1`,
        [limit],
      );
      return { status: 200, body: { leaderboard: res.rows } };
    },

    prophetStats: async (_req, params) => {
      const res = await query(
        config.databaseUrl,
        "SELECT * FROM prophet_stats WHERE prophet = $1",
        [params.prophet],
      );
      if (!res.rows.length) return { status: 404, body: { error: "not found" } };
      return { status: 200, body: { stats: res.rows[0] } };
    },

    prophetHistory: async (req, params) => {
      const q = parseQuery(req.url ?? "");
      const limit = Math.min(500, Math.max(1, Number(q.get("limit") ?? "100")));
      const res = await query(
        config.databaseUrl,
        `SELECT score_bps, rank, wins, losses, snapshot_at
         FROM prophet_stats_history WHERE prophet = $1 ORDER BY snapshot_at DESC LIMIT $2`,
        [params.prophet, limit],
      );
      return { status: 200, body: { history: res.rows } };
    },

    prophecies: async (req) => {
      const q = parseQuery(req.url ?? "");
      const poolId = q.get("pool_id");
      const prophet = q.get("prophet");
      const limit = Math.min(200, Math.max(1, Number(q.get("limit") ?? "50")));
      const clauses: string[] = [];
      const args: unknown[] = [];
      if (poolId) {
        args.push(poolId);
        clauses.push(`pool_id = $${args.length}`);
      }
      if (prophet) {
        args.push(prophet);
        clauses.push(`prophet = $${args.length}`);
      }
      args.push(limit);
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const res = await query(
        config.databaseUrl,
        `SELECT * FROM prophecies ${where} ORDER BY committed_at DESC NULLS LAST LIMIT $${args.length}`,
        args,
      );
      return { status: 200, body: { prophecies: res.rows } };
    },

    snapshots: async (req, params) => {
      const q = parseQuery(req.url ?? "");
      const limit = Math.min(500, Math.max(1, Number(q.get("limit") ?? "100")));
      const res = await query(
        config.databaseUrl,
        `SELECT * FROM pool_snapshots WHERE pool_id = $1 ORDER BY snapshot_ts DESC LIMIT $2`,
        [params.poolId, limit],
      );
      return { status: 200, body: { snapshots: res.rows } };
    },

    ivHistory: async (req, params) => {
      const q = parseQuery(req.url ?? "");
      const limit = Math.min(500, Math.max(1, Number(q.get("limit") ?? "200")));
      const res = await query(
        config.databaseUrl,
        `SELECT * FROM iv_history WHERE pool_id = $1 ORDER BY snapshot_ts DESC LIMIT $2`,
        [params.poolId, limit],
      );
      return { status: 200, body: { ivHistory: res.rows } };
    },

    arbitration: async (req) => {
      const q = parseQuery(req.url ?? "");
      const status = q.get("status");
      const poolId = q.get("pool_id");
      const args: unknown[] = [];
      const clauses: string[] = [];
      if (status != null) {
        args.push(Number(status));
        clauses.push(`status = $${args.length}`);
      }
      if (poolId) {
        args.push(poolId);
        clauses.push(`pool_id = $${args.length}`);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const res = await query(
        config.databaseUrl,
        `SELECT * FROM arbitration_cases ${where} ORDER BY created_at DESC`,
        args,
      );
      return { status: 200, body: { cases: res.rows } };
    },

    buyerRoiSummary: async (req) => {
      const q = parseQuery(req.url ?? "");
      const buyer = q.get("buyer");
      if (!buyer) return { status: 400, body: { error: "buyer required" } };
      const res = await query(
        config.databaseUrl,
        "SELECT * FROM buyer_roi_summary WHERE buyer = $1",
        [buyer],
      );
      if (!res.rows.length) {
        return { status: 200, body: { summary: null, note: "no follow trades indexed yet" } };
      }
      return { status: 200, body: { summary: res.rows[0] } };
    },

    buyerRoi: async (req) => {
      const q = parseQuery(req.url ?? "");
      const buyer = q.get("buyer");
      if (!buyer) return { status: 400, body: { error: "buyer required" } };
      const res = await query(
        config.databaseUrl,
        `SELECT * FROM buyer_roi WHERE buyer = $1 ORDER BY updated_at DESC`,
        [buyer],
      );
      return { status: 200, body: { roi: res.rows } };
    },

    prophecyPlaintext: async (_req, params) => {
      const res = await query(
        config.databaseUrl,
        `SELECT prophecy_id, pool_id, blob_id, plaintext_json, cached_at, lock_time, source
         FROM seal_plaintext_cache WHERE prophecy_id = $1`,
        [params.prophecyId],
      );
      if (!res.rows.length) {
        return { status: 404, body: { error: "not cached yet — wait for lock_time or public prophecy" } };
      }
      return { status: 200, body: { cache: res.rows[0] } };
    },

    eventRoots: async () => {
      const res = await query(
        config.databaseUrl,
        `SELECT e.*, m.title AS market_title, m.slug AS market_slug
         FROM event_roots e
         LEFT JOIN markets m ON m.pool_id = e.pool_id
         ORDER BY e.lock_time ASC`,
      );
      return { status: 200, body: { eventRoots: res.rows } };
    },

    eventRoot: async (_req, params) => {
      const res = await query(
        config.databaseUrl,
        "SELECT * FROM event_roots WHERE event_root_id = $1",
        [params.rootId],
      );
      if (!res.rows.length) return { status: 404, body: { error: "not found" } };
      return { status: 200, body: { eventRoot: res.rows[0] } };
    },

    prophetGmv: async (req) => {
      const q = parseQuery(req.url ?? "");
      const days = Math.min(90, Math.max(7, Number(q.get("days") ?? "30")));
      const res = await query(
        config.databaseUrl,
        `SELECT day, unlock_gmv, unlock_count, prophecies_audited, refreshed_at
         FROM prophet_gmv_daily
         WHERE day >= CURRENT_DATE - $1::int
         ORDER BY day ASC`,
        [days],
      );
      const totals = await query(
        config.databaseUrl,
        `SELECT
           COALESCE(SUM(unlock_gmv), 0)::text AS total_gmv,
           COALESCE(SUM(unlock_count), 0)::text AS total_unlocks,
           COALESCE(SUM(prophecies_audited), 0)::text AS total_audited
         FROM prophet_gmv_daily
         WHERE day >= CURRENT_DATE - $1::int`,
        [days],
      );
      return {
        status: 200,
        body: {
          days,
          daily: res.rows,
          totals: totals.rows[0] ?? {},
        },
      };
    },

    events: async (req) => {
      const q = parseQuery(req.url ?? "");
      const limit = Math.min(200, Math.max(1, Number(q.get("limit") ?? "50")));
      const eventType = q.get("type");
      if (eventType) {
        const res = await query(
          config.databaseUrl,
          `SELECT * FROM chain_events WHERE event_type LIKE $1 ORDER BY timestamp_ms DESC LIMIT $2`,
          [`%${eventType}%`, limit],
        );
        return { status: 200, body: { events: res.rows } };
      }
      const res = await query(
        config.databaseUrl,
        `SELECT * FROM chain_events ORDER BY timestamp_ms DESC LIMIT $1`,
        [limit],
      );
      return { status: 200, body: { events: res.rows } };
    },
  };

  const host = process.env.HOST ?? "0.0.0.0";
  const server = http.createServer(async (req, res) => {
    const urlPath = (req.url ?? "/").split("?")[0];

    if (req.method === "OPTIONS") {
      json(res, 204, {}, config.corsOrigin, "GET, POST, OPTIONS");
      return;
    }

    if (req.method === "POST" && urlPath === "/v1/prophecies/blob") {
      try {
        if (!checkRegisterSecret(req, config)) {
          json(res, 403, { error: "invalid register secret" }, config.corsOrigin, "GET, POST, OPTIONS");
          return;
        }
        const q = parseQuery(req.url ?? "");
        const poolId = String(q.get("pool_id") ?? "").trim();
        if (!poolId) {
          json(res, 400, { error: "pool_id query param required" }, config.corsOrigin, "GET, POST, OPTIONS");
          return;
        }
        const data = await readRawBody(req, 512 * 1024);
        const saved = await storeProphecyBlob(config, poolId, data);
        json(
          res,
          200,
          {
            ok: true,
            blob_id: saved.blobId,
            storage: saved.storage,
            cid: saved.cid ?? null,
            filename: saved.filename ?? null,
          },
          config.corsOrigin,
          "GET, POST, OPTIONS",
        );
      } catch (e) {
        json(
          res,
          400,
          { error: e instanceof Error ? e.message : "prophecy blob upload failed" },
          config.corsOrigin,
          "GET, POST, OPTIONS",
        );
      }
      return;
    }

    if (req.method === "POST" && urlPath === "/v1/markets/cover") {
      try {
        if (!checkRegisterSecret(req, config)) {
          json(res, 403, { error: "invalid register secret" }, config.corsOrigin, "GET, POST, OPTIONS");
          return;
        }
        const q = parseQuery(req.url ?? "");
        const slug = String(q.get("slug") ?? "").trim();
        if (!slug) {
          json(res, 400, { error: "slug query param required" }, config.corsOrigin, "GET, POST, OPTIONS");
          return;
        }
        const contentType = String(req.headers["content-type"] ?? "").trim();
        const data = await readRawBody(req, 2 * 1024 * 1024);
        const saved = await storeMarketCover(config, slug, contentType, data);
        json(
          res,
          200,
          {
            ok: true,
            image_url: saved.imageUrl,
            storage: saved.storage,
            cid: saved.cid ?? null,
            filename: saved.filename ?? null,
          },
          config.corsOrigin,
          "GET, POST, OPTIONS",
        );
      } catch (e) {
        json(
          res,
          400,
          { error: e instanceof Error ? e.message : "cover upload failed" },
          config.corsOrigin,
          "GET, POST, OPTIONS",
        );
      }
      return;
    }

    if (req.method === "POST" && urlPath === "/v1/markets/register") {
      try {
        if (!checkRegisterSecret(req, config)) {
          json(res, 403, { error: "invalid register secret" }, config.corsOrigin, "GET, POST, OPTIONS");
          return;
        }
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        const poolId = String(body.pool_id ?? "").trim();
        const slug = String(body.slug ?? "").trim();
        const title = String(body.title ?? "").trim();
        const description = String(body.description ?? "").trim();
        const kind = String(body.kind ?? "").trim();
        if (!poolId || !slug || !title || !kind) {
          json(res, 400, { error: "pool_id, slug, title, kind required" }, config.corsOrigin, "GET, POST, OPTIONS");
          return;
        }
        await query(
          config.databaseUrl,
          `INSERT INTO markets (
            pool_id, slug, title, description, image_url, kind, package_id, authority, status,
            lambda_tenths, mu_tenths, sigma_tenths, fee_bps, maturity_ts, paused, resolved, updated_at, indexed_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10,$11,$12,$13,false,false,NOW(),NOW()
          )
          ON CONFLICT (pool_id) DO UPDATE SET
            slug = EXCLUDED.slug,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            image_url = EXCLUDED.image_url,
            kind = EXCLUDED.kind,
            authority = EXCLUDED.authority,
            lambda_tenths = EXCLUDED.lambda_tenths,
            mu_tenths = EXCLUDED.mu_tenths,
            sigma_tenths = EXCLUDED.sigma_tenths,
            fee_bps = EXCLUDED.fee_bps,
            maturity_ts = EXCLUDED.maturity_ts,
            updated_at = NOW()`,
          [
            poolId,
            slug,
            title,
            description,
            body.image_url != null ? String(body.image_url) : null,
            kind,
            String(body.package_id ?? config.packageId),
            body.authority != null ? String(body.authority) : null,
            body.lambda_tenths != null ? Number(body.lambda_tenths) : null,
            body.mu_tenths != null ? Number(body.mu_tenths) : null,
            body.sigma_tenths != null ? Number(body.sigma_tenths) : null,
            Number(body.fee_bps ?? 30),
            Number(body.maturity_ts ?? 0),
          ],
        );
        const tagSlugs = normalizeTagSlugs(body.tags);
        if (tagSlugs.length) {
          await syncMarketTags(config.databaseUrl, poolId, tagSlugs);
        }
        json(res, 200, { ok: true, pool_id: poolId, tags: tagSlugs }, config.corsOrigin, "GET, POST, OPTIONS");
      } catch (e) {
        json(
          res,
          500,
          { error: e instanceof Error ? e.message : "internal error" },
          config.corsOrigin,
          "GET, POST, OPTIONS",
        );
      }
      return;
    }

    const matched = matchRoute(req.method ?? "GET", req.url ?? "/");
    if (!matched) {
      json(res, 404, { error: "not found" }, config.corsOrigin, "GET, POST, OPTIONS");
      return;
    }
    try {
      const result = await handlers[matched.route](req, matched.params);
      if (
        (matched.route === "cover" || matched.route === "prophecyBlob") &&
        Buffer.isBuffer(result.body)
      ) {
        res.writeHead(result.status, {
          "Content-Type": (result as { contentType?: string }).contentType ?? "application/octet-stream",
          "Cache-Control": (result as { cacheControl?: string }).cacheControl ?? "public, max-age=86400",
          "Access-Control-Allow-Origin": config.corsOrigin,
        });
        res.end(result.body);
        return;
      }
      json(res, result.status, result.body, config.corsOrigin, "GET, POST, OPTIONS");
    } catch (e) {
      json(
        res,
        500,
        { error: e instanceof Error ? e.message : "internal error" },
        config.corsOrigin,
        "GET, POST, OPTIONS",
      );
    }
  });

  server.listen(config.apiPort, host, () => {
    console.log(
      JSON.stringify({ event: "indexer_api_listening", host, port: config.apiPort }),
    );
  });
  return server;
}
