import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import {
  HADRON_ASSETS_ADDRESS,
  HADRON_MARKET_ADDRESS,
  HADRON_YIELD_ADDRESS,
} from "../lib/contracts";
import type { TradeEvent } from "../lib/events";
import {
  EVENT_INVALIDATION_DISPATCH,
  type EventInvalidationDispatchKey,
} from "../lib/hooks/useEventDrivenInvalidation";
import type { QueryPredicate } from "../lib/hooks/invalidationPredicates";

const ME = "0x2222222222222222222222222222222222222222" as `0x${string}`;
const OTHER = "0x3333333333333333333333333333333333333333" as `0x${string}`;

const EVENT_TYPES = [
  "asset-issued",
  "bid-cancelled",
  "bid-filled",
  "bid-placed",
  "cancelled",
  "listed",
  "offering-closed",
  "offering-created",
  "primary-sale",
  "purchased",
  "yield-claimed",
  "yield-deposited",
] as const satisfies readonly TradeEvent["type"][];

const QUERY_KEYS = [
  {
    key: [
      "readContract",
      { address: HADRON_MARKET_ADDRESS, functionName: "listingCount" },
    ],
    label: "listingCount",
  },
  {
    key: [
      "readContract",
      { address: HADRON_MARKET_ADDRESS, functionName: "listingsByToken" },
    ],
    label: "listingsByToken",
  },
  {
    key: [
      "readContracts",
      {
        contracts: [
          { address: HADRON_MARKET_ADDRESS, functionName: "getListing" },
        ],
      },
    ],
    label: "listingBatch",
  },
  {
    key: [
      "readContract",
      { address: HADRON_MARKET_ADDRESS, functionName: "bidCount" },
    ],
    label: "bidCount",
  },
  {
    key: [
      "readContract",
      { address: HADRON_MARKET_ADDRESS, functionName: "bidsByToken" },
    ],
    label: "bidsByToken",
  },
  {
    key: [
      "readContracts",
      {
        contracts: [
          { address: HADRON_MARKET_ADDRESS, functionName: "getBid" },
        ],
      },
    ],
    label: "bidBatch",
  },
  {
    key: [
      "readContract",
      { address: HADRON_ASSETS_ADDRESS, functionName: "balanceOf" },
    ],
    label: "balanceOf",
  },
  {
    key: [
      "readContracts",
      {
        contracts: [
          { address: HADRON_ASSETS_ADDRESS, functionName: "getAsset" },
        ],
      },
    ],
    label: "assetBatch",
  },
  {
    key: [
      "readContracts",
      {
        contracts: [
          { address: HADRON_YIELD_ADDRESS, functionName: "pendingYield" },
        ],
      },
    ],
    label: "pendingYield",
  },
  {
    key: ["someOtherKey", { functionName: "listingCount" }],
    label: "unrelated",
  },
] as const;

function tradeEvent(type: TradeEvent["type"], overrides: Partial<TradeEvent> = {}): TradeEvent {
  return {
    blockNumber: 1n,
    logIndex: 1,
    tokenId: 1n,
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
    type,
    ...overrides,
  };
}

function queryFixture() {
  const queryClient = new QueryClient();
  const labelByHash = new Map<string, string>();

  for (const { key } of QUERY_KEYS) {
    queryClient.setQueryData(key, {});
  }

  for (const { key, label } of QUERY_KEYS) {
    const query = queryClient.getQueryCache().find({ queryKey: key });

    if (!query) {
      throw new Error(`Missing query for ${label}`);
    }

    labelByHash.set(query.queryHash, label);
  }

  return { labelByHash, queryClient };
}

function matchedLabels(predicates: readonly QueryPredicate[]): string[] {
  const { labelByHash, queryClient } = queryFixture();
  const labels = new Set<string>();

  for (const predicate of predicates) {
    for (const query of queryClient.getQueryCache().findAll({ predicate })) {
      const label = labelByHash.get(query.queryHash);

      if (label) {
        labels.add(label);
      }
    }
  }

  return Array.from(labels).sort();
}

function dispatchLabels(type: EventInvalidationDispatchKey, eventOverrides: Partial<TradeEvent> = {}) {
  const event = tradeEvent(type, eventOverrides);
  const predicates = EVENT_INVALIDATION_DISPATCH[type](event, { me: ME });

  return matchedLabels(predicates);
}

describe("EVENT_INVALIDATION_DISPATCH", () => {
  test("covers every current TradeEvent type", () => {
    expect(Object.keys(EVENT_INVALIDATION_DISPATCH).sort()).toEqual([...EVENT_TYPES].sort());
  });

  test.each([
    ["listed", ["listingBatch", "listingCount", "listingsByToken"]],
    ["cancelled", ["listingBatch", "listingCount", "listingsByToken"]],
    ["purchased", ["listingBatch", "listingCount", "listingsByToken"]],
    ["bid-placed", ["bidBatch", "bidCount", "bidsByToken"]],
    ["bid-cancelled", ["bidBatch", "bidCount", "bidsByToken"]],
    ["bid-filled", ["bidBatch", "bidCount", "bidsByToken"]],
    ["yield-deposited", ["pendingYield"]],
    ["yield-claimed", ["pendingYield"]],
    ["asset-issued", ["assetBatch", "balanceOf"]],
    ["offering-created", ["assetBatch", "balanceOf"]],
    ["offering-closed", ["assetBatch", "balanceOf"]],
    ["primary-sale", ["assetBatch", "balanceOf"]],
  ] as const)("invalidates expected query set for %s", (type, expectedLabels) => {
    expect(dispatchLabels(type, { buyer: OTHER, seller: OTHER })).toEqual(expectedLabels);
  });

  test("purchased events involving the connected account also invalidate assets", () => {
    expect(dispatchLabels("purchased", { buyer: ME, seller: OTHER })).toEqual([
      "assetBatch",
      "balanceOf",
      "listingBatch",
      "listingCount",
      "listingsByToken",
    ]);

    expect(dispatchLabels("purchased", { buyer: OTHER, seller: ME })).toEqual([
      "assetBatch",
      "balanceOf",
      "listingBatch",
      "listingCount",
      "listingsByToken",
    ]);
  });

  test("bid-filled events involving the connected account also invalidate assets", () => {
    expect(dispatchLabels("bid-filled", { buyer: ME, seller: OTHER })).toEqual([
      "assetBatch",
      "balanceOf",
      "bidBatch",
      "bidCount",
      "bidsByToken",
    ]);

    expect(dispatchLabels("bid-filled", { buyer: OTHER, seller: ME })).toEqual([
      "assetBatch",
      "balanceOf",
      "bidBatch",
      "bidCount",
      "bidsByToken",
    ]);
  });
});
