import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TradeEvent } from "@/lib/events";
import {
  assetsPredicates,
  bidsPredicates,
  listingsPredicates,
  yieldPredicates,
} from "./invalidationContracts";
import type { QueryPredicate } from "./invalidationPredicates";
import { useMarketEvents } from "./useMarketEvents";

type MarketEventType = TradeEvent["type"];

interface DispatchContext {
  me?: `0x${string}`;
}

type DispatchFn = (event: TradeEvent, ctx: DispatchContext) => QueryPredicate[];

export type EventInvalidationDispatchKey = MarketEventType;

function isSameAddress(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function involvedInPurchased(event: TradeEvent, me?: `0x${string}`): boolean {
  return event.type === "purchased" && (isSameAddress(event.seller, me) || isSameAddress(event.buyer, me));
}

function involvedInBidFilled(event: TradeEvent, me?: `0x${string}`): boolean {
  return event.type === "bid-filled" && (isSameAddress(event.seller, me) || isSameAddress(event.buyer, me));
}

export const EVENT_INVALIDATION_DISPATCH: Record<MarketEventType, DispatchFn> = {
  "asset-issued": () => assetsPredicates(),
  "bid-cancelled": () => bidsPredicates(),
  "bid-filled": (event, { me }) => {
    const predicates = bidsPredicates();

    if (involvedInBidFilled(event, me)) {
      predicates.push(...assetsPredicates());
    }

    return predicates;
  },
  "bid-placed": () => bidsPredicates(),
  cancelled: () => listingsPredicates(),
  listed: () => listingsPredicates(),
  "offering-closed": () => assetsPredicates(),
  "offering-created": () => assetsPredicates(),
  "primary-sale": () => assetsPredicates(),
  purchased: (event, { me }) => {
    const predicates = listingsPredicates();

    if (involvedInPurchased(event, me)) {
      predicates.push(...assetsPredicates());
    }

    return predicates;
  },
  "yield-claimed": () => yieldPredicates(),
  "yield-deposited": () => yieldPredicates(),
};

type EnsureExhaustive = keyof typeof EVENT_INVALIDATION_DISPATCH extends MarketEventType
  ? MarketEventType extends keyof typeof EVENT_INVALIDATION_DISPATCH
    ? true
    : never
  : never;
const _exhaustive: EnsureExhaustive = true;
void _exhaustive;

export function useEventDrivenInvalidation({ me }: { me?: `0x${string}` }): void {
  const queryClient = useQueryClient();
  const { newEvents } = useMarketEvents();

  useEffect(() => {
    if (newEvents.length === 0) {
      return;
    }

    for (const event of newEvents) {
      const predicates = EVENT_INVALIDATION_DISPATCH[event.type](event, { me });

      for (const predicate of predicates) {
        void queryClient.invalidateQueries({ predicate });
      }
    }
  }, [newEvents, me, queryClient]);
}
