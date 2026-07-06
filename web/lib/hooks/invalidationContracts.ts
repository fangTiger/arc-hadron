import {
  HADRON_ASSETS_ADDRESS,
  HADRON_MARKET_ADDRESS,
  HADRON_YIELD_ADDRESS,
} from "@/lib/contracts";
import {
  matchesAll,
  matchesContract,
  matchesFunctionName,
  type QueryPredicate,
} from "./invalidationPredicates";

export const LISTING_FUNCTIONS = matchesFunctionName([
  "listingCount",
  "listingsByToken",
  "getListing",
]);
export const BID_FUNCTIONS = matchesFunctionName([
  "bidCount",
  "bidsByToken",
  "getBid",
]);
export const YIELD_FUNCTIONS = matchesFunctionName(["pendingYield"]);
export const ASSETS_FUNCTIONS = matchesFunctionName([
  "balanceOf",
  "getAsset",
  "assetCount",
  "offeringCount",
]);

export const MARKET_CONTRACT = matchesContract(HADRON_MARKET_ADDRESS);
export const ASSETS_CONTRACT = matchesContract(HADRON_ASSETS_ADDRESS);
export const YIELD_CONTRACT = matchesContract(HADRON_YIELD_ADDRESS);

export function listingsPredicates(): QueryPredicate[] {
  return [matchesAll(MARKET_CONTRACT, LISTING_FUNCTIONS)];
}

export function bidsPredicates(): QueryPredicate[] {
  return [matchesAll(MARKET_CONTRACT, BID_FUNCTIONS)];
}

export function assetsPredicates(): QueryPredicate[] {
  return [matchesAll(ASSETS_CONTRACT, ASSETS_FUNCTIONS)];
}

export function yieldPredicates(): QueryPredicate[] {
  return [matchesAll(YIELD_CONTRACT, YIELD_FUNCTIONS)];
}
