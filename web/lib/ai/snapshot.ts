import { buildPriceSeries, compute24h, type TradeEvent } from "@/lib/events";
import { formatUsdc } from "@/lib/format";
import type { ListingView } from "@/lib/listing";
import type { AssetView } from "@/lib/mappers";
import { unitPriceToSharePrice } from "@/lib/shares";

export const SNAPSHOT_SCHEMA_VERSION = "hadron-ai-snapshot-v1";

const ORDER_BOOK_LIMIT = 10;
const RECENT_TRADES_LIMIT = 20;
const TRADE_TYPES = new Set<TradeEvent["type"]>(["primary-sale", "purchased"]);

export interface SnapshotAssetInput {
  asset: AssetView;
  events: readonly TradeEvent[];
  listings: readonly ListingView[];
  nowMs: number;
}

export interface SnapshotMarketInput {
  assets: readonly AssetView[];
  events: readonly TradeEvent[];
  listings: readonly ListingView[];
  nowMs: number;
}

export interface SnapshotOffering {
  id: string;
  active: boolean;
  remaining: string;
  sharePrice: string;
}

export interface SnapshotOrderBookEntry {
  id: string;
  remaining: string;
  sharePrice: string;
}

export interface SnapshotTrade {
  amount: string | null;
  blockNumber: string;
  buyer: string | null;
  logIndex: number;
  seller: string | null;
  sharePrice: string | null;
  timestamp: number | null;
  tokenId: string;
  totalPaid: string | null;
  txHash: string;
  type: TradeEvent["type"];
}

export interface SnapshotPricePoint {
  t: number;
  sharePrice: string;
}

export interface SnapshotAssetCore {
  tokenId: string;
  name: string;
  category: string;
  ticker: string;
  displayName: string;
  issuer: string;
  apyBps: number | null;
  totalShares: string;
  offering: SnapshotOffering | null;
  latestSharePrice: string;
  change24hPct: number;
  volume24h: string;
}

export interface AssetSnapshot {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  kind: "asset";
  asset: SnapshotAssetCore & {
    description: string;
    slug: string;
  };
  orderBook: SnapshotOrderBookEntry[];
  priceSeries: SnapshotPricePoint[];
  recentTrades: SnapshotTrade[];
}

export interface MarketSnapshot {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  kind: "market";
  summary: {
    assetCount: number;
    total24hVolume: string;
  };
  assets: Array<SnapshotAssetCore & { orderBook: SnapshotOrderBookEntry[] }>;
  recentTrades: SnapshotTrade[];
}

function sharePriceText(pricePerUnit: bigint): string {
  return formatUsdc(unitPriceToSharePrice(pricePerUnit));
}

function usdcText(value: bigint): string {
  return formatUsdc(value);
}

function isTradeEvent(event: TradeEvent): boolean {
  return TRADE_TYPES.has(event.type) && event.pricePerShare !== undefined;
}

function eventSortValue(event: TradeEvent): number {
  return event.timestamp ?? Number(event.blockNumber);
}

function compareEventsDesc(a: TradeEvent, b: TradeEvent): number {
  const aValue = eventSortValue(a);
  const bValue = eventSortValue(b);

  if (aValue !== bValue) {
    return bValue - aValue;
  }

  if (a.blockNumber !== b.blockNumber) {
    return a.blockNumber > b.blockNumber ? -1 : 1;
  }

  return b.logIndex - a.logIndex;
}

function compareListingsAsc(a: ListingView, b: ListingView): number {
  if (a.pricePerShare !== b.pricePerShare) {
    return a.pricePerShare < b.pricePerShare ? -1 : 1;
  }

  if (a.id === b.id) {
    return 0;
  }

  return a.id < b.id ? -1 : 1;
}

function fallbackPrice(asset: AssetView): bigint {
  return asset.offering?.pricePerShare ?? 0n;
}

function tradesForToken(events: readonly TradeEvent[], tokenId: bigint): TradeEvent[] {
  return events.filter((event) => event.tokenId === tokenId && isTradeEvent(event));
}

function latestUnitPrice(asset: AssetView, events: readonly TradeEvent[]): bigint {
  const latestTrade = [...tradesForToken(events, asset.tokenId)].sort(compareEventsDesc)[0];

  return latestTrade?.pricePerShare ?? fallbackPrice(asset);
}

