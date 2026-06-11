/**
 * X-Market Indexer REST client (P2).
 * Set NEXT_PUBLIC_INDEXER_URL (e.g. http://localhost:8800).
 */

export const INDEXER_URL =
  process.env.NEXT_PUBLIC_INDEXER_URL?.replace(/\/$/, "") ?? "";

export function indexerEnabled(): boolean {
  return INDEXER_URL.length > 0;
}

async function getJson<T>(path: string): Promise<T | null> {
  if (!INDEXER_URL) return null;
  try {
    const res = await fetch(`${INDEXER_URL}${path}`, {
      next: { revalidate: 15 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface IndexerMarket {
  pool_id: string;
  slug: string | null;
  title: string;
  description: string;
  kind: string;
  image_url?: string | null;
  package_id: string;
  fee_bps: number;
  maturity_ts: string;
  paused: boolean;
  resolved: boolean;
  lambda_tenths: number | null;
  mu_tenths: number | null;
  sigma_tenths: number | null;
  feed_id: string | null;
  event_root_id: string | null;
}

export interface IndexerFeed {
  feed_id: string;
  pool_id: string;
  identifier_text: string | null;
  event_ts: string;
  liveness_secs: string;
  feed_status: number;
  market_title?: string;
  market_slug?: string;
}

export interface IndexerProphetStats {
  prophet: string;
  wins: number;
  losses: number;
  cheats: number;
  current_streak: number;
  max_streak: number;
  total_audited: number;
  total_unlock_revenue: string;
  score_bps: number;
  rank: number;
  paid_unlock_eligible: boolean;
}

export interface IndexerIvPoint {
  iv_tenths: number;
  tau_bps: number;
  vol_crush_bps: number;
  sigma_eff_tenths: number;
  snapshot_ts: string;
  captured_at: string;
}

export interface IndexerArbitrationCase {
  case_id: string;
  pool_id: string;
  feed_id: string;
  proposer: string;
  disputer: string;
  claimed_value: string;
  verdict_type: number;
  status: number;
  arbitration_adapter?: string;
  created_at: string;
  expires_at: string;
}

export async function fetchIndexerMarkets(): Promise<IndexerMarket[]> {
  const data = await getJson<{ markets: IndexerMarket[] }>("/v1/markets");
  return data?.markets ?? [];
}

export async function fetchIndexerMarket(poolId: string): Promise<IndexerMarket | null> {
  const data = await getJson<{ market: IndexerMarket }>(
    `/v1/markets/${encodeURIComponent(poolId)}`,
  );
  return data?.market ?? null;
}

export interface RegisterMarketPayload {
  pool_id: string;
  slug: string;
  title: string;
  description: string;
  kind: string;
  image_url?: string | null;
  fee_bps: number;
  maturity_ts: number;
  package_id: string;
  authority?: string;
  lambda_tenths?: number | null;
  mu_tenths?: number | null;
  sigma_tenths?: number | null;
}

export async function registerMarketMetadata(
  payload: RegisterMarketPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!INDEXER_URL) {
    return { ok: false, error: "Indexer 未配置" };
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const secret = process.env.NEXT_PUBLIC_MARKET_REGISTER_SECRET?.trim();
  if (secret) headers["X-Market-Register-Secret"] = secret;
  try {
    const res = await fetch(`${INDEXER_URL}/v1/markets/register`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function fetchIndexerFeeds(): Promise<IndexerFeed[]> {
  const data = await getJson<{ feeds: IndexerFeed[] }>("/v1/feeds");
  return data?.feeds ?? [];
}

export async function fetchIndexerLeaderboard(
  limit = 50,
): Promise<IndexerProphetStats[]> {
  const data = await getJson<{ leaderboard: IndexerProphetStats[] }>(
    `/v1/prophet/leaderboard?limit=${limit}`,
  );
  return data?.leaderboard ?? [];
}

export async function fetchIndexerIvHistory(
  poolId: string,
  limit = 100,
): Promise<IndexerIvPoint[]> {
  const data = await getJson<{ ivHistory: IndexerIvPoint[] }>(
    `/v1/pools/${encodeURIComponent(poolId)}/iv-history?limit=${limit}`,
  );
  return data?.ivHistory ?? [];
}

export async function fetchIndexerArbitrationCases(params?: {
  poolId?: string;
  status?: number;
}): Promise<IndexerArbitrationCase[]> {
  const q = new URLSearchParams();
  if (params?.poolId) q.set("pool_id", params.poolId);
  if (params?.status != null) q.set("status", String(params.status));
  const qs = q.toString();
  const data = await getJson<{ cases: IndexerArbitrationCase[] }>(
    `/v1/arbitration/cases${qs ? `?${qs}` : ""}`,
  );
  return data?.cases ?? [];
}

export async function fetchIndexerProphecies(params?: {
  poolId?: string;
  prophet?: string;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (params?.poolId) q.set("pool_id", params.poolId);
  if (params?.prophet) q.set("prophet", params.prophet);
  if (params?.limit) q.set("limit", String(params.limit));
  const data = await getJson<{ prophecies: unknown[] }>(
    `/v1/prophecies?${q.toString()}`,
  );
  return data?.prophecies ?? [];
}

export interface IndexerBuyerRoi {
  buyer: string;
  prophecy_id: string;
  prophet: string;
  pool_id: string;
  unlock_cost: string;
  outcome: string;
  predicted_value: string | null;
  roi_bps: number | null;
}

export interface IndexerBuyerRoiSummary {
  buyer: string;
  total_unlock_cost: string;
  total_positions: number;
  wins: number;
  losses: number;
  cheats: number;
  pending: number;
  aggregate_roi_bps: number | null;
}

export async function fetchIndexerBuyerRoi(buyer: string): Promise<IndexerBuyerRoi[]> {
  const data = await getJson<{ roi: IndexerBuyerRoi[] }>(
    `/v1/buyer-roi?buyer=${encodeURIComponent(buyer)}`,
  );
  return data?.roi ?? [];
}

export async function fetchIndexerBuyerRoiSummary(
  buyer: string,
): Promise<IndexerBuyerRoiSummary | null> {
  const data = await getJson<{ summary: IndexerBuyerRoiSummary | null }>(
    `/v1/buyer-roi/summary?buyer=${encodeURIComponent(buyer)}`,
  );
  return data?.summary ?? null;
}

export interface IndexerEventRoot {
  event_root_id: string;
  pool_id: string;
  feed_id: string | null;
  event_id: string;
  lock_time: string;
  status: number;
  oracle_feed_id: string | null;
  prophet_registry_id: string | null;
  market_title?: string;
  market_slug?: string;
}

export interface IndexerProphetGmvDay {
  day: string;
  unlock_gmv: string;
  unlock_count: number;
  prophecies_audited: number;
}

export interface IndexerProphetGmvTotals {
  total_gmv: string;
  total_unlocks: string;
  total_audited: string;
}

export async function fetchIndexerEventRoots(): Promise<IndexerEventRoot[]> {
  const data = await getJson<{ eventRoots: IndexerEventRoot[] }>("/v1/event-roots");
  return data?.eventRoots ?? [];
}

export async function fetchIndexerProphetGmv(days = 30): Promise<{
  daily: IndexerProphetGmvDay[];
  totals: IndexerProphetGmvTotals | null;
}> {
  const data = await getJson<{
    daily: IndexerProphetGmvDay[];
    totals: IndexerProphetGmvTotals;
  }>(`/v1/metrics/prophet-gmv?days=${days}`);
  return { daily: data?.daily ?? [], totals: data?.totals ?? null };
}

export async function fetchCachedProphecyPlaintext(prophecyId: string) {
  const data = await getJson<{ cache: { plaintext_json: Record<string, unknown> } }>(
    `/v1/prophecies/${encodeURIComponent(prophecyId)}/plaintext`,
  );
  return data?.cache ?? null;
}

export async function checkIndexerHealth(): Promise<boolean> {
  const data = await getJson<{ ok?: boolean }>("/health");
  return Boolean(data?.ok);
}
