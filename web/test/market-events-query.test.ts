import { describe, expect, test } from "vitest";
import { populateBlockTimestampCache } from "../lib/hooks/useMarketEvents";

describe("market event timestamp queries", () => {
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
