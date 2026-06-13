'use client';

import { useEffect } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function WhyDialog({ open, onClose }: Props) {
  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="why-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="why-title"
      onClick={onClose}
    >
      <section className="why-card" onClick={(e) => e.stopPropagation()}>
        <button className="why-close" onClick={onClose} type="button" aria-label="关闭">
          ×
        </button>

        <h2 className="why-title" id="why-title">
          为什么会看到这个页面
        </h2>
        <p className="why-subtitle">BawMusic 智能入口 · 自动测速选路</p>

        <div className="why-section">
          <h3>这个页面是什么</h3>
          <p>
            你正在访问的是 BawMusic 的<b>智能入口页面</b>。它本身不提供音乐播放功能，
            而是用来在两个 BawMusic 服务节点之间自动选择延迟最低的那一个，然后跳过去。
          </p>
        </div>

        <div className="why-section">
          <h3>两个节点的差异</h3>
          <ul>
            <li>
              <code>bawmusic.top</code> — 原版，部署在阿里云 ESA CDN
            </li>
            <li>
              <code>eo.bawmusic.top</code> — 部署在腾讯云 EdgeOne CDN（eo = EdgeOne）
            </li>
          </ul>
        </div>

        <div className="why-section">
          <h3>测速原理</h3>
          <p>
            页面打开时会向两个节点各发送 2 次轻量请求（带随机 query 防缓存），
            记录从发起到收到的耗时，取最小值作为该节点的网络延迟，
            再对比两个节点挑出最优。
          </p>
        </div>

        <div className="why-section">
          <h3>如果你不想等</h3>
          <p>
            可以直接点击下方的「手动选择」链接跳到任一节点；也可以点「取消跳转」停在当前页，
            等想跳转时再点「重新测速」或手动链接。
          </p>
        </div>

        <div className="why-section">
          <h3>隐私</h3>
          <p>
            整个页面是纯前端的：不会写 cookie / localStorage，不会嵌入任何埋点或分析脚本，
            测速请求也不带任何凭据（<code>no-cors</code> 模式）。
          </p>
        </div>
      </section>
    </div>
  );
}
