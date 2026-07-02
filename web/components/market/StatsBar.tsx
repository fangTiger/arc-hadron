"use client";

import { formatUsdc } from "@/lib/format";
import { useMarketStats } from "@/lib/hooks/useAssets";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Skeleton } from "@/components/ui/Skeleton";

function formatApy(bps: number | null) {
  if (bps === null) {
    return "—";
  }

  return `${(bps / 100).toFixed(2)}% APY`;
}

export function StatsBar() {
  const { avgApyBps, errorZh, isLoading, tvl } = useMarketStats();

  return <StatsBarView avgApyBps={avgApyBps} errorZh={errorZh} isLoading={isLoading} tvl={tvl} />;
}

export function StatsBarView({
  avgApyBps,
  errorZh,
  isLoading,
  tvl,
}: {
  avgApyBps: number | null;
  errorZh?: string;
  isLoading: boolean;
  tvl: bigint;
}) {
  const failedText = "读取失败";

  return (
    <section className="grid border border-border bg-panel/80 md:grid-cols-3">
      <div className="border-b border-border p-5 md:border-b-0 md:border-r">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
          TOTAL VALUE LOCKED
        </p>
        {errorZh ? (
          <p className="mt-3 font-mono text-lg text-down" title={errorZh}>
            {failedText}
          </p>
        ) : isLoading ? (
          <Skeleton className="mt-4 h-8 w-32" />
        ) : (
          <p className="mt-3 flex items-end gap-2 text-3xl font-semibold">
            <AnimatedNumber value={formatUsdc(tvl, { compact: true })} />
            <span className="pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
              USDC
            </span>
          </p>
        )}
      </div>

      <div className="border-b border-border p-5 md:border-b-0 md:border-r">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">24H VOLUME</p>
        <p className="mt-3 font-mono text-3xl font-semibold text-muted" title="M4 接入链上事件后展示">
          —
        </p>
      </div>

      <div className="p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">AVG YIELD</p>
        {errorZh ? (
          <p className="mt-3 font-mono text-lg text-down" title={errorZh}>
            {failedText}
          </p>
        ) : isLoading ? (
          <Skeleton className="mt-4 h-8 w-28" />
        ) : (
          <p className="mt-3 font-mono text-3xl font-semibold text-gold">
            <AnimatedNumber value={formatApy(avgApyBps)} />
          </p>
        )}
      </div>
    </section>
  );
}
