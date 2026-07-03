import { describe, expect, test } from "vitest";

const USDC = 10n ** 18n;
const MINE = "0x1111111111111111111111111111111111111111";
const MINE_MIXED = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";

async function bidsModule() {
  return import("../lib/bids").catch(() => null);
}

describe("mapBidResults", () => {
  test("filters inactive bids, sorts active bids by descending price then ascending id, and marks my bids", async () => {
    const mod = await bidsModule();

    expect(mod).not.toBeNull();
    if (!mod) {
      return;
    }

    const bids = mod.mapBidResults({
      currentAddress: MINE_MIXED,
      ids: [1n, 2n, 3n, 4n, 5n],
      results: [
        {
          active: true,
          bidder: OTHER,
          pricePerShare: 4n * USDC,
          remaining: 8n,
          tokenId: 7n,
        },
        {
          active: true,
          bidder: MINE,
          pricePerShare: 5n * USDC,
          remaining: 3n,
          tokenId: 7n,
        },
        {
          active: false,
          bidder: OTHER,
          pricePerShare: 9n * USDC,
          remaining: 2n,
          tokenId: 7n,
        },
        {
          active: true,
          bidder: OTHER,
          pricePerShare: 5n * USDC,
          remaining: 5n,
          tokenId: 7n,
        },
        {
          active: true,
          bidder: OTHER,
          pricePerShare: 6n * USDC,
          remaining: 0n,
          tokenId: 7n,
        },
      ],
    });

    expect(bids).toEqual([
      {
        active: true,
        bidder: MINE,
        id: 2n,
        isOwn: true,
        pricePerShare: 5n * USDC,
        remaining: 3n,
        tokenId: 7n,
      },
      {
        active: true,
        bidder: OTHER,
        id: 4n,
        isOwn: false,
        pricePerShare: 5n * USDC,
        remaining: 5n,
        tokenId: 7n,
      },
      {
        active: true,
        bidder: OTHER,
        id: 1n,
        isOwn: false,
        pricePerShare: 4n * USDC,
        remaining: 8n,
        tokenId: 7n,
      },
    ]);
  });

  test("normalizes tuple-shaped getBid results from multicall", async () => {
    const mod = await bidsModule();

    expect(mod).not.toBeNull();
    if (!mod) {
      return;
    }

    expect(
      mod.mapBidResults({
        currentAddress: MINE,
        ids: [9n],
        results: [[MINE, 12n, 15n * USDC, 4n, true]],
      }),
    ).toEqual([
      {
        active: true,
        bidder: MINE,
        id: 9n,
        isOwn: true,
        pricePerShare: 15n * USDC,
        remaining: 4n,
        tokenId: 12n,
      },
    ]);
  });
});
