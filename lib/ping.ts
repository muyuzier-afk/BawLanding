// 目标节点测速：fetch + performance.now + AbortController 超时
// 模式：no-cors，保证从任何静态托管域发起都不会 CORS 失败
// 注意：no-cors 拿到的是 opaque response，response.status 始终为 0，
// 但请求是否真的到达 / 完成会通过 fetch 自身的 resolve / reject 体现。
import type { PingResult } from '@/types/route';

export type { PingResult };

type PingOptions = {
  timeoutMs?: number; // 单次请求超时
  rounds?: number;    // 每个目标测几次，取最小值
  intervalMs?: number; // 多次之间的间隔
  signal?: AbortSignal; // 外部中止信号（用户点"中止测速"时触发）
};

const DEFAULT_TIMEOUT = 2000;
const DEFAULT_ROUNDS = 2;
const DEFAULT_INTERVAL = 200;

function combineSignals(signals: AbortSignal[]): AbortSignal {
  // 优先用 AbortSignal.any（现代浏览器内置）
  if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as { any?: unknown }).any === 'function') {
    return (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any(signals);
  }
  // 兜底：手动链
  const ctrl = new AbortController();
  const onAbort = (s: AbortSignal) => () => ctrl.abort(s.reason);
  for (const s of signals) {
    if (s.aborted) {
      ctrl.abort(s.reason);
      break;
    }
    s.addEventListener('abort', onAbort(s), { once: true });
  }
  return ctrl.signal;
}

async function pingOnce(
  url: string,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<number> {
  const timeoutController = new AbortController();
  const timer = window.setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal = externalSignal
    ? combineSignals([timeoutController.signal, externalSignal])
    : timeoutController.signal;

  const started = performance.now();
  try {
    // 拼上随机 query 防止命中任何缓存
    const u = new URL(url);
    u.searchParams.set('_r', String(Date.now()) + Math.random().toString(36).slice(2, 6));
    await fetch(u.toString(), {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal,
      // keepalive 让页面在跳转前的最后一刻仍能完成
      keepalive: true,
    });
    const elapsed = performance.now() - started;
    return elapsed;
  } finally {
    window.clearTimeout(timer);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        window.clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

export async function pingUrl(url: string, options: PingOptions = {}): Promise<PingResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const rounds = options.rounds ?? DEFAULT_ROUNDS;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL;
  const signal = options.signal;
  const samples: number[] = [];
  let lastError: string | undefined;

  for (let i = 0; i < rounds; i++) {
    if (i > 0) await sleep(intervalMs, signal);
    try {
      const ms = await pingOnce(url, timeoutMs, signal);
      samples.push(ms);
    } catch (err) {
      // 外部中止优先识别
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (signal?.aborted) {
          lastError = '已中止';
        } else {
          lastError = `超时 (>${timeoutMs}ms)`;
        }
      } else {
        lastError = err instanceof Error ? err.message : '请求失败';
      }
    }
  }

  if (samples.length === 0) {
    return { url, ok: false, latencyMs: null, error: lastError ?? '全部探测失败', samples: [] };
  }

  // 取最小延迟（最稳的网络耗时下界）
  const min = Math.min(...samples);
  return { url, ok: true, latencyMs: min, samples };
}

export async function pingAll(urls: string[], options: PingOptions = {}): Promise<PingResult[]> {
  return Promise.all(urls.map((u) => pingUrl(u, options)));
}

// 选最优：取 ok=true 且 latencyMs 最小的；若无 ok 则全部失败
export function pickFastest(results: PingResult[]): PingResult | null {
  const candidates = results.filter((r) => r.ok && r.latencyMs !== null);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, cur) => (cur.latencyMs! < best.latencyMs! ? cur : best));
}

// 透传当前页面的 path / query / hash 到目标域
export function buildTargetUrl(baseUrl: string): string {
  if (typeof window === 'undefined') return baseUrl;
  const suffix = window.location.pathname + window.location.search + window.location.hash;
  return baseUrl.replace(/\/+$/, '') + suffix;
}
