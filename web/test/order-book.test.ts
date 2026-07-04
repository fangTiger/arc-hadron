import { describe, expect, test } from "vitest";
import { buildDepthSeries, buildOrderBook } from "../lib/orderBook";
import type { BidView } from "../lib/bids";
import type { ListingView } from "../lib/listing";

function bid(overrides: Partial<BidView> = {}): BidView {
  return {
    active: true,
    bidder: "0x1000000000000000000000000000000000000001",
    id: 1n,
    isOwn: false,
    pricePerShare: 100n,
    remaining: 10n,
    tokenId: 1n,
    ...overrides,
  };
}

function listing(overrides: Partial<ListingView> = {}): ListingView {
  return {
    id: 1n,
    isMine: false,
    pricePerShare: 120n,
    remaining: 10n,
    seller: "0x2000000000000000000000000000000000000002",
    tokenId: 1n,
    ...overrides,
  };
}

describe("buildOrderBook", () => {
  test("aggregates same-price orders, sorts by side, and accumulates from best price", () => {
    const book = buildOrderBook({
      listings: [
        listing({ id: 3n, pricePerShare: 130n, remaining: 20n }),
        listing({ id: 1n, pricePerShare: 120n, remaining: 100n }),
        listing({ id: 2n, isMine: true, pricePerShare: 120n, remaining: 50n }),
      ],
      bids: [
        bid({ id: 4n, pricePerShare: 90n, remaining: 15n }),
        bid({ id: 1n, pricePerShare: 100n, remaining: 40n }),
        bid({ id: 2n, isOwn: true, pricePerShare: 100n, remaining: 60n }),
      ],
    });

    expect(book.asks).toEqual([
      { count: 2, cum: 150n, isOwn: true, price: 120n, size: 150n },
      { count: 1, cum: 170n, isOwn: false, price: 130n, size: 20n },
    ]);
    expect(book.bids).toEqual([
      { count: 2, cum: 100n, isOwn: true, price: 100n, size: 100n },
      { count: 1, cum: 115n, isOwn: false, price: 90n, size: 15n },
    ]);
    expect(book.bestAsk).toBe(120n);
    expect(book.bestBid).toBe(100n);
    expect(book.mid).toBe(110n);
    expect(book.spread).toBe(20n);
    expect(book.spreadPct).toBeCloseTo(18.1818, 4);
    expect(book.maxCumulative).toBe(170n);
  });

  test("returns null spread metrics when only bids exist", () => {
    const book = buildOrderBook({
      listings: [],
      bids: [
        bid({ id: 1n, pricePerShare: 100n, remaining: 40n }),
        bid({ id: 2n, pricePerShare: 90n, remaining: 60n }),
      ],
    });

    expect(book.asks).toEqual([]);
    expect(book.bids.map((level) => level.price)).toEqual([100n, 90n]);
    expect(book.bestAsk).toBeNull();
    expect(book.bestBid).toBe(100n);
    expect(book.mid).toBeNull();
    expect(book.spread).toBeNull();
    expect(book.spreadPct).toBeNull();
    expect(book.maxCumulative).toBe(100n);
  });

  test("returns null spread metrics when only asks exist", () => {
    const book = buildOrderBook({
      listings: [
        listing({ id: 1n, pricePerShare: 120n, remaining: 30n }),
        listing({ id: 2n, pricePerShare: 130n, remaining: 45n }),
      ],
      bids: [],
    });

    expect(book.asks.map((level) => level.price)).toEqual([120n, 130n]);
    expect(book.bids).toEqual([]);
    expect(book.bestAsk).toBe(120n);
    expect(book.bestBid).toBeNull();
    expect(book.mid).toBeNull();
    expect(book.spread).toBeNull();
    expect(book.spreadPct).toBeNull();
    expect(book.maxCumulative).toBe(75n);
  });

  test("returns empty sides and zero depth for an empty order book", () => {
    const book = buildOrderBook({ bids: [], listings: [] });

    expect(book.asks).toEqual([]);
    expect(book.bids).toEqual([]);
    expect(book.bestAsk).toBeNull();
    expect(book.bestBid).toBeNull();
    expect(book.mid).toBeNull();
    expect(book.spread).toBeNull();
    expect(book.spreadPct).toBeNull();
    expect(book.maxCumulative).toBe(0n);
  });
});

describe("buildDepthSeries", () => {
  test("returns bids from mid toward lower prices and asks from mid toward higher prices", () => {
    const series = buildDepthSeries(
      buildOrderBook({
        listings: [
          listing({ id: 1n, pricePerShare: 120n, remaining: 100n }),
          listing({ id: 2n, pricePerShare: 130n, remaining: 50n }),
        ],
        bids: [
          bid({ id: 1n, pricePerShare: 100n, remaining: 60n }),
          bid({ id: 2n, pricePerShare: 90n, remaining: 40n }),
        ],
      }),
    );

    expect(series.bids).toEqual([
      { cum: 60n, price: 100n },
      { cum: 100n, price: 90n },
    ]);
    expect(series.asks).toEqual([
      { cum: 100n, price: 120n },
      { cum: 150n, price: 130n },
    ]);
  });

  test("returns only the populated side for single-sided order books", () => {
    const bidOnly = buildDepthSeries(
      buildOrderBook({
        listings: [],
        bids: [bid({ id: 1n, pricePerShare: 100n, remaining: 60n })],
      }),
    );
    const askOnly = buildDepthSeries(
      buildOrderBook({
        listings: [listing({ id: 1n, pricePerShare: 120n, remaining: 80n })],
        bids: [],
      }),
    );

    expect(bidOnly.bids).toEqual([{ cum: 60n, price: 100n }]);
    expect(bidOnly.asks).toEqual([]);
    expect(askOnly.bids).toEqual([]);
    expect(askOnly.asks).toEqual([{ cum: 80n, price: 120n }]);
  });
});
