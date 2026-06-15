"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  checkIndexerFollowing,
  followIndexerProphet,
  indexerEnabled,
  unfollowIndexerProphet,
} from "@/lib/indexer";
import { normalizeSuiAddress } from "@/lib/prophet";
import { useT } from "@/i18n/context";

interface FollowButtonProps {
  prophetAddress: string;
}

export function FollowButton({ prophetAddress }: FollowButtonProps) {
  const account = useCurrentAccount();
  const t = useT();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prophet = normalizeSuiAddress(prophetAddress);
  const follower = account?.address ? normalizeSuiAddress(account.address) : null;
  const isSelf = follower === prophet;

  useEffect(() => {
    if (!follower || !indexerEnabled() || isSelf) {
      setFollowing(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void checkIndexerFollowing(follower, prophet)
      .then((value) => {
        if (!cancelled) setFollowing(value);
      })
      .catch(() => {
        if (!cancelled) setFollowing(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [follower, prophet, isSelf]);

  const toggle = useCallback(async () => {
    if (!follower || !indexerEnabled() || isSelf || pending) return;
    setPending(true);
    setError(null);
    try {
      if (following) {
        await unfollowIndexerProphet(follower, prophet);
        setFollowing(false);
      } else {
        await followIndexerProphet(follower, prophet);
        setFollowing(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("follow.errAction"));
    } finally {
      setPending(false);
    }
  }, [follower, following, isSelf, pending, prophet, t]);

  if (isSelf) return null;

  if (!indexerEnabled()) {
    return <p className="hint">{t("follow.indexerRequired")}</p>;
  }

  if (!account) {
    return <p className="hint">{t("follow.connectHint")}</p>;
  }

  return (
    <div className="follow-actions">
      <button
        type="button"
        className={following ? "secondary" : undefined}
        disabled={loading || pending}
        onClick={() => void toggle()}
      >
        {pending
          ? t("follow.pending")
          : loading
            ? "…"
            : following
              ? t("follow.following")
              : t("follow.follow")}
      </button>
      {error && <p className="hint" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
