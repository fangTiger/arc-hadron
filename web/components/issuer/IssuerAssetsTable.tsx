"use client";

import { MarketTable } from "@/components/market/MarketTable";
import type { TradeEvent } from "@/lib/events";
import type { AssetView } from "@/lib/mappers";

export function IssuerAssetsTable({
  assets,
  errorText,
  events,
  isLoading,
  nowMs,
}: {
  assets: AssetView[];
  errorText?: string;
  events: TradeEvent[];
  isLoading: boolean;
  nowMs: number;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-text">Assets</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {assets.length} listed
        </p>
      </div>
      <MarketTable
        assets={assets}
        emptyState="No assets registered for this issuer."
        errorText={errorText}
        events={events}
        isLoading={isLoading}
        nowMs={nowMs}
      />
    </section>
  );
}
