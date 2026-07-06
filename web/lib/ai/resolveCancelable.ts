interface CancelableListingSource {
  active?: boolean;
  id: bigint;
  isMine?: boolean;
  pricePerShare: bigint;
  remaining: bigint;
  seller: `0x${string}`;
  tokenId: bigint;
}

interface CancelableBidSource {
  active?: boolean;
  bidder: `0x${string}`;
  id: bigint;
  isOwn?: boolean;
  pricePerShare: bigint;
  remaining: bigint;
  tokenId: bigint;
}

export type CancelableOrder =
  | { side: "listing"; id: bigint; price: bigint; size: bigint }
  | { side: "bid"; id: bigint; price: bigint; size: bigint };

interface ResolveCancelableSources {
  listings: readonly CancelableListingSource[];
  bids: readonly CancelableBidSource[];
}

function isSameAddress(a: `0x${string}`, b: `0x${string}`): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function resolveCancelableOrders(
  tokenId: bigint,
  address: `0x${string}`,
  { bids, listings }: ResolveCancelableSources,
): CancelableOrder[] {
  const listingOrders = listings
    .filter(
      (listing) =>
        listing.tokenId === tokenId &&
        listing.active !== false &&
        listing.remaining > 0n &&
        isSameAddress(listing.seller, address),
    )
    .map((listing): CancelableOrder => ({
      side: "listing",
      id: listing.id,
      price: listing.pricePerShare,
      size: listing.remaining,
    }));

  const bidOrders = bids
    .filter(
      (bid) =>
        bid.tokenId === tokenId &&
        bid.active !== false &&
        bid.remaining > 0n &&
        isSameAddress(bid.bidder, address),
    )
    .map((bid): CancelableOrder => ({
      side: "bid",
      id: bid.id,
      price: bid.pricePerShare,
      size: bid.remaining,
    }));

  return [...listingOrders, ...bidOrders];
}
