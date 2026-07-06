import { describe, expect, test } from "vitest";
import { resolveCancelableOrders } from "../lib/ai/resolveCancelable";

const USDC = 10n ** 18n;
const MINE: `0x${string}` = "0x1111111111111111111111111111111111111111";
const MINE_MIXED: `0x${string}` = "0x1111111111111111111111111111111111111111";
const OTHER: `0x${string}` = "0x2222222222222222222222222222222222222222";

function listing(overrides: Partial<Parameters<typeof resolveCancelableOrders>[2]["listings"][number]>) {
  return {
    id: 1n,
    isMine: false,
    pricePerShare: 2n * USDC,
    remaining: 100n,
    seller: OTHER,
    tokenId: 7n,
    ...overrides,
  };
}

function bid(overrides: Partial<Parameters<typeof resolveCancelableOrders>[2]["bids"][number]>) {
  return {
    active: true,
    bidder: OTHER,
    id: 1n,
    isOwn: false,
    pricePerShare: 2n * USDC,
    remaining: 100n,
    tokenId: 7n,
    ...overrides,
  };
}

describe("resolveCancelableOrders", () => {
  test("returns every active listing and bid for the token and address", () => {
    const orders = resolveCancelableOrders(7n, MINE, {
      listings: [
        listing({ id: 4n, isMine: true, pricePerShare: 210n * USDC, seller: MINE_MIXED }),
        listing({ id: 5n, isMine: false, seller: OTHER }),
        listing({ id: 6n, isMine: true, seller: MINE, tokenId: 8n }),
      ],
      bids: [
        bid({ bidder: MINE, id: 9n, isOwn: true, pricePerShare: 190n * USDC, remaining: 70n }),
        bid({ bidder: OTHER, id: 10n, isOwn: false }),
        bid({ bidder: MINE, id: 11n, isOwn: true, tokenId: 8n }),
      ],
    });

    expect(orders).toEqual([
      { side: "listing", id: 4n, price: 210n * USDC, size: 100n },
      { side: "bid", id: 9n, price: 190n * USDC, size: 70n },
    ]);
  });

  test("supports only one side and returns empty when no active owner orders exist", () => {
    expect(
      resolveCancelableOrders(7n, MINE, {
        listings: [listing({ id: 4n, isMine: true, seller: MINE })],
        bids: [],
      }),
    ).toEqual([{ side: "listing", id: 4n, price: 2n * USDC, size: 100n }]);

    expect(
      resolveCancelableOrders(7n, MINE, {
        listings: [],
        bids: [bid({ bidder: MINE, id: 9n, isOwn: true })],
      }),
    ).toEqual([{ side: "bid", id: 9n, price: 2n * USDC, size: 100n }]);

    expect(
      resolveCancelableOrders(7n, MINE, {
        listings: [listing({ seller: OTHER })],
        bids: [bid({ bidder: OTHER })],
      }),
    ).toEqual([]);
  });

  test("excludes filled or cancelled orders even if ownership flags are stale", () => {
    const orders = resolveCancelableOrders(7n, MINE, {
      listings: [
        listing({ id: 1n, isMine: true, remaining: 0n, seller: MINE }),
        listing({ active: false, id: 2n, isMine: true, seller: MINE }),
        listing({ id: 3n, isMine: true, remaining: 25n, seller: MINE }),
      ],
      bids: [
        bid({ active: false, bidder: MINE, id: 4n, isOwn: true }),
        bid({ bidder: MINE, id: 5n, isOwn: true, remaining: 0n }),
        bid({ bidder: MINE, id: 6n, isOwn: true, remaining: 30n }),
      ],
    });

    expect(orders).toEqual([
      { side: "listing", id: 3n, price: 2n * USDC, size: 25n },
      { side: "bid", id: 6n, price: 2n * USDC, size: 30n },
    ]);
  });
});
