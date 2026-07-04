import { unitsFromSharesInput } from "@/lib/shares";

export interface PrimaryBuySource {
  active?: boolean;
  id: bigint;
  pricePerShare: bigint;
  remaining: bigint;
  tokenId: bigint;
}

export interface ListingBuySource {
  active?: boolean;
  id: bigint;
  pricePerShare: bigint;
  remaining: bigint;
  tokenId: bigint;
}

export type BuySource =
  | { type: "primary"; offeringId: bigint }
  | { type: "listing"; listingId: bigint };

export type ResolveBuyResult =
  | {
      kind: "fillable";
      source: BuySource;
      pricePerShare: bigint;
      requestedUnits: bigint;
      fillable: bigint;
      totalValue: bigint;
    }
  | {
      kind: "partial";
      source: BuySource;
      pricePerShare: bigint;
      requestedUnits: bigint;
      fillable: bigint;
      totalValue: bigint;
    }
  | {
      kind: "unavailable";
      requestedUnits: bigint;
      fillable: 0n;
    };

interface ResolveBuySources {
  primaryOffering?: PrimaryBuySource | null;
  listings: readonly ListingBuySource[];
}

interface CandidateSource {
  source: BuySource;
  pricePerShare: bigint;
  remaining: bigint;
  priority: number;
  tieId: bigint;
}

function displayQuantityToUnits(quantity: number): bigint {
  return unitsFromSharesInput(quantity.toString());
}

function compareCandidates(a: CandidateSource, b: CandidateSource): number {
  if (a.pricePerShare !== b.pricePerShare) {
    return a.pricePerShare < b.pricePerShare ? -1 : 1;
  }

  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }

  if (a.tieId === b.tieId) {
    return 0;
  }

  return a.tieId < b.tieId ? -1 : 1;
}

function activeCandidates(
  tokenId: bigint,
  { listings, primaryOffering }: ResolveBuySources,
): CandidateSource[] {
  const candidates: CandidateSource[] = [];

  if (
    primaryOffering &&
    primaryOffering.active !== false &&
    primaryOffering.tokenId === tokenId &&
    primaryOffering.remaining > 0n
  ) {
    candidates.push({
      source: { type: "primary", offeringId: primaryOffering.id },
      pricePerShare: primaryOffering.pricePerShare,
      remaining: primaryOffering.remaining,
      priority: 0,
      tieId: primaryOffering.id,
    });
  }

  for (const listing of listings) {
    if (listing.active === false || listing.tokenId !== tokenId || listing.remaining <= 0n) {
      continue;
    }

    candidates.push({
      source: { type: "listing", listingId: listing.id },
      pricePerShare: listing.pricePerShare,
      remaining: listing.remaining,
      priority: 1,
      tieId: listing.id,
    });
  }

  return candidates.sort(compareCandidates);
}

export function resolveBuy(
  tokenId: bigint,
  quantity: number,
  sources: ResolveBuySources,
): ResolveBuyResult {
  const requestedUnits = displayQuantityToUnits(quantity);
  const candidates = activeCandidates(tokenId, sources);

  if (candidates.length === 0) {
    return {
      kind: "unavailable",
      requestedUnits,
      fillable: 0n,
    };
  }

  const fillableCandidate = candidates.find((candidate) => candidate.remaining >= requestedUnits);

  if (fillableCandidate) {
    return {
      kind: "fillable",
      source: fillableCandidate.source,
      pricePerShare: fillableCandidate.pricePerShare,
      requestedUnits,
      fillable: requestedUnits,
      totalValue: requestedUnits * fillableCandidate.pricePerShare,
    };
  }

  const bestPartial = candidates[0];

  return {
    kind: "partial",
    source: bestPartial.source,
    pricePerShare: bestPartial.pricePerShare,
    requestedUnits,
    fillable: bestPartial.remaining,
    totalValue: bestPartial.remaining * bestPartial.pricePerShare,
  };
}