function snapshotOffering(asset: AssetView): SnapshotOffering | null {
  const offering = asset.offering;

  if (!offering) {
    return null;
  }

  return {
    id: offering.id.toString(),
    active: offering.active,
    remaining: offering.remaining.toString(),
    sharePrice: sharePriceText(offering.pricePerShare),
  };
}

function buildOrderBook(
  listings: readonly ListingView[],
  tokenId: bigint,
): SnapshotOrderBookEntry[] {
  return listings
    .filter((listing) => listing.tokenId === tokenId && listing.remaining > 0n)
    .sort(compareListingsAsc)
    .slice(0, ORDER_BOOK_LIMIT)
    .map((listing) => ({
      id: listing.id.toString(),
      remaining: listing.remaining.toString(),
      sharePrice: sharePriceText(listing.pricePerShare),
    }));
}

function buildRecentTrades(
  events: readonly TradeEvent[],
  tokenIds?: ReadonlySet<bigint>,
): SnapshotTrade[] {
  return events
    .filter((event) => isTradeEvent(event) && (!tokenIds || tokenIds.has(event.tokenId)))
    .sort(compareEventsDesc)
    .slice(0, RECENT_TRADES_LIMIT)
    .map((event) => ({
      amount: event.amount?.toString() ?? null,
      blockNumber: event.blockNumber.toString(),
      buyer: event.buyer ?? null,
      logIndex: event.logIndex,
      seller: event.seller ?? null,
      sharePrice:
        event.pricePerShare === undefined ? null : sharePriceText(event.pricePerShare),
      timestamp: event.timestamp ?? null,
      tokenId: event.tokenId.toString(),
      totalPaid: event.totalPaid === undefined ? null : usdcText(event.totalPaid),
      txHash: event.txHash,
      type: event.type,
    }));
}

function buildPricePoints(
  asset: AssetView,
  events: readonly TradeEvent[],
): SnapshotPricePoint[] {
  return buildPriceSeries(events, asset.tokenId, fallbackPrice(asset)).map((point) => ({
    t: point.t,
    sharePrice: sharePriceText(point.price),
  }));
}

function buildAssetCore(
  asset: AssetView,
  events: readonly TradeEvent[],
  nowMs: number,
): SnapshotAssetCore {
  const stats = compute24h(events, asset.tokenId, fallbackPrice(asset), nowMs);

  return {
    tokenId: asset.tokenId.toString(),
    name: asset.name,
    category: asset.category,
    ticker: asset.meta.ticker,
    displayName: asset.meta.displayName,
    issuer: asset.meta.issuer,
    apyBps: asset.meta.apyBps,
    totalShares: asset.totalShares.toString(),
    offering: snapshotOffering(asset),
    latestSharePrice: sharePriceText(latestUnitPrice(asset, events)),
    change24hPct: stats.changePct,
    volume24h: usdcText(stats.volume),
  };
}

export function buildAssetSnapshot({
  asset,
  events,
  listings,
  nowMs,
}: SnapshotAssetInput): AssetSnapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    kind: "asset",
    asset: {
      ...buildAssetCore(asset, events, nowMs),
      description: asset.meta.description,
      slug: asset.meta.slug,
    },
    orderBook: buildOrderBook(listings, asset.tokenId),
    priceSeries: buildPricePoints(asset, events),
    recentTrades: buildRecentTrades(events, new Set([asset.tokenId])),
  };
}

export function buildMarketSnapshot({
  assets,
  events,
  listings,
  nowMs,
}: SnapshotMarketInput): MarketSnapshot {
  const tokenIds = new Set(assets.map((asset) => asset.tokenId));
  const total24hVolume = assets.reduce((sum, asset) => {
    return sum + compute24h(events, asset.tokenId, fallbackPrice(asset), nowMs).volume;
  }, 0n);

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    kind: "market",
    summary: {
      assetCount: assets.length,
      total24hVolume: usdcText(total24hVolume),
    },
    assets: assets.map((asset) => ({
      ...buildAssetCore(asset, events, nowMs),
      orderBook: buildOrderBook(listings, asset.tokenId),
    })),
    recentTrades: buildRecentTrades(events, tokenIds),
  };
}
