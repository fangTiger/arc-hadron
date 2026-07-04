import { describe, expect, test } from "vitest";
import { pairLevels } from "../components/asset/OrderBook";
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

describe("pairLevels", () => {
  test("pairs equal-length bid and ask levels by rank", () => {
    const bidLevels = [level(110n), level(100n)];
    const askLevels = [level(120n), level(130n)];

    expect(pairLevels(bidLevels, askLevels, { max: 12 })).toEqual([
      { ask: askLevels[0], bid: bidLevels[0] },
      { ask: askLevels[1], bid: bidLevels[1] },
    ]);
  });

  test("pads the shorter side with null placeholders", () => {
    const bidLevels = [level(110n)];
    const askLevels = [level(120n), level(130n), level(140n)];

    expect(pairLevels(bidLevels, askLevels, { max: 12 })).toEqual([
      { ask: askLevels[0], bid: bidLevels[0] },
      { ask: askLevels[1], bid: null },
      { ask: askLevels[2], bid: null },
    ]);
  });

  test("returns no rows when both sides are empty", () => {
    expect(pairLevels([], [], { max: 12 })).toEqual([]);
  });

  test("truncates each side to the requested maximum depth", () => {
    const bidLevels = Array.from({ length: 14 }, (_, index) => level(BigInt(200 - index)));
    const askLevels = Array.from({ length: 14 }, (_, index) => level(BigInt(300 + index)));

    const pairs = pairLevels(bidLevels, askLevels, { max: 12 });

    expect(pairs).toHaveLength(12);
    expect(pairs.at(0)).toEqual({ ask: askLevels[0], bid: bidLevels[0] });
    expect(pairs.at(-1)).toEqual({ ask: askLevels[11], bid: bidLevels[11] });
  });
});
