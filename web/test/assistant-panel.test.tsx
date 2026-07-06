import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AssistantPanelView, type AssistantCard } from "../components/assistant/AssistantPanel";

const USDC = 10n ** 18n;

function unitPriceFromSharePriceCents(cents: bigint): bigint {
  return (cents * USDC) / 10_000n;
}

function renderPanel(cards: AssistantCard[]): string {
  return renderToStaticMarkup(
    <AssistantPanelView
      cards={cards}
      defaultAssetLabel="TBILL"
      errorText={null}
      inputValue=""
      isOpen
      isSubmitting={false}
      onClose={() => undefined}
      onInputChange={() => undefined}
      onSubmit={() => undefined}
    />,
  );
}

describe("AssistantPanelView", () => {
  test("renders the panel shell and deterministic price and depth cards", () => {
    const html = renderPanel([
      {
        type: "price",
        assetLabel: "TBILL",
        primaryPrice: unitPriceFromSharePriceCents(12_500n),
        bestAsk: unitPriceFromSharePriceCents(12_700n),
        bestBid: unitPriceFromSharePriceCents(12_200n),
      },
      {
        type: "depth",
        assetLabel: "TBILL",
        asks: [{ price: unitPriceFromSharePriceCents(12_700n), size: 250n }],
        bids: [{ price: unitPriceFromSharePriceCents(12_200n), size: 175n }],
      },
    ]);

    expect(html).toContain("NL ASSISTANT");
    expect(html).toContain("CONTEXT TBILL");
    expect(html).toContain("Ask about prices, depth, holdings, yield, or buying.");
    expect(html).toContain("PRICE / TBILL");
    expect(html).toContain("PRIMARY");
    expect(html).toContain("125.00 USDC");
    expect(html).toContain("LOWEST ASK");
    expect(html).toContain("127.00 USDC");
    expect(html).toContain("HIGHEST BID");
    expect(html).toContain("122.00 USDC");
    expect(html).toContain("DEPTH / TBILL");
    expect(html).toContain("ASKS");
    expect(html).toContain("2.50");
    expect(html).toContain("BIDS");
    expect(html).toContain("1.75");
  });

  test("renders holdings and yield cards from deterministic values", () => {
    const html = renderPanel([
      {
        type: "holdings",
        isConnected: false,
        rows: [],
      },
      {
        type: "yield",
        isConnected: true,
        totalPending: 3n * USDC,
        rows: [{ assetLabel: "TBILL", pending: 3n * USDC }],
      },
    ]);

    expect(html).toContain("Connect wallet to view your holdings");
    expect(html).toContain("YIELD");
    expect(html).toContain("UNCLAIMED TOTAL");
    expect(html).toContain("3.00 USDC");
    expect(html).toContain("TBILL");
  });

  test("renders unknown and asset clarification cards without transaction actions", () => {
    const html = renderPanel([
      { type: "unknown" },
      {
        type: "asset_ambiguous",
        query: "treasury",
        candidates: [
          { tokenId: 1n, label: "Hadron Alpha Treasury", ticker: "HADRON" },
          { tokenId: 4n, label: "Hadron Beta Treasury", ticker: "HBETA" },
        ],
      },
      { type: "asset_not_found", query: "banana futures" },
    ]);

    expect(html).toContain("I can help with prices, depth, your holdings, yield, and buying.");
    expect(html).toContain("CLARIFY ASSET");
    expect(html).toContain("Hadron Alpha Treasury");
    expect(html).toContain("TOKEN #1");
    expect(html).toContain("Asset not found");
    expect(html).not.toContain("Confirm");
  });

  test("renders sell, cancel, and claim write-action cards", () => {
    const html = renderPanel([
      {
        type: "sell",
        assetLabel: "HADRON",
        balance: 500n,
        errorText: undefined,
        isConnected: true,
        isCorrectChain: true,
        onConnect: () => undefined,
        onListForSale: () => undefined,
        onSwitchNetwork: () => undefined,
        price: 2.1,
        quantity: 2.5,
        status: "idle",
        tokenId: 7n,
        txHash: undefined,
      },
      {
        type: "cancel",
        assetLabel: "HADRON",
        errorText: undefined,
        isConnected: true,
        isCorrectChain: true,
        onCancelBid: () => undefined,
        onCancelListing: () => undefined,
        onConnect: () => undefined,
        onSwitchNetwork: () => undefined,
        orders: [
          { side: "listing", id: 4n, price: unitPriceFromSharePriceCents(210n), size: 250n },
          { side: "bid", id: 9n, price: unitPriceFromSharePriceCents(190n), size: 125n },
        ],
        status: "idle",
        txHash: undefined,
      },
      {
        type: "claim",
        entries: [{ tokenId: 7n, assetLabel: "HADRON", amount: 250n * (USDC / 100n) }],
        errorText: undefined,
        isConnected: true,
        isCorrectChain: true,
        mode: "single",
        onClaim: () => undefined,
        onClaimBatch: () => undefined,
        onConnect: () => undefined,
        onSwitchNetwork: () => undefined,
        status: "idle",
        txHash: undefined,
      },
    ]);

    expect(html).toContain("SELL / HADRON");
    expect(html).toContain("CANCEL / HADRON");
    expect(html).toContain("LISTING #4");
    expect(html).toContain("BID #9");
    expect(html).toContain("CLAIM / HADRON");
    expect(html).toContain("2.50 USDC");
  });
});
