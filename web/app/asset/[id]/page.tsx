"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AssetProfile } from "@/components/asset/AssetProfile";
import { BuyPanel } from "@/components/asset/BuyPanel";
import { ListingsTable } from "@/components/asset/ListingsTable";
import { PriceChart } from "@/components/asset/PriceChart";
import { glowButtonClassName } from "@/components/ui/GlowButton";
import { Skeleton } from "@/components/ui/Skeleton";
import type { TradeEvent } from "@/lib/events";
import { formatShares, formatUsdc, shortAddress } from "@/lib/format";
import { useAssets } from "@/lib/hooks/useAssets";
import { useMarketEvents } from "@/lib/hooks/useMarketEvents";
import {
  addressExplorerUrl,
  assetChange24h,
  eventExplorerUrl,
  formatApyBps,
  latestPriceForAsset,
  relativeTime,
} from "@/lib/marketMetrics";
import type { AssetView } from "@/lib/mappers";
import { unitPriceToSharePrice } from "@/lib/shares";

function AssetDetailSkeleton() {
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:px-8">
      <div className="space-y-8">
        <Skeleton className="h-[560px]" />
        <Skeleton className="h-[240px]" />
        <Skeleton className="h-[240px]" tone="soft" />
      </div>
      <aside className="lg:sticky lg:top-24">
        <Skeleton className="h-[420px]" tone="soft" />
        <p className="sr-only">REMAINING SHARES</p>
      </aside>
    </main>
  );
}

function EmptyAssetState() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center px-4 py-16 text-center sm:px-6">
      <section className="w-full border border-border bg-panel p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-down">ASSET NOT FOUND</p>
        <h1 className="mt-4 text-2xl font-semibold text-text">Asset not found</h1>
        <p className="mt-3 text-sm leading-6 text-text-dim">
          Return to the market and select an asset from the on-chain catalog.
        </p>
        <Link className={glowButtonClassName({ className: "mt-8" })} href="/">
          Back to market
        </Link>
      </section>
    </main>
  );
}

function AssetReadErrorState({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center px-4 py-16 text-center sm:px-6">
      <section className="w-full border border-down/70 bg-down/10 p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-down">CHAIN READ FAILED</p>
        <h1 className="mt-4 text-2xl font-semibold text-text">Failed to load asset</h1>
        <p className="mt-3 text-sm leading-6 text-text-dim">{message}</p>
        <Link className={glowButtonClassName({ className: "mt-8" })} href="/">
          Back to market
        </Link>
      </section>
    </main>
  );
}

function changeClassName(changePct: number): string {
  if (changePct > 0) {
    return "border-up/40 bg-up/10 text-up";
  }

  if (changePct < 0) {
    return "border-down/40 bg-down/10 text-down";
  }

  return "border-border bg-bg/60 text-muted";
}

function AssetPriceHeader({
  asset,
  events,
  nowMs,
}: {
  asset: AssetView;
  events: TradeEvent[];
  nowMs: number;
}) {
  const price = latestPriceForAsset(asset, events);
  const change = assetChange24h(asset, events, nowMs);
  const available = asset.offering?.remaining ?? 0n;
  const marketCap = asset.totalShares * price;

  return (
    <section className="border border-border bg-panel p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
            {asset.meta.ticker} / TOKEN #{asset.tokenId.toString()}
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-text sm:text-3xl">
            {asset.meta.displayName}
          </h1>
        </div>
        <span
          className={[
            "w-fit border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em]",
            changeClassName(change.changePct),
          ].join(" ")}
        >
          24H {change.changePct.toFixed(2)}%
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-2">
        <p className="font-mono text-5xl font-semibold leading-none text-text sm:text-6xl">
          {formatUsdc(unitPriceToSharePrice(price))}
        </p>
        <p className="pb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          USDC / SHARE
        </p>
      </div>

      <dl className="mt-6 grid gap-3 border-t border-border pt-5 font-mono text-[10px] uppercase tracking-[0.16em] sm:grid-cols-4">
        <div>
          <dt className="text-muted">YIELD</dt>
          <dd className="mt-2 text-sm text-gold">{formatApyBps(asset.meta.apyBps)}</dd>
        </div>
        <div>
          <dt className="text-muted">AVAILABLE</dt>
          <dd className="mt-2 text-sm text-text">{formatShares(available)}</dd>
        </div>
        <div>
          <dt className="text-muted">MARKET CAP</dt>
          <dd className="mt-2 text-sm text-text">{formatUsdc(marketCap, { compact: true })}</dd>
        </div>
        <div>
          <dt className="text-muted">TOTAL SHARES</dt>
          <dd className="mt-2 text-sm text-text">{formatShares(asset.totalShares)}</dd>
        </div>
      </dl>
    </section>
  );
}

function eventTypeLabel(type: TradeEvent["type"]): string {
  const labels: Record<TradeEvent["type"], string> = {
    "asset-issued": "ASSET ISSUED",
    cancelled: "CANCELLED",
    listed: "LISTED",
    "offering-closed": "OFFERING CLOSED",
    "offering-created": "OFFERING CREATED",
    "primary-sale": "PRIMARY SALE",
    purchased: "PURCHASED",
  };

  return labels[type];
}

