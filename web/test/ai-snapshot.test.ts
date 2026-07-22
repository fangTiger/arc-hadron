import { describe, expect, test } from "vitest";
import type { TradeEvent } from "../lib/events";
import type { ListingView } from "../lib/listing";
import type { AssetView } from "../lib/mappers";
import {
  buildAssetSnapshot,
  buildMarketSnapshot,
  SNAPSHOT_SCHEMA_VERSION,
} from "../lib/ai/snapshot";

const USDC = 10n ** 18n;
const BUYER = "0x1000000000000000000000000000000000000001";
const SELLER = "0x2000000000000000000000000000000000000002";

function hash(index: number): `0x${string}` {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

function assetView(overrides: Partial<AssetView> = {}): AssetView {
  return {
    category: "treasuries",
    meta: {
      apyBps: 525,
      description: "Short-duration US Treasury exposure for the testnet catalog.",
      displayName: "US T-Bill 2026-Q3",
      docs: [],
      issuer: "Hadron Treasury Desk",
      slug: "t-bill-2026-q3",
      ticker: "TBILL",
    },
    name: "US T-BILL 2026-Q3",
    offering: {
      active: true,
      id: 9n,
      pricePerShare: 12500000000000000n,
      remaining: 5_000n,
      tokenId: 15n,
    },
    tokenId: 15n,
    totalShares: 10_000n,
    ...overrides,
  };
}

function listing(overrides: Partial<ListingView> = {}): ListingView {
  return {
    id: 1n,
    isMine: false,
    pricePerShare: 13000000000000000n,
    remaining: 250n,
    seller: SELLER,
    tokenId: 15n,
    ...overrides,
  };
}

function tradeEvent(overrides: Partial<TradeEvent> = {}): TradeEvent {
  return {
    amount: 200n,
    blockNumber: 100n,
    buyer: BUYER,
    logIndex: 1,
    pricePerShare: 25000000000000000n,
    seller: SELLER,
    timestamp: Date.UTC(2026, 6, 3, 9),
    tokenId: 15n,
    totalPaid: 5n * USDC,
    txHash: hash(1),
    type: "primary-sale",
    ...overrides,
  };
}

function expectJsonRoundTrip(value: unknown) {
  expect(JSON.parse(JSON.stringify(value))).toEqual(value);
}

describe("AI snapshot builders", () => {
  test("builds an asset snapshot with JSON-safe values, display share prices, and bounded detail", () => {
    const listings = Array.from({ length: 12 }, (_, index) =>
      listing({
        id: BigInt(index + 1),
        pricePerShare: BigInt(100 + index) * USDC / 10_000n,
        remaining: BigInt(100 + index),
      }),
    );
    const events = Array.from({ length: 25 }, (_, index) =>
      tradeEvent({
        blockNumber: BigInt(100 + index),
        logIndex: index,
        pricePerShare: BigInt(200 + index) * USDC / 10_000n,
        timestamp: Date.UTC(2026, 6, 3, index),
        totalPaid: BigInt(index + 1) * USDC,
        txHash: hash(index + 1),
      }),
    );

    const snapshot = buildAssetSnapshot({
      asset: assetView(),
      events,
      listings,
      nowMs: Date.UTC(2026, 6, 3, 23),
    });

    expect(snapshot.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);
    expect(snapshot.kind).toBe("asset");
    expect(snapshot.asset.tokenId).toBe("15");
    expect(snapshot.asset.totalShares).toBe("10000");
    expect(snapshot.asset.offering?.sharePrice).toBe("1.25");
    expect(snapshot.asset.latestSharePrice).toBe("2.24");
    expect(snapshot.orderBook).toHaveLength(10);
    expect(snapshot.orderBook[0]).toMatchObject({ id: "1", sharePrice: "1.00" });
    expect(snapshot.recentTrades).toHaveLength(20);
    expect(snapshot.recentTrades[0]).toMatchObject({
      blockNumber: "124",
      sharePrice: "2.24",
      totalPaid: "25.00",
    });
    expect(snapshot.priceSeries.every((point) => typeof point.sharePrice === "string")).toBe(true);
    expectJsonRoundTrip(snapshot);
  });

  test("keeps no-trade assets and empty markets legal", () => {
    const assetSnapshot = buildAssetSnapshot({
      asset: assetView({ offering: null }),
      events: [],
      listings: [],
      nowMs: Date.UTC(2026, 6, 3, 23),
    });

    expect(assetSnapshot.asset.latestSharePrice).toBe("0.00");
    expect(assetSnapshot.asset.change24hPct).toBe(0);
    expect(assetSnapshot.orderBook).toEqual([]);
    expect(assetSnapshot.recentTrades).toEqual([]);
    expectJsonRoundTrip(assetSnapshot);

    const marketSnapshot = buildMarketSnapshot({
      assets: [],
      events: [],
      listings: [],
      nowMs: Date.UTC(2026, 6, 3, 23),
    });

    expect(marketSnapshot).toMatchObject({
      assets: [],
      kind: "market",
      recentTrades: [],
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      summary: {
        assetCount: 0,
        total24hVolume: "0.00",
      },
    });
    expectJsonRoundTrip(marketSnapshot);
  });

  test("includes bid fills in AI recent trades and latest price without schema changes", () => {
    const snapshot = buildAssetSnapshot({
      asset: assetView(),
      events: [
        tradeEvent({ pricePerShare: 25000000000000000n, timestamp: Date.UTC(2026, 6, 3, 8) }),
        tradeEvent({
          blockNumber: 101n,
          logIndex: 2,
          pricePerShare: 30000000000000000n,
          timestamp: Date.UTC(2026, 6, 3, 10),
          totalPaid: 6n * USDC,
          txHash: hash(2),
          type: "bid-filled",
        }),
      ],
      listings: [],
      nowMs: Date.UTC(2026, 6, 3, 12),
    });

    expect(snapshot.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);
    expect(snapshot.asset.latestSharePrice).toBe("3.00");
    expect(snapshot.asset.volume24h).toBe("11.00");
    expect(snapshot.recentTrades[0]).toMatchObject({
      sharePrice: "3.00",
      totalPaid: "6.00",
      type: "bid-filled",
    });
  });

  test("excludes yield events from AI trade snapshots and market volume", () => {
    const snapshot = buildAssetSnapshot({
      asset: assetView(),
      events: [
        tradeEvent({
          amount: undefined,
          pricePerShare: undefined,
          totalPaid: 99n * USDC,
          type: "yield-deposited",
          yieldAmount: 12n * USDC,
        }),
      ],
      listings: [],
      nowMs: Date.UTC(2026, 6, 3, 12),
    });
    const marketSnapshot = buildMarketSnapshot({
      assets: [assetView()],
      events: [
        tradeEvent({
          amount: undefined,
          pricePerShare: undefined,
          totalPaid: 99n * USDC,
          type: "yield-claimed",
          yieldAmount: 12n * USDC,
        }),
      ],
      listings: [],
      nowMs: Date.UTC(2026, 6, 3, 12),
    });

    expect(snapshot.asset.latestSharePrice).toBe("1.25");
    expect(snapshot.asset.volume24h).toBe("0.00");
    expect(snapshot.recentTrades).toEqual([]);
    expect(marketSnapshot.summary.total24hVolume).toBe("0.00");
    expect(marketSnapshot.recentTrades).toEqual([]);
  });

  test("keeps an expanded 26-asset market snapshot within the route guard budget", () => {
    const assets = Array.from({ length: 26 }, (_, index) =>
      assetView({
        category: index % 2 === 0 ? "treasuries" : "credit",
        meta: {
          ...assetView().meta,
          apyBps: 400 + index,
          description: `Scenario disclosure text ${index} for market brief sizing.`,
          displayName: `Asset ${index.toString().padStart(2, "0")}`,
          slug: `asset-${index}`,
          ticker: `A${index}`,
        },
        name: `ASSET ${index}`,
        offering: {
          active: true,
          id: BigInt(index + 1),
          pricePerShare: BigInt(100 + index) * USDC / 10_000n,
          remaining: BigInt(1_000 + index),
          tokenId: BigInt(index + 1),
        },
        tokenId: BigInt(index + 1),
        totalShares: BigInt(10_000 + index),
      }),
    );
    const listings = assets.flatMap((asset, assetIndex) =>
      Array.from({ length: 12 }, (_, listingIndex) =>
        listing({
          id: BigInt(assetIndex * 100 + listingIndex),
          pricePerShare: BigInt(100 + assetIndex + listingIndex) * USDC / 10_000n,
          remaining: BigInt(100 + listingIndex),
          tokenId: asset.tokenId,
        }),
      ),
    );
    const events = Array.from({ length: 60 }, (_, index) =>
      tradeEvent({
        blockNumber: BigInt(10_000 + index),
        logIndex: index,
        pricePerShare: BigInt(100 + index) * USDC / 10_000n,
        timestamp: Date.UTC(2026, 6, 3, index % 24),
        tokenId: assets[index % assets.length].tokenId,
        totalPaid: BigInt(index + 1) * USDC,
        txHash: hash(index + 1),
        type: index % 2 === 0 ? "primary-sale" : "purchased",
      }),
    );
    events.push(
      tradeEvent({
        blockNumber: 11_000n,
        logIndex: 61,
        pricePerShare: 10n * USDC / 100n,
        timestamp: Date.UTC(2026, 6, 3, 22),
        tokenId: 26n,
        totalPaid: 999n * USDC,
        txHash: hash(999),
        type: "purchased",
      }),
    );

    const snapshot = buildMarketSnapshot({
      assets,
      events,
      listings,
      nowMs: Date.UTC(2026, 6, 3, 23),
    });
    const byteLength = new TextEncoder().encode(JSON.stringify(snapshot)).length;

    expect(snapshot.summary.assetCount).toBe(26);
    expect(snapshot.assets).toHaveLength(20);
    expect(snapshot.assets.map((asset) => asset.tokenId)).toContain("26");
    expect(snapshot.assets.every((asset) => asset.orderBook.length <= 10)).toBe(true);
    expect(snapshot.recentTrades).toHaveLength(20);
    expect(byteLength).toBeLessThanOrEqual(24_576);
    expectJsonRoundTrip(snapshot);
  });

  test("caps the asset price series to the latest points within the route budget", () => {
    const lastTradeTs = Date.UTC(2026, 5, 1) + 599 * 60_000;
    const events = Array.from({ length: 600 }, (_, index) =>
      tradeEvent({
        blockNumber: BigInt(index + 1),
        logIndex: index,
        pricePerShare: 25000000000000000n + BigInt(index) * 1000000000000n,
        timestamp: Date.UTC(2026, 5, 1) + index * 60_000,
        txHash: hash(index + 1),
      }),
    );

    const snapshot = buildAssetSnapshot({
      asset: assetView(),
      events,
      listings: [],
      nowMs: Date.UTC(2026, 6, 3, 12),
    });

    expect(snapshot.priceSeries.length).toBeLessThanOrEqual(300);
    expect(snapshot.priceSeries.at(-1)?.t).toBeGreaterThanOrEqual(lastTradeTs);
  });
});
