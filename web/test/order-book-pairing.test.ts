import { describe, expect, test } from "vitest";
import { stackLevels } from "../components/asset/OrderBook";
import type { OrderBookLevel } from "../lib/orderBook";

function level(price: bigint): OrderBookLevel {
  return {
    count: 1,
    cum: price,
    isOwn: false,
    price,
    size: price,
  };
}

describe("stackLevels", () => {
  test("places asks above the spread with best ask closest to the center", () => {
    const bidLevels = [level(110n), level(100n)];
    const askLevels = [level(120n), level(130n)];

    expect(stackLevels(bidLevels, askLevels, { max: 12 })).toEqual({
      asks: [askLevels[1], askLevels[0]],
      bids: [bidLevels[0], bidLevels[1]],
    });
  });

  test("keeps single-sided books without null padding", () => {
    const bidLevels = [level(110n)];
    const askLevels = [level(120n), level(130n), level(140n)];

    expect(stackLevels(bidLevels, askLevels, { max: 12 })).toEqual({
      asks: [askLevels[2], askLevels[1], askLevels[0]],
      bids: [bidLevels[0]],
    });
  });

  test("returns no rows when both sides are empty", () => {
    expect(stackLevels([], [], { max: 12 })).toEqual({ asks: [], bids: [] });
  });

  test("truncates each side to the requested maximum depth", () => {
    const bidLevels = Array.from({ length: 14 }, (_, index) => level(BigInt(200 - index)));
    const askLevels = Array.from({ length: 14 }, (_, index) => level(BigInt(300 + index)));

    const stacked = stackLevels(bidLevels, askLevels, { max: 12 });

    expect(stacked.asks).toHaveLength(12);
    expect(stacked.bids).toHaveLength(12);
    expect(stacked.asks.at(0)).toEqual(askLevels[11]);
    expect(stacked.asks.at(-1)).toEqual(askLevels[0]);
    expect(stacked.bids.at(0)).toEqual(bidLevels[0]);
    expect(stacked.bids.at(-1)).toEqual(bidLevels[11]);
  });
});
