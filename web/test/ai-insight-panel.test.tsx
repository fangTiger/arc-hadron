import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { TradeEvent } from "../lib/events";
import type { ListingView } from "../lib/listing";
import type { AssetView } from "../lib/mappers";

const useAiGenerationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/useAiGeneration", () => ({
  useAiGeneration: useAiGenerationMock,
}));

vi.mock("../components/asset/BuyPanel", () => ({
  BuyPanel: () => <aside>BUY PANEL</aside>,
}));

vi.mock("../components/asset/ListingsTable", () => ({
  ListingsTable: () => <section>SELL ORDERS</section>,
}));

vi.mock("../components/asset/BidsTable", () => ({
  BidsTable: () => <section>BUY ORDERS</section>,
}));

vi.mock("../components/asset/PlaceBidPanel", () => ({
  PlaceBidPanel: () => <section>PLACE BID</section>,
}));

import { AssetDetailView } from "../app/asset/[id]/page";
import { InsightPanel, InsightPanelView } from "../components/ai/InsightPanel";

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

describe("InsightPanel", () => {
  test("builds an asset snapshot for the generation hook and renders the initial action", () => {
    useAiGenerationMock.mockReturnValue(aiState());

    const html = renderToStaticMarkup(
      <InsightPanel
        asset={assetView()}
        events={[tradeEvent()]}
        listings={[listing()]}
        nowMs={NOW_MS}
      />,
    );

    expect(html).toContain("ASSET INSIGHT");
    expect(html).toContain(">Generate<");
    expect(html).toContain("AI-generated · testnet demo data · not financial advice");
    expect(useAiGenerationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 5042002,
        endpoint: "/api/ai/insight",
        marketAddress: "0x962aba0A590981cf9c5B336aC34922c82f203165",
        purpose: "insight",
        snapshot: expect.objectContaining({
          kind: "asset",
          orderBook: [expect.objectContaining({ id: "1", sharePrice: "131.00" })],
        }),
      }),
    );
  });

  test("renders streaming, done, stale cache, and error states with stable disclaimer copy", () => {
    const streaming = renderToStaticMarkup(
      <InsightPanelView
        error={null}
        generatedAt={null}
        isStale={false}
        markdown="## Outlook\nPartial text"
        nowMs={NOW_MS}
        onGenerate={() => undefined}
        status="streaming"
      />,
    );
    const done = renderToStaticMarkup(
      <InsightPanelView
        error={null}
        generatedAt={NOW_MS - 2 * 60 * 60 * 1000}
        isStale={false}
        markdown="## Outlook\nCached text"
        nowMs={NOW_MS}
        onGenerate={() => undefined}
        status="done"
      />,
    );
    const stale = renderToStaticMarkup(
      <InsightPanelView
        error={null}
        generatedAt={NOW_MS - 60 * 60 * 1000}
        isStale={true}
        markdown="## Outlook\nOld text"
        nowMs={NOW_MS}
        onGenerate={() => undefined}
        status="done"
      />,
    );
    const failed = renderToStaticMarkup(
      <InsightPanelView
        error="Generation failed"
        generatedAt={null}
        isStale={false}
        markdown=""
        nowMs={NOW_MS}
        onGenerate={() => undefined}
        status="error"
      />,
    );

    expect(streaming).toContain("disabled=\"\"");
    expect(streaming).toContain("Generating");
    expect(streaming).toContain("Partial text");
    expect(done).toContain("Generated 2h ago");
    expect(done).toContain(">Refresh<");
    expect(done).toContain("max-w-[70ch]");
    expect(stale).toContain("Data changed");
    expect(stale).toContain(">Regenerate<");
    expect(failed).toContain("Generation failed");
    expect(failed).toContain(">Retry<");
    expect(streaming).toContain("AI-generated · testnet demo data · not financial advice");
    expect(done).toContain("AI-generated · testnet demo data · not financial advice");
    expect(stale).toContain("AI-generated · testnet demo data · not financial advice");
    expect(failed).toContain("AI-generated · testnet demo data · not financial advice");
  });

  test("mounts between the asset profile and sell orders on the asset page", () => {
    useAiGenerationMock.mockReturnValue(aiState());

    const html = renderToStaticMarkup(
      <AssetDetailView
        assetListings={[listing()]}
        assets={[assetView()]}
        events={[tradeEvent()]}
        id="15"
        isLoading={false}
        nowMs={NOW_MS}
      />,
    );

    expect(html.indexOf("ASSET DESCRIPTION")).toBeLessThan(html.indexOf("ASSET INSIGHT"));
    expect(html.indexOf("ASSET INSIGHT")).toBeLessThan(html.indexOf("SELL ORDERS"));
  });
});
