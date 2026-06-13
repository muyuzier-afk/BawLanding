'use client';

type Props = {
  remainingMs: number;
  totalMs: number;
  fastestHost: string | null;
  measuring: boolean;
  onCancel: () => void;
  onRemeasure: () => void;
  onAbort: () => void;
};

export function CountdownBar({
  remainingMs,
  totalMs,
  fastestHost,
  measuring,
  onCancel,
  onRemeasure,
  onAbort,
}: Props) {
  const ratio = totalMs > 0 ? remainingMs / totalMs : 0;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));

  return (
    <div className={`countdown ${measuring ? 'measuring' : ''}`}>
      <div className="countdown-text">
        {measuring ? (
          <>
            <span className="dot dot-pulse" aria-hidden="true" />
            <span className="countdown-label">测速进行中…</span>
          </>
        ) : fastestHost ? (
          <>
            <span className="countdown-label">即将跳转</span>
            <span className="countdown-target">{fastestHost}</span>
            <span className="countdown-seconds"> · {seconds}s</span>
          </>
        ) : (
          <span className="countdown-label">等待测速结果…</span>
        )}
      </div>
      {!measuring && (
        <div className="countdown-bar-track" aria-hidden="true">
          <div className="countdown-bar-fill" style={{ width: `${ratio * 100}%` }} />
        </div>
      )}
      <div className="countdown-actions">
        {measuring ? (
          <button
            className="countdown-btn countdown-btn-danger"
            type="button"
            onClick={onAbort}
          >
            中止测速
          </button>
        ) : (
          <>
            <button className="countdown-btn" type="button" onClick={onRemeasure}>
              重新测速
            </button>
            {fastestHost && (
              <button
                className="countdown-btn countdown-btn-ghost"
                type="button"
                onClick={onCancel}
              >
                取消跳转
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
