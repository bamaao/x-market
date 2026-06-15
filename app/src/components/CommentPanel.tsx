"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useCurrentAccount,
  useSignPersonalMessage,
} from "@mysten/dapp-kit";
import {
  buildCommentDeleteSignMessage,
  buildCommentSignMessage,
  COMMENT_BODY_MAX,
  deleteMarketComment,
  fetchMarketComments,
  newCommentNonce,
  postMarketComment,
  type MarketComment,
} from "@/lib/comments";
import { indexerEnabled } from "@/lib/indexer";
import { defaultPoolId } from "@/lib/markets";
import type { SeedMarket } from "@/lib/markets";
import { normalizeSuiAddress, shortAddress } from "@/lib/prophet";
import { useI18n, useT } from "@/i18n/context";

type Props = { market: SeedMarket };

function formatCommentTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CommentPanel({ market }: Props) {
  const t = useT();
  const { locale } = useI18n();
  const account = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const poolId = defaultPoolId(market);

  const [comments, setComments] = useState<MarketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const author = account?.address ? normalizeSuiAddress(account.address) : null;

  const reload = useCallback(async () => {
    if (!indexerEnabled() || !poolId) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchMarketComments(poolId, 50);
      setComments(rows);
    } finally {
      setLoading(false);
    }
  }, [poolId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const submit = useCallback(async () => {
    if (!author || !poolId || pending) return;
    const body = draft.trim();
    if (!body) {
      setError(t("comments.errEmpty"));
      return;
    }
    if (body.length > COMMENT_BODY_MAX) {
      setError(t("comments.errMax", { max: COMMENT_BODY_MAX }));
      return;
    }

    setPending(true);
    setError(null);
    try {
      const nonce = newCommentNonce();
      const signMessage = await buildCommentSignMessage({
        poolId,
        author,
        nonce,
        body,
      });
      const { signature } = await signPersonalMessage({
        message: new TextEncoder().encode(signMessage),
      });
      const created = await postMarketComment({
        poolId,
        author,
        body,
        nonce,
        signature,
      });
      setComments((prev) => [created, ...prev]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("comments.errSend"));
    } finally {
      setPending(false);
    }
  }, [author, draft, pending, poolId, signPersonalMessage, t]);

  const remove = useCallback(
    async (comment: MarketComment) => {
      if (!author || !poolId || deletingId !== null) return;
      setDeletingId(comment.id);
      setError(null);
      try {
        const nonce = newCommentNonce();
        const signMessage = await buildCommentDeleteSignMessage({
          poolId,
          commentId: comment.id,
          author,
          nonce,
        });
        const { signature } = await signPersonalMessage({
          message: new TextEncoder().encode(signMessage),
        });
        await deleteMarketComment({
          poolId,
          commentId: comment.id,
          author,
          nonce,
          signature,
        });
        setComments((prev) => prev.filter((row) => row.id !== comment.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : t("comments.errDelete"));
      } finally {
        setDeletingId(null);
      }
    },
    [author, deletingId, poolId, signPersonalMessage, t],
  );

  if (!indexerEnabled()) {
    return (
      <div className="card panel comment-panel">
        <h2>{t("comments.title")}</h2>
        <p className="hint">{t("comments.indexerRequired")}</p>
      </div>
    );
  }

  if (!poolId) {
    return (
      <div className="card panel comment-panel">
        <h2>{t("comments.title")}</h2>
        <p className="hint">{t("comments.noPool")}</p>
      </div>
    );
  }

  return (
    <div className="card panel comment-panel">
      <h2>{t("comments.title")}</h2>
      <p className="hint comment-disclaimer">{t("comments.disclaimer")}</p>

      {!account ? (
        <p className="hint">{t("comments.connectHint")}</p>
      ) : (
        <div className="comment-compose">
          <textarea
            className="comment-input"
            rows={3}
            maxLength={COMMENT_BODY_MAX}
            placeholder={t("comments.placeholder")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={pending}
          />
          <div className="comment-compose-footer">
            <span className="hint">
              {draft.trim().length}/{COMMENT_BODY_MAX}
            </span>
            <button type="button" disabled={pending || !draft.trim()} onClick={() => void submit()}>
              {pending ? t("common.sending") : t("common.send")}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="hint" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {loading ? (
        <p className="hint">{t("comments.loading")}</p>
      ) : comments.length === 0 ? (
        <p className="hint">{t("comments.empty")}</p>
      ) : (
        <ul className="comment-list">
          {comments.map((comment) => {
            const isOwn = author === normalizeSuiAddress(comment.author);
            return (
              <li key={comment.id} className="comment-item">
                <div className="comment-item-head">
                  <code className="mono comment-author">{shortAddress(comment.author)}</code>
                  <time className="hint comment-time">
                    {formatCommentTime(comment.created_at, locale)}
                  </time>
                </div>
                <p className="comment-body">{comment.body}</p>
                {isOwn && (
                  <button
                    type="button"
                    className="secondary comment-delete"
                    disabled={deletingId === comment.id}
                    onClick={() => void remove(comment)}
                  >
                    {deletingId === comment.id ? t("common.deleting") : t("common.delete")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
