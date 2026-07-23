import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import {
  HADRON_ASSETS_ADDRESS,
  HADRON_MARKET_ADDRESS,
  HADRON_YIELD_ADDRESS,
} from "../lib/contracts";
import { applyTxInvalidation, type TxIntent } from "../lib/hooks/applyTxInvalidation";
import { MARKET_ASSETS_QUERY_KEY } from "../lib/marketSnapshot";

const QUERY_DEFINITIONS = [
  {
    address: HADRON_MARKET_ADDRESS,
    functionName: "listingCount",
    label: "market.listingCount",
  },
  {
    address: HADRON_MARKET_ADDRESS,
    functionName: "listingsByToken",
    label: "market.listingsByToken",
  },
  {
    address: HADRON_MARKET_ADDRESS,
    functionName: "getListing",
    label: "market.getListing",
  },
  {
    address: HADRON_MARKET_ADDRESS,
    functionName: "bidCount",
    label: "market.bidCount",
  },
  {
    address: HADRON_MARKET_ADDRESS,
    functionName: "bidsByToken",
    label: "market.bidsByToken",
  },
  {
    address: HADRON_MARKET_ADDRESS,
    functionName: "getBid",
    label: "market.getBid",
  },
  {
    address: HADRON_ASSETS_ADDRESS,
    functionName: "balanceOf",
    label: "assets.balanceOf",
  },
  {
    address: HADRON_ASSETS_ADDRESS,
    functionName: "getAsset",
    label: "assets.getAsset",
  },
  {
    address: HADRON_ASSETS_ADDRESS,
    functionName: "assetCount",
    label: "assets.assetCount",
  },
  {
    address: HADRON_ASSETS_ADDRESS,
    functionName: "offeringCount",
    label: "assets.offeringCount",
  },
  {
    address: HADRON_YIELD_ADDRESS,
    functionName: "pendingYield",
    label: "yield.pendingYield",
  },
  {
    address: HADRON_YIELD_ADDRESS,
    functionName: "listingCount",
    label: "yield.listingCount",
  },
] as const;

function queryKeyFor(index: number) {
  const definition = QUERY_DEFINITIONS[index];

  if (!definition) {
    throw new Error(`Missing query definition for index ${index}`);
  }

  if (index % 2 === 0) {
    return [
      "readContract",
      {
        address: definition.address,
        functionName: definition.functionName,
      },
    ] as const;
  }

  return [
    "readContracts",
    {
      contracts: [
        {
          address: definition.address,
          functionName: definition.functionName,
        },
      ],
    },
  ] as const;
}

function queryClientFixture() {
  const queryClient = new QueryClient();
  const labelByHash = new Map<string, string>();

  QUERY_DEFINITIONS.forEach((definition, index) => {
    const key = queryKeyFor(index);
    queryClient.setQueryData(key, {});
    const query = queryClient.getQueryCache().find({ queryKey: key });

    if (!query) {
      throw new Error(`Missing query for ${definition.label}`);
    }

    labelByHash.set(query.queryHash, definition.label);
  });
  queryClient.setQueryData(MARKET_ASSETS_QUERY_KEY, []);
  const marketSnapshot = queryClient.getQueryCache().find({
    queryKey: MARKET_ASSETS_QUERY_KEY,
  });

  if (!marketSnapshot) {
    throw new Error("Missing market assets snapshot query.");
  }

  labelByHash.set(marketSnapshot.queryHash, "market.assetsSnapshot");

  return { labelByHash, queryClient };
}

function invalidatedLabelsFor(intent: TxIntent): string[] {
  const { labelByHash, queryClient } = queryClientFixture();

  applyTxInvalidation(queryClient, intent);

  return queryClient
    .getQueryCache()
    .findAll()
    .filter((query) => query.state.isInvalidated)
    .map((query) => labelByHash.get(query.queryHash))
    .filter((label): label is string => Boolean(label))
    .sort();
}

describe("applyTxInvalidation", () => {
  test.each([
    [
      "buy",
      [
        "assets.assetCount",
        "assets.balanceOf",
        "assets.getAsset",
        "assets.offeringCount",
        "market.assetsSnapshot",
        "market.getListing",
        "market.listingCount",
        "market.listingsByToken",
        "yield.pendingYield",
      ],
    ],
    [
      "sell",
      [
        "assets.assetCount",
        "assets.balanceOf",
        "assets.getAsset",
        "assets.offeringCount",
        "market.assetsSnapshot",
        "market.getListing",
        "market.listingCount",
        "market.listingsByToken",
      ],
    ],
    [
      "cancel",
      [
        "market.bidCount",
        "market.bidsByToken",
        "market.getBid",
        "market.getListing",
        "market.listingCount",
        "market.listingsByToken",
      ],
    ],
    ["claim", ["yield.pendingYield"]],
  ] as const)("invalidates expected queries for %s intent", (intent, expectedLabels) => {
    expect(invalidatedLabelsFor(intent)).toEqual(expectedLabels);
  });
});
