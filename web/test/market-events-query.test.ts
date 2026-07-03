import { describe, expect, test } from "vitest";
import { filterActiveMarketEvents, populateBlockTimestampCache } from "../lib/hooks/useMarketEvents";
import type { TradeEvent } from "../lib/events";

function event(overrides: Partial<TradeEvent> = {}): TradeEvent {
  return {
    blockNumber: 1n,
    logIndex: 0,
    tokenId: 15n,
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
    type: "primary-sale",
    ...overrides,
  };
}

describe("market event timestamp queries", () => {
  test("drops below-range token events before market activity is cached", () => {
    // V4 目录自 tokenId 1 起；过滤语义保留（tokenId < FIRST_ACTIVE_TOKEN_ID 丢弃）
    expect(filterActiveMarketEvents([event({ tokenId: 0n }), event({ tokenId: 1n })])).toEqual([
      event({ tokenId: 1n }),
    ]);
  });

  test("fills missing block timestamps with bounded concurrency", async () => {
    const cache = new Map<bigint, number>([[1n, 1_000]]);
    let active = 0;
    let maxActive = 0;
    const requested: bigint[] = [];

    await populateBlockTimestampCache({
      blockNumbers: [1n, 2n, 3n, 4n, 5n],
      cache,
      concurrency: 2,
      getBlock: async (blockNumber) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        requested.push(blockNumber);
        await new Promise((resolve) => setTimeout(resolve, 0));
        active -= 1;

        return { timestamp: blockNumber * 100n };
      },
    });

    expect(requested).toEqual([2n, 3n, 4n, 5n]);
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(cache.get(5n)).toBe(500_000);
  });
});
