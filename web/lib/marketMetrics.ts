import { buildPriceSeries, compute24h, type PricePoint, type TradeEvent } from "@/lib/events";
import { formatShares, formatUsdc } from "@/lib/format";
import type { AssetView } from "@/lib/mappers";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TRADE_TYPES = new Set<TradeEvent["type"]>(["primary-sale", "purchased"]);

export function formatApyBps(apyBps: number | null): string {
  return apyBps === null ? "—" : `${(apyBps / 100).toFixed(2)}%`;
}

export function fallbackPriceForAsset(asset: AssetView): bigint {
  return asset.offering?.pricePerShare ?? 0n;
}

export function tradeEventsForAsset(events: readonly TradeEvent[], tokenId: bigint): TradeEvent[] {
  return events
    .filter(
      (event) =>
        event.tokenId === tokenId &&
        TRADE_TYPES.has(event.type) &&
        event.pricePerShare !== undefined,
    )
    .sort((a, b) => {
      const aTime = a.timestamp ?? Number(a.blockNumber);
      const bTime = b.timestamp ?? Number(b.blockNumber);

      if (aTime === bTime) {
        return a.logIndex - b.logIndex;
      }

      return aTime - bTime;
    });
}

export function latestPriceForAsset(asset: AssetView, events: readonly TradeEvent[]): bigint {
  const trades = tradeEventsForAsset(events, asset.tokenId);

  return trades.at(-1)?.pricePerShare ?? fallbackPriceForAsset(asset);
}

export function priceSeriesForAsset(asset: AssetView, events: readonly TradeEvent[]): PricePoint[] {
  return buildPriceSeries(events, asset.tokenId, fallbackPriceForAsset(asset));
}

export function assetChange24h(
  asset: AssetView,
  events: readonly TradeEvent[],
  nowMs: number,
): { changePct: number; volume: bigint } {
  return compute24h(events, asset.tokenId, fallbackPriceForAsset(asset), nowMs);
}

export function totalValueLocked(assets: readonly AssetView[], events: readonly TradeEvent[]): bigint {
  return assets.reduce((sum, asset) => sum + asset.totalShares * latestPriceForAsset(asset, events), 0n);
}

export function total24hVolume(events: readonly TradeEvent[], nowMs: number): bigint {
  const cutoff = nowMs - ONE_DAY_MS;

  return events.reduce((sum, event) => {
    if (
      TRADE_TYPES.has(event.type) &&
      event.timestamp !== undefined &&
      event.timestamp >= cutoff &&
      event.timestamp <= nowMs &&
      event.totalPaid !== undefined
    ) {
      return sum + event.totalPaid;
    }

    return sum;
  }, 0n);
}

export function averageApyBps(assets: readonly AssetView[]): number | null {
  const apys = assets
    .map((asset) => asset.meta.apyBps)
    .filter((value): value is number => value !== null);

  if (apys.length === 0) {
    return null;
  }

  return Math.floor(apys.reduce((sum, value) => sum + value, 0) / apys.length);
}

export function eventExplorerUrl(txHash: string): string {
  const explorerUrl = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "";
  const base = explorerUrl.trim().replace(/\/+$/, "");

  return `${base}/tx/${txHash}`;
}

export function relativeTime(timestamp: number | undefined, nowMs: number): string {
  if (timestamp === undefined) {
    return "pending";
  }

  const diff = Math.max(0, nowMs - timestamp);
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) {
    return "now";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h`;
  }

  return `${Math.floor(hours / 24)}d`;
}

export function eventSentence(event: TradeEvent, asset?: AssetView): string {
  const ticker = asset?.meta.ticker ?? `#${event.tokenId.toString()}`;
  const amount = event.amount === undefined ? "" : ` ${formatShares(event.amount)}`;
  const price = event.pricePerShare === undefined ? "" : ` @ ${formatUsdc(event.pricePerShare)}`;

  if (event.type === "primary-sale" || event.type === "purchased") {
    return `BUY${amount} ${ticker}${price}`;
  }

  if (event.type === "listed") {
    return `LIST${amount} ${ticker}${price}`;
  }

  if (event.type === "cancelled") {
    return `CANCEL${amount} ${ticker}`;
  }

  if (event.type === "offering-created") {
    return `OFFER${amount} ${ticker}${price}`;
  }

  return `ISSUE${amount} ${ticker}`;
}

export function eventToneClassName(type: TradeEvent["type"]): string {
  if (type === "primary-sale" || type === "purchased") {
    return "text-up";
  }

  if (type === "listed" || type === "offering-created") {
    return "text-neon-dim";
  }

  if (type === "cancelled") {
    return "text-muted";
  }

  return "text-gold";
}
