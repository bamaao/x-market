const SUI_ADDRESS_RE = /^0x[a-f0-9]{64}$/;

export function normalizeSuiAddress(addr: string): string {
  const trimmed = addr.trim().toLowerCase();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

export function isValidSuiAddress(addr: string): boolean {
  return SUI_ADDRESS_RE.test(normalizeSuiAddress(addr));
}

export function parseFollowPair(body: Record<string, unknown>): {
  follower: string;
  prophet: string;
} | { error: string } {
  const follower = normalizeSuiAddress(String(body.follower ?? ""));
  const prophet = normalizeSuiAddress(String(body.prophet ?? ""));
  if (!isValidSuiAddress(follower)) return { error: "invalid follower address" };
  if (!isValidSuiAddress(prophet)) return { error: "invalid prophet address" };
  if (follower === prophet) return { error: "cannot follow yourself" };
  return { follower, prophet };
}
