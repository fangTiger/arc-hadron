"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { formatUsdc } from "@/lib/format";
import {
  averageApyBps,
  formatApyBps,
  total24hVolume,
  totalValueLocked,
} from "@/lib/marketMetrics";
import type { TradeEvent } from "@/lib/events";
import type { AssetView } from "@/lib/mappers";

export function StatsStrip({
  assets,
  events,
  isLoading,
  nowMs,
}: {
  assets: AssetView[];
  events: TradeEvent[];
  isLoading: boolean;
  nowMs: number;
}) {
  return (
    <StatsStripView
      assetCount={assets.length}
      avgApyBps={averageApyBps(assets)}
      isLoading={isLoading}
      tradeCount={events.length}
      tvl={totalValueLocked(assets, events)}
      volume24h={total24hVolume(events, nowMs)}
    />
  );
}

export function StatsStripView({
  assetCount,
  avgApyBps,
  isLoading,
  tradeCount,
  tvl,
  volume24h,
}: {
  assetCount: number;
  avgApyBps: number | null;
  isLoading: boolean;
  tradeCount: number;
  tvl: bigint;
  volume24h: bigint;
}) {
  const items = [
    { label: "TVL", value: `${formatUsdc(tvl, { compact: true })} USDC` },
    { label: "24H VOL", value: `${formatUsdc(volume24h, { compact: true })} USDC` },
    { label: "AVG YIELD", value: formatApyBps(avgApyBps), tone: "text-gold" },
    { label: "ASSETS", value: assetCount.toString() },
    { label: "TRADES", value: tradeCount.toString() },
  ];

  return (
    <section className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
      {items.map((item) => (
        <div className="inline-flex min-h-5 items-center gap-2" key={item.label}>
          <span>{item.label}</span>
          {isLoading ? (
            <Skeleton className="h-3 w-16" />
          ) : (
            <span className={["text-text", item.tone ?? ""].join(" ")}>{item.value}</span>
          )}
        </div>
      ))}
    </section>
  );
}
