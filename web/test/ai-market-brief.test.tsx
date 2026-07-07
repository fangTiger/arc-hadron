import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { TradeEvent } from "../lib/events";
import type { ListingView } from "../lib/listing";
import type { AssetView } from "../lib/mappers";

const useAiGenerationMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());
const searchParamsMock = vi.hoisted(() => ({ value: "" }));

vi.mock("@/lib/ai/useAiGeneration", () => ({
  useAiGeneration: useAiGenerationMock,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: routerReplaceMock }),
  useSearchParams: () => new URLSearchParams(searchParamsMock.value),
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
const DISCLOSURE = "AI-generated · testnet illustrative data · not financial advice";

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
    expect(html).toContain(DISCLOSURE);
    expect(html).not.toContain("testnet demo data");
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
    searchParamsMock.value = "";

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

  test("does not expose the activity panel when there is no market activity", () => {
    useAiGenerationMock.mockReturnValue(aiState());
    searchParamsMock.value = "";

    const html = renderToStaticMarkup(
      <HomeView
        assets={[assetView()]}
        errorZh={undefined}
        events={[]}
        eventsError={undefined}
        isAssetsLoading={false}
        isEventsLoading={false}
        marketListings={[]}
        nowMs={NOW_MS}
      />,
    );

    expect(html).toContain("MARKET BRIEF");
    expect(html).not.toContain("ACTIVITY");
  });

  test("mounts a compact filter toolbar before the market table and secondary panels", () => {
    useAiGenerationMock.mockReturnValue(aiState());
    searchParamsMock.value = "q=nomatch";

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
    const toolbarIndex = html.indexOf("data-market-filter-toolbar");
    const tableIndex = html.indexOf("MARKET TABLE");
    const workbenchIndex = html.indexOf("data-market-workbench");
    const sideRailIndex = html.indexOf("data-market-side-rail");
    const toolbarMarkup = html.slice(Math.max(0, toolbarIndex - 220), toolbarIndex + 1200);

    expect(toolbarIndex).toBeGreaterThanOrEqual(0);
    expect(workbenchIndex).toBeGreaterThan(toolbarIndex);
    expect(sideRailIndex).toBeGreaterThan(tableIndex);
    expect(toolbarMarkup).toContain("data-market-command-bar=\"true\"");
    expect(toolbarMarkup).toContain("border-y");
    expect(toolbarMarkup).not.toContain("bg-panel/75");
    expect(toolbarMarkup).not.toContain("p-3 sm:p-4");
    expect(html.indexOf("SEARCH ASSET / TICKER")).toBeGreaterThan(toolbarIndex);
    expect(html.indexOf("CATEGORIES")).toBeGreaterThan(toolbarIndex);
    expect(html.indexOf("Issuer")).toBeGreaterThan(toolbarIndex);
    expect(html.indexOf("4-6%")).toBeGreaterThan(toolbarIndex);
    expect(html.indexOf(">Reset<")).toBeGreaterThan(toolbarIndex);
    expect(tableIndex).toBeGreaterThan(toolbarIndex);
    expect(tableIndex).toBeLessThan(html.indexOf("MARKET BRIEF"));
    expect(tableIndex).toBeLessThan(html.indexOf("ACTIVITY"));
  });
});
