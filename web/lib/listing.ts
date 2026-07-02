import { parseUsdc } from "@/lib/format";
import {
  validatePurchase,
  type PurchaseValidationResult,
  type ValidatePurchaseInput,
} from "@/lib/purchase";

export interface ListingView {
  id: bigint;
  seller: `0x${string}`;
  tokenId: bigint;
  pricePerShare: bigint;
  remaining: bigint;
  isMine: boolean;
}

interface ValidateListingInput {
  amountInput: string;
  priceInput: string;
  balance: bigint;
}

interface RawListingObject {
  seller?: unknown;
  tokenId?: unknown;
  pricePerShare?: unknown;
  remaining?: unknown;
  active?: unknown;
  [index: number]: unknown;
}

interface MapListingResultsInput {
  ids: readonly bigint[];
  results: readonly unknown[];
  currentAddress?: `0x${string}`;
}

interface NormalizedListing {
  seller: `0x${string}`;
  tokenId: bigint;
  pricePerShare: bigint;
  remaining: bigint;
  active: boolean;
}

export function validateListing({
  amountInput,
  balance,
  priceInput,
}: ValidateListingInput):
  | { ok: true; amount: bigint; pricePerShare: bigint }
  | { ok: false; errorText: string } {
  const normalizedAmount = amountInput.trim();

  if (!/^\d+$/.test(normalizedAmount)) {
    return { ok: false, errorText: "Enter a valid amount" };
  }

  const amount = BigInt(normalizedAmount);

  if (amount === 0n) {
    return { ok: false, errorText: "Enter a valid amount" };
  }

  if (amount > balance) {
    return { ok: false, errorText: "Exceeds your balance" };
  }

  let pricePerShare: bigint;

  try {
    pricePerShare = parseUsdc(priceInput);
  } catch {
    return { ok: false, errorText: "Enter a valid price" };
  }

  if (pricePerShare === 0n) {
    return { ok: false, errorText: "Enter a valid price" };
  }

  return { ok: true, amount, pricePerShare };
}

export function validateListingPurchase(input: ValidatePurchaseInput): PurchaseValidationResult {
  return validatePurchase(input);
}

function normalizeListing(raw: unknown): NormalizedListing {
  const listing = raw as RawListingObject;

  return {
    seller: (listing.seller ?? listing[0]) as `0x${string}`,
    tokenId: (listing.tokenId ?? listing[1]) as bigint,
    pricePerShare: (listing.pricePerShare ?? listing[2]) as bigint,
    remaining: (listing.remaining ?? listing[3]) as bigint,
    active: (listing.active ?? listing[4]) as boolean,
  };
}

function isSameAddress(a?: `0x${string}`, b?: `0x${string}`): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function compareListingViews(a: ListingView, b: ListingView): number {
  if (a.pricePerShare !== b.pricePerShare) {
    return a.pricePerShare < b.pricePerShare ? -1 : 1;
  }

  if (a.id === b.id) {
    return 0;
  }

  return a.id < b.id ? -1 : 1;
}

export function mapListingResults({
  currentAddress,
  ids,
  results,
}: MapListingResultsInput): ListingView[] {
  return results
    .flatMap((result, index): ListingView[] => {
      const id = ids[index];

      if (id === undefined) {
        return [];
      }

      const listing = normalizeListing(result);

      if (!listing.active || listing.remaining === 0n) {
        return [];
      }

      return [
        {
          id,
          seller: listing.seller,
          tokenId: listing.tokenId,
          pricePerShare: listing.pricePerShare,
          remaining: listing.remaining,
          isMine: isSameAddress(listing.seller, currentAddress),
        },
      ];
    })
    .sort(compareListingViews);
}
