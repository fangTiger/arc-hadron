export interface BidView {
  id: bigint;
  bidder: `0x${string}`;
  tokenId: bigint;
  pricePerShare: bigint;
  remaining: bigint;
  active: boolean;
  isOwn: boolean;
}

interface RawBidObject {
  bidder?: unknown;
  tokenId?: unknown;
  pricePerShare?: unknown;
  remaining?: unknown;
  active?: unknown;
  [index: number]: unknown;
}

interface MapBidResultsInput {
  ids: readonly bigint[];
  results: readonly unknown[];
  currentAddress?: `0x${string}`;
}

interface NormalizedBid {
  bidder: `0x${string}`;
  tokenId: bigint;
  pricePerShare: bigint;
  remaining: bigint;
  active: boolean;
}

function normalizeBid(raw: unknown): NormalizedBid {
  const bid = raw as RawBidObject;

  return {
    bidder: (bid.bidder ?? bid[0]) as `0x${string}`,
    tokenId: (bid.tokenId ?? bid[1]) as bigint,
    pricePerShare: (bid.pricePerShare ?? bid[2]) as bigint,
    remaining: (bid.remaining ?? bid[3]) as bigint,
    active: (bid.active ?? bid[4]) as boolean,
  };
}

function isSameAddress(a?: `0x${string}`, b?: `0x${string}`): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function compareBidViews(a: BidView, b: BidView): number {
  if (a.pricePerShare !== b.pricePerShare) {
    return a.pricePerShare > b.pricePerShare ? -1 : 1;
  }

  if (a.id === b.id) {
    return 0;
  }

  return a.id < b.id ? -1 : 1;
}

export function mapBidResults({
  currentAddress,
  ids,
  results,
}: MapBidResultsInput): BidView[] {
  return results
    .flatMap((result, index): BidView[] => {
      const id = ids[index];

      if (id === undefined) {
        return [];
      }

      const bid = normalizeBid(result);

      if (!bid.active || bid.remaining === 0n) {
        return [];
      }

      return [
        {
          active: bid.active,
          bidder: bid.bidder,
          id,
          isOwn: isSameAddress(bid.bidder, currentAddress),
          pricePerShare: bid.pricePerShare,
          remaining: bid.remaining,
          tokenId: bid.tokenId,
        },
      ];
    })
    .sort(compareBidViews);
}
