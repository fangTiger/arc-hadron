"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import type { TradeEvent } from "@/lib/events";
import { formatShares, formatUsdc } from "@/lib/format";
import { useMarketEvents } from "@/lib/hooks/useMarketEvents";
import type { Issuer } from "@/lib/issuers";
import {
  eventExplorerUrl,
  eventToneClassName,
  relativeTime,
} from "@/lib/marketMetrics";
import type { AssetView } from "@/lib/mappers";

interface IssuerActivityInput {
  assets: readonly AssetView[];
  events: readonly TradeEvent[];
  issuer: Pick<Issuer, "assetIds">;
  limit?: number;
}

function sortRecent(events: readonly TradeEvent[]): TradeEvent[] {
  return [...events].sort((a, b) => {
    if (a.blockNumber === b.blockNumber) {
      return b.logIndex - a.logIndex;
    }

    return a.blockNumber > b.blockNumber ? -1 : 1;
  });
}

export function issuerActivityEvents({
  assets,
  events,
  issuer,
  limit = 12,
}: IssuerActivityInput): TradeEvent[] {
  const issuerAssetSlugs = new Set(issuer.assetIds);
  const issuerTokenIds = new Set(
    assets
      .filter((asset) => issuerAssetSlugs.has(asset.meta.slug))
      .map((asset) => asset.tokenId),
  );

  return sortRecent(events.filter((event) => issuerTokenIds.has(event.tokenId))).slice(0, limit);
}

function eventTypeLabel(type: TradeEvent["type"]): string {
  const labels: Record<TradeEvent["type"], string> = {
    "asset-issued": "ASSET ISSUED",
    "bid-cancelled": "BID CANCEL",
    "bid-filled": "BID FILL",
    "bid-placed": "BID",
    cancelled: "CANCELLED",
    listed: "LISTED",
    "offering-closed": "OFFERING CLOSED",
    "offering-created": "OFFERING CREATED",
    "primary-sale": "PRIMARY SALE",
    purchased: "PURCHASED",
    "yield-claimed": "CLAIM",
    "yield-deposited": "YIELD",
  };

  return labels[type];
}

function eventAmount(event: TradeEvent): string {
  if (event.type === "yield-deposited" || event.type === "yield-claimed") {
    return `${formatUsdc(event.yieldAmount ?? 0n)} USDC`;
  }

  return event.amount === undefined ? "-" : formatShares(event.amount);
}

function assetMap(assets: readonly AssetView[]): Map<bigint, AssetView> {
  return new Map(assets.map((asset) => [asset.tokenId, asset]));
}

function ActivitySkeletonRows() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 4 }, (_, index) => (
        <li className="px-4 py-3" key={index}>
          <Skeleton className="h-4 w-full max-w-64" tone="soft" />
          <Skeleton className="mt-2 h-3 w-28" tone="soft" />
        </li>
      ))}
    </ul>
  );
}

export function IssuerActivityListView({
  assets,
  events,
  isLoading,
  issuer,
  nowMs,
}: {
  assets: AssetView[];
  events: TradeEvent[];
  isLoading: boolean;
  issuer: Pick<Issuer, "assetIds">;
  nowMs: number;
}) {
  const byTokenId = assetMap(assets);
  const recent = issuerActivityEvents({ assets, events, issuer });

  return (
    <section className="border border-border bg-panel/85">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
          RECENT ACTIVITY
        </h2>
      </div>

      {isLoading ? <ActivitySkeletonRows /> : null}
      {!isLoading && recent.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted">No recent activity for this issuer.</p>
      ) : null}
      {!isLoading && recent.length > 0 ? (
        <ul className="divide-y divide-border">
          {recent.map((event) => {
            const asset = byTokenId.get(event.tokenId);

            return (
              <li
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 transition-colors duration-200 hover:bg-border/20"
                key={`${event.txHash}:${event.logIndex}`}
              >
                <div className="min-w-0">
                  <p
                    className={[
                      "truncate font-mono text-[11px] uppercase tracking-[0.12em]",
                      eventToneClassName(event.type),
                    ].join(" ")}
                  >
                    {eventTypeLabel(event.type)} / {asset?.meta.ticker ?? `#${event.tokenId.toString()}`}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    {eventAmount(event)} / {relativeTime(event.timestamp, nowMs)}
                  </p>
                </div>
                <a
                  aria-label={`Open transaction ${event.txHash}`}
                  className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-neon-dim underline-offset-4 transition-colors duration-200 hover:text-neon hover:underline"
                  href={eventExplorerUrl(event.txHash)}
                  rel="noreferrer"
                  target="_blank"
                >
                  TX
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

export function IssuerActivityList({
  assets,
  issuer,
}: {
  assets: AssetView[];
  issuer: Pick<Issuer, "assetIds">;
}) {
  const { events, isLoading, nowMs } = useMarketEvents();

  return (
    <IssuerActivityListView
      assets={assets}
      events={events}
      isLoading={isLoading}
      issuer={issuer}
      nowMs={nowMs}
    />
  );
}
