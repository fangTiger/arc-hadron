import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { TradeEvent } from "../lib/events";
import type { ListingView } from "../lib/listing";
import type { AssetView } from "../lib/mappers";

const useAiGenerationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/useAiGeneration", () => ({
  useAiGeneration: useAiGenerationMock,
}));

vi.mock("@/components/market/ActivityPanel", () => ({
  ActivityPanel: () => <aside>ACTIVITY</aside>,
}));

vi.mock("@/components/market/CategoryTabs", () => ({
  CategoryTabs: () => <nav>CATEGORIES</nav>,
}));

vi.mock("@/components/market/LiveTicker", () => ({
  LiveTicker: () => <div>LIVE TICKER</div>,
}));

vi.mock("@/components/market/MarketTable", () => ({
  MarketTable: () => <section>MARKET TABLE</section>,
}));

vi.mock("@/components/market/StatsStrip", () => ({
  StatsStrip: () => <section>STATS</section>,
}));

import { HomeView } from "../app/HomeView";
import { MarketBrief, MarketBriefView } from "../components/ai/MarketBrief";

const USDC = 10n ** 18n;
const NOW_MS = Date.UTC(2026, 6, 3, 12);

function unitPriceFromSharePriceCents(cents: bigint): bigint {
  return (cents * USDC) / 10_000n;
}

function aiState(overrides: Record<string, unknown> = {}) {
  return {
    cachedFingerprint: null,
    currentFingerprint: "current",
    error: null,
    generate: vi.fn(),
    generatedAt: null,
    isStale: false,
    markdown: "",
    status: "idle",
    ...overrides,
  };
}

function assetView(overrides: Partial<AssetView> = {}): AssetView {
  return {
    category: "treasuries",
    meta: {
      apyBps: 525,
      description: "Short-duration Treasury exposure.",
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
      pricePerShare: unitPriceFromSharePriceCents(12_500n),
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
    pricePerShare: unitPriceFromSharePriceCents(13_100n),
    remaining: 250n,
    seller: "0x2000000000000000000000000000000000000002",
    tokenId: 15n,
    ...overrides,
  };
}

function tradeEvent(overrides: Partial<TradeEvent> = {}): TradeEvent {
  return {
    amount: 200n,
    blockNumber: 100n,
    buyer: "0x1000000000000000000000000000000000000001",
    logIndex: 1,
    pricePerShare: unitPriceFromSharePriceCents(13_000n),
    seller: "0x2000000000000000000000000000000000000002",
    timestamp: Date.UTC(2026, 6, 3, 9),
    tokenId: 15n,
    totalPaid: 260n * USDC,
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
    type: "primary-sale",
    ...overrides,
  };
}

describe("MarketBrief", () => {
  test("builds a market snapshot for the generation hook and renders the initial action", () => {
    useAiGenerationMock.mockReturnValue(aiState());

    const html = renderToStaticMarkup(
      <MarketBrief
        assets={[assetView()]}
        events={[tradeEvent()]}
        listings={[listing()]}
        nowMs={NOW_MS}
      />,
    );

    expect(html).toContain("MARKET BRIEF");
    expect(html).toContain(">Generate<");
    expect(html).toContain("AI-generated · testnet demo data · not financial advice");
    expect(useAiGenerationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 5042002,
        endpoint: "/api/ai/brief",
        marketAddress: "0x962aba0A590981cf9c5B336aC34922c82f203165",
        purpose: "brief",
        snapshot: expect.objectContaining({
          kind: "market",
          assets: [expect.objectContaining({
            orderBook: [expect.objectContaining({ id: "1", sharePrice: "131.00" })],
          })],
        }),
      }),
    );
  });

  test("renders streaming, done, stale cache, and error states like the asset insight panel", () => {
    const streaming = renderToStaticMarkup(
      <MarketBriefView
        error={null}
        generatedAt={null}
        isStale={false}
        markdown="## Movers\nPartial brief"
        nowMs={NOW_MS}
        onGenerate={() => undefined}
        status="streaming"
      />,
    );
    const done = renderToStaticMarkup(
      <MarketBriefView
        error={null}
        generatedAt={NOW_MS - 3 * 60 * 60 * 1000}
        isStale={false}
        markdown="## Movers\nCached brief"
        nowMs={NOW_MS}
        onGenerate={() => undefined}
        status="done"
      />,
    );
    const stale = renderToStaticMarkup(
      <MarketBriefView
        error={null}
        generatedAt={NOW_MS - 60 * 60 * 1000}
        isStale={true}
        markdown="## Movers\nOld brief"
        nowMs={NOW_MS}
        onGenerate={() => undefined}
        status="done"
      />,
    );
    const failed = renderToStaticMarkup(
      <MarketBriefView
        error="Too many requests"
        generatedAt={null}
        isStale={false}
        markdown=""
        nowMs={NOW_MS}
        onGenerate={() => undefined}
        status="error"
      />,
    );

    expect(streaming).toContain("disabled=\"\"");
    expect(streaming).toContain("Partial brief");
    expect(done).toContain("Generated 3h ago");
    expect(done).toContain(">Refresh<");
    expect(stale).toContain("Data changed");
    expect(stale).toContain(">Regenerate<");
    expect(failed).toContain("Too many requests");
    expect(failed).toContain(">Retry<");
  });

  test("mounts above the activity block on the market page", () => {
    useAiGenerationMock.mockReturnValue(aiState());

    const html = renderToStaticMarkup(
      <HomeView
        assets={[assetView()]}
        errorZh={undefined}
        events={[tradeEvent()]}
        eventsError={undefined}
        isAssetsLoading={false}
        isEventsLoading={false}
        marketListings={[listing()]}
        nowMs={NOW_MS}
      />,
    );

    expect(html.indexOf("MARKET BRIEF")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("MARKET BRIEF")).toBeLessThan(html.indexOf("ACTIVITY"));
  });
});
