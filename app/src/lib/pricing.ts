/**
 * 定价预览 — 调用 pricing-engine HTTP 或本地公式回退。
 */

export const PRICING_ENGINE_URL =
  process.env.NEXT_PUBLIC_PRICING_ENGINE_URL?.replace(/\/$/, "") ??
  "http://localhost:8801";

export interface QuotePreview {
  entryProbPercent: number;
  payoutUsdc: string;
  impliedRoiBps: number;
}

export async function fetchQuotePreview(params: URLSearchParams): Promise<QuotePreview | null> {
  try {
    const res = await fetch(`${PRICING_ENGINE_URL}/v1/quote?${params.toString()}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { quote?: QuotePreview };
    return json.quote ?? null;
  } catch {
    return null;
  }
}
