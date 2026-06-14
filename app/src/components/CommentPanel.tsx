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

type Props = { market: SeedMarket };

function formatCommentTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CommentPanel({ market }: Props) {
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
      setError("请输入评论内容");
      return;
    }
    if (body.length > COMMENT_BODY_MAX) {
      setError(`评论最多 ${COMMENT_BODY_MAX} 字`);
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
      setError(e instanceof Error ? e.message : "发送失败");
    } finally {
      setPending(false);
    }
  }, [author, draft, pending, poolId, signPersonalMessage]);

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
        setError(e instanceof Error ? e.message : "删除失败");
      } finally {
        setDeletingId(null);
      }
    },
    [author, deletingId, poolId, signPersonalMessage],
  );

  if (!indexerEnabled()) {
    return (
      <div className="card panel comment-panel">
        <h2>讨论</h2>
        <p className="hint">评论功能需配置 Indexer（NEXT_PUBLIC_INDEXER_URL）。</p>
      </div>
    );
  }

  if (!poolId) {
    return (
      <div className="card panel comment-panel">
        <h2>讨论</h2>
        <p className="hint">该市场尚未配置 Pool ID，暂无法评论。</p>
      </div>
    );
  }

  return (
    <div className="card panel comment-panel">
      <h2>讨论</h2>
      <p className="hint comment-disclaimer">
        链下评论，未经 Oracle 验证，不构成投资建议。与 SuiProphet 预言/analysis 无关。
      </p>

      {!account ? (
        <p className="hint">连接钱包后可发表评论。</p>
      ) : (
        <div className="comment-compose">
          <textarea
            className="comment-input"
            rows={3}
            maxLength={COMMENT_BODY_MAX}
            placeholder="聊两句…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={pending}
          />
          <div className="comment-compose-footer">
            <span className="hint">
              {draft.trim().length}/{COMMENT_BODY_MAX}
            </span>
            <button type="button" disabled={pending || !draft.trim()} onClick={() => void submit()}>
              {pending ? "发送中…" : "发送"}
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
        <p className="hint">加载评论中…</p>
      ) : comments.length === 0 ? (
        <p className="hint">还没有评论，来第一句吧。</p>
      ) : (
        <ul className="comment-list">
          {comments.map((comment) => {
            const isOwn = author === normalizeSuiAddress(comment.author);
            return (
              <li key={comment.id} className="comment-item">
                <div className="comment-item-head">
                  <code className="mono comment-author">{shortAddress(comment.author)}</code>
                  <time className="hint comment-time">{formatCommentTime(comment.created_at)}</time>
                </div>
                <p className="comment-body">{comment.body}</p>
                {isOwn && (
                  <button
                    type="button"
                    className="secondary comment-delete"
                    disabled={deletingId === comment.id}
                    onClick={() => void remove(comment)}
                  >
                    {deletingId === comment.id ? "删除中…" : "删除"}
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
