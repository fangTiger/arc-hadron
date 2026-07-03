import { describe, expect, test } from "vitest";
import { eventSentence, priceSeriesForAsset } from "../lib/marketMetrics";
import type { TradeEvent } from "../lib/events";
import type { AssetView } from "../lib/mappers";

const USDC = 10n ** 18n;

function assetView(overrides: Partial<AssetView> = {}): AssetView {
  return {
    category: "treasuries",
    meta: {
      apyBps: 510,
      description: "Test asset",
      displayName: "US T-Bill 2026-Q3",
      docs: [],
      issuer: "Hadron Treasury Desk",
      slug: "t-bill-2026-q3",
      ticker: "TBILL",
    },
    name: "US T-BILL 2026-Q3",
    offering: {
      active: true,
      id: 1n,
      pricePerShare: USDC / 100n,
      remaining: 1_000n,
      tokenId: 15n,
    },
    tokenId: 15n,
    totalShares: 10_000n,
    ...overrides,
  };
}

function event(overrides: Partial<TradeEvent> = {}): TradeEvent {
  return {
    amount: 250n,
    blockNumber: 1n,
    logIndex: 0,
    pricePerShare: 12500000000000000n,
    timestamp: 1_000,
    tokenId: 15n,
    totalPaid: 3125000000000000000n,
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
    type: "primary-sale",
    ...overrides,
  };
}

describe("market metrics display prices", () => {
  test("returns chart prices in display share price units", () => {
    expect(
      priceSeriesForAsset(assetView(), [
        event({ pricePerShare: 12500000000000000n, timestamp: 1_000 }),
        event({ pricePerShare: 15000000000000000n, timestamp: 2_000 }),
      ]),
    ).toEqual([
      { price: 1250000000000000000n, t: 1_000 },
      { price: 1500000000000000000n, t: 2_000 },
    ]);
  });

  test("renders activity sentences with display shares and display share price", () => {
    expect(eventSentence(event(), assetView())).toBe("BUY 2.50 TBILL @ 1.25");
  });
});
