'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TargetCard } from '@/components/TargetCard';
import { CountdownBar } from '@/components/CountdownBar';
import { ManualLinks } from '@/components/ManualLinks';
import { WhyDialog } from '@/components/WhyDialog';
import { buildTargetUrl, pickFastest, pingAll, type PingResult } from '@/lib/ping';

// 两个 BawMusic 入口节点
const CANDIDATES = ['https://bawmusic.top', 'https://eo.bawmusic.top'] as const;

// 自动跳转倒计时（毫秒）
const REDIRECT_DELAY_MS = 2500;

export default function BawRouterPage() {
  const [results, setResults] = useState<(PingResult | null)[]>(
    CANDIDATES.map(() => null)
  );
  const [fastest, setFastest] = useState<PingResult | null>(null);
  const [remaining, setRemaining] = useState<number>(REDIRECT_DELAY_MS);
  const [measuring, setMeasuring] = useState(true);
  const [aborted, setAborted] = useState(false);
  const [allFailed, setAllFailed] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  const cancelledRef = useRef(false);
  const redirectedRef = useRef(false);
  const measureControllerRef = useRef<AbortController | null>(null);

  // 跑测速
  const measure = useCallback(async () => {
    // 取消上一次未完成的测速
    measureControllerRef.current?.abort();
    const controller = new AbortController();
    measureControllerRef.current = controller;

    cancelledRef.current = false;
    redirectedRef.current = false;
    setFastest(null);
    setAllFailed(false);
    setAborted(false);
    setMeasuring(true);
    setResults(CANDIDATES.map(() => null));
    setRemaining(REDIRECT_DELAY_MS);

    let res: PingResult[];
    try {
      res = await pingAll([...CANDIDATES], {
        timeoutMs: 2000,
        rounds: 2,
        intervalMs: 200,
        signal: controller.signal,
      });
    } catch (err) {
      // 整体被中止（基本不会走到这里，单条 catch 已被 lib 内部处理）
      const msg = err instanceof Error ? err.message : '测速失败';
      setResults(
        CANDIDATES.map((u) => ({ url: u, ok: false, latencyMs: null, error: msg, samples: [] }))
      );
      setAborted(true);
      setMeasuring(false);
      return;
    }

    // 如果用户在 await 期间触发了 abort，用 controller 状态判断（避免 stale 写入）
    if (controller.signal.aborted) {
      return;
    }
    if (cancelledRef.current) return;

    setResults(res);
    setMeasuring(false);

    // 全部 aborted / failed
    if (res.every((r) => !r.ok)) {
      setAllFailed(true);
      if (res.some((r) => r.error === '已中止')) {
        setAborted(true);
      }
      return;
    }

    const best = pickFastest(res);
    if (!best) {
      setAllFailed(true);
      return;
    }
    setFastest(best);

    // 预解析最优域名（提前建连）
    try {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = best.url;
      document.head.appendChild(link);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void measure();
    return () => {
      measureControllerRef.current?.abort();
    };
  }, [measure]);

  // 倒计时
  useEffect(() => {
    if (!fastest) return;
    if (remaining <= 0) return;
    if (cancelledRef.current) return;
    const timer = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 100));
    }, 100);
    return () => window.clearInterval(timer);
  }, [fastest, remaining]);

  // 倒计时归零 → 跳转
  useEffect(() => {
    if (!fastest) return;
    if (remaining > 0) return;
    if (cancelledRef.current) return;
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    const target = buildTargetUrl(fastest.url);
    window.location.href = target;
  }, [fastest, remaining]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setRemaining(REDIRECT_DELAY_MS);
  }, []);

  const handleRemeasure = useCallback(() => {
    void measure();
  }, [measure]);

  const handleAbort = useCallback(() => {
    measureControllerRef.current?.abort();
  }, []);

  return (
    <main className="app">
      <header className="brand">
        <div className="brand-title">BawMusic Router</div>
        <div className="brand-subtitle">自动选择延迟最低的入口</div>
      </header>

      <section className="targets" aria-label="测速结果">
        {CANDIDATES.map((url, i) => (
          <TargetCard
            key={url}
            url={url}
            result={results[i]}
            isFastest={fastest?.url === url}
            showUrl={false}
          />
        ))}
      </section>

      {allFailed ? (
        <div className="error-state" role="alert">
          <div className="error-state-title">
            {aborted ? '测速已中止' : '两个节点都不可达'}
          </div>
          <div className="error-state-desc">
            {aborted
              ? '你可以点下方「重新测速」再试一次，或直接手动选择入口。'
              : '网络可能受限，或两个 BawMusic 入口都暂时无响应。请检查网络后重试，或手动选择入口。'}
          </div>
        </div>
      ) : (
        <CountdownBar
          remainingMs={remaining}
          totalMs={REDIRECT_DELAY_MS}
          fastestHost={fastest ? new URL(fastest.url).host : null}
          measuring={measuring}
          onCancel={handleCancel}
          onRemeasure={handleRemeasure}
          onAbort={handleAbort}
        />
      )}

      <ManualLinks
        urls={[...CANDIDATES]}
        disabled={false}
        highlightUrl={fastest?.url}
      />

      <footer className="app-footer">
        <button
          type="button"
          className="why-link"
          onClick={() => setWhyOpen(true)}
        >
          为什么看到这个页面？
        </button>
      </footer>

      <WhyDialog open={whyOpen} onClose={() => setWhyOpen(false)} />
    </main>
  );
}
