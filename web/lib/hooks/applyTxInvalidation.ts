import type { QueryClient } from "@tanstack/react-query";
import {
  assetsPredicates,
  bidsPredicates,
  listingsPredicates,
  yieldPredicates,
} from "./invalidationContracts";
import type { QueryPredicate } from "./invalidationPredicates";

export type TxIntent = "buy" | "sell" | "cancel" | "claim";

export const TX_INVALIDATION_PREDICATES: Record<TxIntent, () => QueryPredicate[]> = {
  buy: () => [
    ...listingsPredicates(),
    ...assetsPredicates(),
    ...yieldPredicates(),
  ],
  sell: () => [
    ...listingsPredicates(),
    ...assetsPredicates(),
  ],
  cancel: () => [
    ...listingsPredicates(),
    ...bidsPredicates(),
  ],
  claim: () => [
    ...yieldPredicates(),
  ],
};

export function applyTxInvalidation(queryClient: QueryClient, intent: TxIntent): void {
  const predicates = TX_INVALIDATION_PREDICATES[intent]();

  for (const predicate of predicates) {
    void queryClient.invalidateQueries({ predicate });
  }
}
