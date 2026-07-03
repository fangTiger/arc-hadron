import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ActivityPanel } from "../components/market/ActivityPanel";
import { LiveTicker } from "../components/market/LiveTicker";
import { MarketTableView } from "../components/market/MarketTable";
import { StatsStripView } from "../components/market/StatsStrip";
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
      pricePerShare: 100n * USDC,
      remaining: 6_000n,
      tokenId: 1n,
    },
    tokenId: 1n,
    totalShares: 10_000n,
    ...overrides,
  };
}

function tradeEvent(overrides: Partial<TradeEvent> = {}): TradeEvent {
  return {
    amount: 3n,
    blockNumber: 100n,
    buyer: "0x1000000000000000000000000000000000000001",
    logIndex: 1,
    pricePerShare: 110n * USDC,
    seller: "0x2000000000000000000000000000000000000002",
    timestamp: Date.UTC(2026, 6, 2, 10),
    tokenId: 1n,
    totalPaid: 330n * USDC,
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
    type: "primary-sale",
    ...overrides,
  };
}

describe("market redesign components", () => {
  test("renders compact stats with real 24H volume, asset count, and trade count", () => {
    const html = renderToStaticMarkup(
      <StatsStripView
        assetCount={14}
        avgApyBps={720}
        isLoading={false}
        tradeCount={9}
        tvl={1_250_000n * USDC}
        volume24h={12_300n * USDC}
      />,
    );

    expect(html).toContain("TVL");
    expect(html).toContain("1.25M");
    expect(html).toContain("24H VOL");
    expect(html).toContain("12.3K");
    expect(html).toContain("AVG YIELD");
    expect(html).toContain("7.20%");
    expect(html).toContain("ASSETS");
    expect(html).toContain("14");
    expect(html).toContain("TRADES");
    expect(html).toContain("9");
  });

  test("renders table rows with ticker badges, latest trade price, and trade links", () => {
    const html = renderToStaticMarkup(
      <MarketTableView
        assets={[assetView()]}
        events={[tradeEvent()]}
        isLoading={false}
        nowMs={Date.UTC(2026, 6, 2, 12)}
      />,
    );

    expect(html).toContain("TBILL");
    expect(html).toContain("US T-Bill 2026-Q3");
    expect(html).toContain("aria-label=\"Open US T-Bill 2026-Q3\"");
    expect(html).toContain("role=\"link\"");
    expect(html).toContain("cursor-pointer");
    expect(html).toContain("110.00");
    expect(html).toContain("10.00%");
    expect(html).toContain("href=\"/asset/1\"");
    expect(html).toContain("Trade");
  });

  test("renders recent activity as English market tape sentences", () => {
    const html = renderToStaticMarkup(
      <ActivityPanel assets={[assetView()]} events={[tradeEvent()]} nowMs={Date.UTC(2026, 6, 2, 12)} />,
    );

    expect(html).toContain("ACTIVITY");
    expect(html).toContain("BUY 3 TBILL @ 110.00");
    expect(html).toContain("href=\"https://testnet.arcscan.app/tx/");
    expect(html).toContain("href=\"https://testnet.arcscan.app/address/0x1000000000000000000000000000000000000001\"");
    expect(html).toContain("0x1000…0001");
  });

  test("renders the live ticker marker and latest event copy", () => {
    const html = renderToStaticMarkup(
      <LiveTicker assets={[assetView()]} events={[tradeEvent()]} />,
    );

    expect(html).toContain("LIVE");
    expect(html).toContain("BUY 3 TBILL @ 110.00");
  });
});
