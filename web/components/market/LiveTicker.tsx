"use client";

import type { TradeEvent } from "@/lib/events";
import { eventsForAssets, eventSentence, eventToneClassName } from "@/lib/marketMetrics";
import type { AssetView } from "@/lib/mappers";

function recentEvents(events: readonly TradeEvent[]): TradeEvent[] {
  return [...events]
    .sort((a, b) => {
      if (a.blockNumber === b.blockNumber) {
        return b.logIndex - a.logIndex;
      }

      return a.blockNumber > b.blockNumber ? -1 : 1;
    })
    .slice(0, 20);
}

function assetMap(assets: readonly AssetView[]): Map<bigint, AssetView> {
  return new Map(assets.map((asset) => [asset.tokenId, asset]));
}

export function LiveTicker({
  assets,
  events,
}: {
  assets: AssetView[];
  events: TradeEvent[];
}) {
  const byTokenId = assetMap(assets);
  const recent = recentEvents(eventsForAssets(events, assets));
  const tape = recent.length === 0 ? ["No on-chain activity yet"] : recent.map((event) => eventSentence(event, byTokenId.get(event.tokenId)));
  const repeated = [...tape, ...tape];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur">
      <div className="flex h-10 items-center overflow-hidden font-mono text-[10px] uppercase tracking-[0.16em]">
        <div className="flex h-full shrink-0 items-center border-r border-border bg-neon/10 px-4 text-neon">
          LIVE
        </div>
        <div className="hadron-live-track flex min-w-max items-center gap-6 px-4">
          {repeated.map((item, index) => {
            const event = recent[index % Math.max(recent.length, 1)];

            return (
              <span
                className={event ? eventToneClassName(event.type) : "text-muted"}
                key={`${item}:${index}`}
              >
                {item}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
