import { describe, expect, test } from "vitest";
import {
  issueSharePriceForAsset,
  priceSeriesToAreaData,
  usdcValueFromWei,
} from "../lib/chartData";
import type { PricePoint } from "../lib/events";
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

describe("chart data adapters", () => {
  test("converts display share price points to ascending lightweight area data", () => {
    const series: PricePoint[] = [
      { price: 130n * USDC, t: Date.UTC(2026, 6, 3, 10, 0, 2) },
      { price: 110n * USDC, t: Date.UTC(2026, 6, 3, 10, 0, 1) },
      { price: 125n * USDC, t: Date.UTC(2026, 6, 3, 10, 0, 2) },
    ];

    expect(priceSeriesToAreaData(series, 100n * USDC)).toEqual([
      { time: 1_783_072_801, value: 110 },
      { time: 1_783_072_802, value: 125 },
    ]);
  });

  test("falls back to a single issue price point when the series is empty", () => {
    expect(priceSeriesToAreaData([], 99n * USDC)).toEqual([{ time: 0, value: 99 }]);
  });

  test("returns display share issue price for the baseline", () => {
    expect(issueSharePriceForAsset(assetView())).toBe(USDC);
  });

  test("converts wei-denominated USDC prices without losing fractional cents", () => {
    expect(usdcValueFromWei(123_456_789_000_000_000n)).toBeCloseTo(0.123456789);
  });
});
