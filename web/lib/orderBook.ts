import type { BidView } from "@/lib/bids";
import type { ListingView } from "@/lib/listing";

export interface OrderBookLevel {
  price: bigint;
  size: bigint;
  cum: bigint;
  count: number;
  isOwn: boolean;
}

export interface OrderBook {
  asks: OrderBookLevel[];
  bids: OrderBookLevel[];
  bestAsk: bigint | null;
  bestBid: bigint | null;
  mid: bigint | null;
  spread: bigint | null;
  spreadPct: number | null;
  maxCumulative: bigint;
}

export interface DepthPoint {
  price: bigint;
  cum: bigint;
}

interface BuildOrderBookInput {
  bids: BidView[];
  listings: ListingView[];
}

interface GroupedLevel {
  price: bigint;
  size: bigint;
  count: number;
  isOwn: boolean;
}

function compareAscending(a: GroupedLevel, b: GroupedLevel): number {
  if (a.price === b.price) {
    return 0;
  }

  return a.price < b.price ? -1 : 1;
}

function compareDescending(a: GroupedLevel, b: GroupedLevel): number {
  if (a.price === b.price) {
    return 0;
  }

  return a.price > b.price ? -1 : 1;
}

function withCumulative(levels: GroupedLevel[]): OrderBookLevel[] {
  let cumulative = 0n;

  return levels.map((level) => {
    cumulative += level.size;

    return {
      ...level,
      cum: cumulative,
    };
  });
}

function groupByPrice<TOrder>(
  orders: TOrder[],
  getPrice: (order: TOrder) => bigint,
  getSize: (order: TOrder) => bigint,
  getIsOwn: (order: TOrder) => boolean,
): GroupedLevel[] {
  const grouped = new Map<bigint, GroupedLevel>();

  for (const order of orders) {
    const price = getPrice(order);
    const current = grouped.get(price);

    if (current) {
      current.size += getSize(order);
      current.count += 1;
      current.isOwn = current.isOwn || getIsOwn(order);
      continue;
    }

    grouped.set(price, {
      count: 1,
      isOwn: getIsOwn(order),
      price,
      size: getSize(order),
    });
  }

  return [...grouped.values()];
}

function lastCumulative(levels: OrderBookLevel[]): bigint {
  return levels.at(-1)?.cum ?? 0n;
}

export function buildOrderBook({ bids, listings }: BuildOrderBookInput): OrderBook {
  const asks = withCumulative(
    groupByPrice(
      listings,
      (listing) => listing.pricePerShare,
      (listing) => listing.remaining,
      (listing) => listing.isMine,
    ).sort(compareAscending),
  );
  const bidLevels = withCumulative(
    groupByPrice(
      bids,
      (bid) => bid.pricePerShare,
      (bid) => bid.remaining,
      (bid) => bid.isOwn,
    ).sort(compareDescending),
  );
  const bestAsk = asks[0]?.price ?? null;
  const bestBid = bidLevels[0]?.price ?? null;
  const hasTwoSidedBook = bestAsk !== null && bestBid !== null;
  const mid = hasTwoSidedBook ? (bestAsk + bestBid) / 2n : null;
  const spread = hasTwoSidedBook ? bestAsk - bestBid : null;
  const spreadPct =
    spread !== null && mid !== null && mid !== 0n
      ? (Number(spread) / Number(mid)) * 100
      : null;
  const askCumulative = lastCumulative(asks);
  const bidCumulative = lastCumulative(bidLevels);

  return {
    asks,
    bestAsk,
    bestBid,
    bids: bidLevels,
    maxCumulative: askCumulative > bidCumulative ? askCumulative : bidCumulative,
    mid,
    spread,
    spreadPct,
  };
}

export function buildDepthSeries(book: OrderBook): { bids: DepthPoint[]; asks: DepthPoint[] } {
  return {
    asks: book.asks.map((level) => ({ cum: level.cum, price: level.price })),
    bids: book.bids.map((level) => ({ cum: level.cum, price: level.price })),
  };
}