function eventCounterparties(event: TradeEvent): Array<{ address: `0x${string}`; label: string }> {
  const counterparties: Array<{ address: `0x${string}`; label: string }> = [];

  if (event.buyer) {
    counterparties.push({ address: event.buyer, label: "BUYER" });
  }

  if (event.seller) {
    counterparties.push({ address: event.seller, label: "SELLER" });
  }

  return counterparties;
}

function CounterpartyCell({ event }: { event: TradeEvent }) {
  const counterparties = eventCounterparties(event);

  if (counterparties.length === 0) {
    return <span className="font-mono text-sm text-muted">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {counterparties.map((counterparty) => (
        <a
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-neon-dim underline-offset-4 hover:text-neon hover:underline"
          href={addressExplorerUrl(counterparty.address)}
          key={`${event.txHash}:${event.logIndex}:${counterparty.label}`}
          rel="noreferrer"
          target="_blank"
        >
          {counterparty.label} {shortAddress(counterparty.address)}
        </a>
      ))}
    </div>
  );
}

function TradeHistoryTable({
  asset,
  events,
  isLoading,
  nowMs,
}: {
  asset: AssetView;
  events: TradeEvent[];
  isLoading: boolean;
  nowMs: number;
}) {
  const rows = events
    .filter((event) => event.tokenId === asset.tokenId)
    .sort((a, b) => {
      if (a.blockNumber === b.blockNumber) {
        return b.logIndex - a.logIndex;
      }

      return a.blockNumber > b.blockNumber ? -1 : 1;
    });

  return (
    <section className="overflow-hidden border border-border bg-panel">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-text">TRADE HISTORY</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full border-collapse">
          <thead className="border-b border-border bg-bg/70">
            <tr>
              {["TIME", "TYPE", "QTY", "PRICE", "COUNTERPARTY", "TX"].map((label) => (
                <th
                  className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted"
                  key={label}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-5 py-6" colSpan={5}>
                  <Skeleton className="h-5 w-full max-w-lg" />
                </td>
              </tr>
            ) : null}
            {!isLoading && rows.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-sm text-muted" colSpan={6}>
                  Trade history lands here after on-chain activity.
                </td>
              </tr>
            ) : null}
            {!isLoading
              ? rows.map((event) => (
                  <tr className="border-b border-border/80 last:border-b-0" key={`${event.txHash}:${event.logIndex}`}>
                    <td className="px-5 py-4 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                      {relativeTime(event.timestamp, nowMs)}
                    </td>
                    <td className="px-5 py-4 font-mono text-[11px] uppercase tracking-[0.12em] text-text">
                      {eventTypeLabel(event.type)}
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-text-dim">
                      {event.amount === undefined ? "—" : formatShares(event.amount)}
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-text">
                      {event.pricePerShare === undefined
                        ? "—"
                        : formatUsdc(unitPriceToSharePrice(event.pricePerShare))}
                    </td>
                    <td className="px-5 py-4">
                      <CounterpartyCell event={event} />
                    </td>
                    <td className="px-5 py-4">
                      <a
                        className="font-mono text-[11px] uppercase tracking-[0.16em] text-neon-dim underline-offset-4 hover:text-neon hover:underline"
                        href={eventExplorerUrl(event.txHash)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {shortAddress(event.txHash)}
                      </a>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AssetDetailView({
  assets,
  errorZh,
  events = [],
  id,
  isEventsLoading = false,
  isLoading,
  nowMs = 0,
}: {
  assets: AssetView[];
  errorZh?: string;
  events?: TradeEvent[];
  id: string;
  isEventsLoading?: boolean;
  isLoading: boolean;
  nowMs?: number;
}) {
  const isNumericId = /^\d+$/.test(id);
  const asset = assets.find((item) => item.tokenId.toString() === id);

  if (!isNumericId) {
    return <EmptyAssetState />;
  }

  if (!asset) {
    if (errorZh) {
      return <AssetReadErrorState message={errorZh} />;
    }

    if (isLoading) {
      return <AssetDetailSkeleton />;
    }

    return <EmptyAssetState />;
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:px-8">
      <div className="space-y-8">
        <AssetPriceHeader asset={asset} events={events} nowMs={nowMs} />
        <PriceChart asset={asset} events={events} />
        <AssetProfile asset={asset} />
        <ListingsTable tokenId={asset.tokenId} />
        <TradeHistoryTable
          asset={asset}
          events={events}
          isLoading={isEventsLoading}
          nowMs={nowMs}
        />
      </div>

      <div className="lg:sticky lg:top-24">
        <BuyPanel asset={asset} />
      </div>
    </main>
  );
}

export default function AssetDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { assets, errorZh, isLoading } = useAssets();
  const { events, isLoading: isEventsLoading, nowMs } = useMarketEvents();

  return (
    <AssetDetailView
      assets={assets}
      errorZh={errorZh}
      events={events}
      id={id}
      isEventsLoading={isEventsLoading}
      isLoading={isLoading}
      nowMs={nowMs}
    />
  );
}
