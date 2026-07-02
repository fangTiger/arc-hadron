"use client";

import type { TradeEvent } from "@/lib/events";
import {
  eventExplorerUrl,
  eventSentence,
  eventToneClassName,
  relativeTime,
} from "@/lib/marketMetrics";
import type { AssetView } from "@/lib/mappers";

function sortRecent(events: readonly TradeEvent[]): TradeEvent[] {
  return [...events].sort((a, b) => {
    if (a.blockNumber === b.blockNumber) {
      return b.logIndex - a.logIndex;
    }

    return a.blockNumber > b.blockNumber ? -1 : 1;
  });
}

function assetMap(assets: readonly AssetView[]): Map<bigint, AssetView> {
  return new Map(assets.map((asset) => [asset.tokenId, asset]));
}

function ExternalLinkIcon() {
  return (
    <svg aria-hidden="true" className="size-3" fill="none" viewBox="0 0 12 12">
      <path d="M4.25 2.25H9.75V7.75" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
      <path d="M9.25 2.75L3 9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
    </svg>
  );
}

export function ActivityPanel({
  assets,
  events,
  limit = 12,
  nowMs = 0,
}: {
  assets: AssetView[];
  events: TradeEvent[];
  limit?: number;
  nowMs?: number;
}) {
  const byTokenId = assetMap(assets);
  const recent = sortRecent(events).slice(0, limit);

  return (
    <aside className="border border-border bg-panel/85 lg:sticky lg:top-24">
      <div className="border-b border-border px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">ACTIVITY</p>
      </div>

      {recent.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted">No on-chain activity yet</p>
      ) : (
        <ul className="divide-y divide-border">
          {recent.map((event) => {
            const asset = byTokenId.get(event.tokenId);

            return (
              <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3" key={`${event.txHash}:${event.logIndex}`}>
                <div className="min-w-0">
                  <p className={["truncate font-mono text-[11px] uppercase tracking-[0.12em]", eventToneClassName(event.type)].join(" ")}>
                    {eventSentence(event, asset)}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    {relativeTime(event.timestamp, nowMs)}
                  </p>
                </div>
                <a
                  aria-label={`Open transaction ${event.txHash}`}
                  className="mt-0.5 text-muted transition-colors hover:text-neon"
                  href={eventExplorerUrl(event.txHash)}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLinkIcon />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
