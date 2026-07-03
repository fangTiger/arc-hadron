import { describe, expect, test } from "vitest";
import {
  MARKET_EVENTS_CACHE_VERSION,
  deserializeMarketEventsCache,
  marketEventsCacheKey,
  serializeMarketEventsCache,
} from "../lib/marketEventCache";
import type { TradeEvent } from "../lib/events";

const buyer = "0x1000000000000000000000000000000000000001";
const seller = "0x2000000000000000000000000000000000000002";

function event(overrides: Partial<TradeEvent> = {}): TradeEvent {
  return {
    amount: 2n,
    blockNumber: 120n,
    buyer,
    listingId: 9n,
    logIndex: 3,
    pricePerShare: 11n,
    seller,
    timestamp: 1_783_000_000_000,
    tokenId: 4n,
    totalPaid: 22n,
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000004",
    type: "purchased",
    ...overrides,
  };
}

describe("market events cache serialization", () => {
  test("round-trips bigint event fields through JSON-safe strings", () => {
    const data = {
      events: [event()],
      lastScannedBlock: 9_876n,
    };
    const serialized = serializeMarketEventsCache(data);

    expect(() => JSON.parse(serialized)).not.toThrow();
    expect(serialized).toContain('"lastScannedBlock":"9876"');
    expect(serialized).toContain('"tokenId":"4"');
    expect(deserializeMarketEventsCache(serialized)).toEqual(data);
  });

  test("returns null for version mismatches so callers can rescan from deploy block", () => {
    const serialized = serializeMarketEventsCache({
      events: [event()],
      lastScannedBlock: 9_876n,
    });
    const stale = {
      ...JSON.parse(serialized),
      version: MARKET_EVENTS_CACHE_VERSION - 1,
    };

    expect(deserializeMarketEventsCache(JSON.stringify(stale))).toBeNull();
  });

  test("keys cache entries by version, deploy block, and contract addresses", () => {
    expect(
      marketEventsCacheKey({
        assetsAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        deployBlock: 123n,
        marketAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        yieldAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
      }),
    ).toBe(
      "hadron:market-events:v2:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:0xcccccccccccccccccccccccccccccccccccccccc:123",
    );
  });
});
