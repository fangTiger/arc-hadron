export function ActivityFeedPlaceholder() {
  return (
    <section className="border border-border bg-panel/70 p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">LIVE ACTIVITY</p>
      <div className="flex min-h-40 items-center justify-center text-center text-sm text-muted">
        链上动态流将在 M4 接入（真实事件，非模拟数据）
      </div>
    </section>
  );
}
