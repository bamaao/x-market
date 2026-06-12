import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { IndexerConfig } from "../config.js";
import { seedMarketMeta } from "../config.js";
import { query } from "../db.js";
import { SEED_MARKET_TAGS, syncMarketTags } from "../market-tags.js";
import {
  kindFromCode,
  parseMoveFields,
  parseObjectId,
  bytesToHex,
  bytesToText,
} from "../chain/parse.js";
import { Transaction } from "@mysten/sui/transactions";

async function lookupFeed(
  client: SuiJsonRpcClient,
  packageId: string,
  registryId: string,
  poolId: string,
): Promise<string | null> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::macro_oracle::lookup_feed_entry`,
    arguments: [tx.object(registryId), tx.pure.id(poolId)],
  });
  const inspect = await client.devInspectTransactionBlock({
    sender:
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    transactionBlock: tx,
  });
  const raw = inspect.results?.[0]?.returnValues?.[0];
  if (!raw) return null;
  const [bytes] = raw;
  if (!bytes?.length || bytes[0] === 0) return null;
  const idBytes = bytes.slice(1);
  if (idBytes.length !== 32) return null;
  return `0x${(idBytes as number[]).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function seedMarketsFromDeploy(
  client: SuiJsonRpcClient,
  config: IndexerConfig,
): Promise<void> {
  if (!config.seedDeploy?.seedMarkets) return;
  const feedRegistryId = config.seedDeploy.oracle?.feedRegistryId ?? "";

  for (const [key, seed] of Object.entries(config.seedDeploy.seedMarkets)) {
    const meta = seedMarketMeta(key);
    if (!meta) continue;
    const poolId = seed.poolId;
    const obj = await client.getObject({
      id: poolId,
      options: { showContent: true },
    });
    const fields = parseMoveFields(obj.data?.content) ?? {};
    const eventRoot = config.seedDeploy.eventRoots?.[key];

    let feedId = eventRoot?.feedId ?? null;
    if (!feedId && feedRegistryId && config.oracleConfigId) {
      feedId = await lookupFeed(client, config.packageId, feedRegistryId, poolId);
    }

    await query(
      config.databaseUrl,
      `INSERT INTO markets (
        pool_id, slug, title, description, image_url, kind, package_id, authority, status,
        lambda_tenths, mu_tenths, sigma_tenths, mu_units, sigma_units, dirichlet_alphas,
        fee_bps, maturity_ts, resolution_window_ts, created_ts, paused, resolved, resolved_value,
        event_root_id, feed_id, updated_at, indexed_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW(),NOW()
      )
      ON CONFLICT (pool_id) DO UPDATE SET
        slug = EXCLUDED.slug, title = EXCLUDED.title, description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        kind = EXCLUDED.kind, authority = EXCLUDED.authority, status = EXCLUDED.status,
        lambda_tenths = EXCLUDED.lambda_tenths, mu_tenths = EXCLUDED.mu_tenths,
        sigma_tenths = EXCLUDED.sigma_tenths, fee_bps = EXCLUDED.fee_bps,
        maturity_ts = EXCLUDED.maturity_ts, paused = EXCLUDED.paused, resolved = EXCLUDED.resolved,
        event_root_id = EXCLUDED.event_root_id, feed_id = EXCLUDED.feed_id, updated_at = NOW()`,
      [
        poolId,
        meta.slug,
        meta.title,
        meta.description,
        meta.imageUrl,
        kindFromCode(Number(fields.kind ?? 0)),
        config.packageId,
        String(fields.authority ?? ""),
        Number(fields.status ?? 0),
        Number(fields.lambda_tenths ?? seed.lambdaTenths ?? 0) || null,
        Number(fields.mu_tenths ?? seed.muTenths ?? 0) || null,
        Number(fields.sigma_tenths ?? seed.sigmaTenths ?? 0) || null,
        fields.mu_units != null ? String(fields.mu_units) : null,
        fields.sigma_units != null ? String(fields.sigma_units) : null,
        "alphas" in seed && Array.isArray(seed.alphas)
          ? JSON.stringify(seed.alphas)
          : null,
        Number(fields.fee_bps ?? 30),
        Number(fields.maturity_ts ?? 0),
        Number(fields.resolution_window_ts ?? 0) || null,
        Number(fields.created_ts ?? 0) || null,
        Boolean(fields.paused),
        Boolean(fields.resolved),
        fields.resolved_value != null ? String(fields.resolved_value) : null,
        eventRoot?.eventRootId ?? null,
        feedId,
      ],
    );

    const tagSlugs = SEED_MARKET_TAGS[meta.slug] ?? [];
    if (tagSlugs.length) {
      await syncMarketTags(config.databaseUrl, poolId, tagSlugs);
    }

    if (feedId) {
      const feedObj = await client.getObject({
        id: feedId,
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
        `INSERT INTO feeds (
          feed_id, pool_id, identifier_hex, identifier_text, event_ts, liveness_secs,
          bond_required, feed_status, finalized_value, active_assertion_id, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
        ON CONFLICT (feed_id) DO UPDATE SET
          feed_status = EXCLUDED.feed_status, finalized_value = EXCLUDED.finalized_value,
          active_assertion_id = EXCLUDED.active_assertion_id, updated_at = NOW()`,
        [
          feedId,
          poolId,
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
  }
  console.log(JSON.stringify({ event: "indexer_seed_markets_done" }));
}
