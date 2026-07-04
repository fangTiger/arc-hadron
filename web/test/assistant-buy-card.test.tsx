import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { BuyConfirmCard, submitBuyConfirmation } from "../components/assistant/BuyConfirmCard";
import type { ResolveBuyResult } from "../lib/ai/resolveBuy";

const USDC = 10n ** 18n;

function unitPriceFromSharePriceCents(cents: bigint): bigint {
  return (cents * USDC) / 10_000n;
}

const fillablePrimary: ResolveBuyResult = {
  kind: "fillable",
  source: { type: "primary", offeringId: 7n },
  pricePerShare: unitPriceFromSharePriceCents(10_000n),
  requestedUnits: 250n,
  fillable: 250n,
  totalValue: 250n * unitPriceFromSharePriceCents(10_000n),
};

const fillableListing: ResolveBuyResult = {
  ...fillablePrimary,
  source: { type: "listing", listingId: 9n },
};

const partialListing: ResolveBuyResult = {
  kind: "partial",
  source: { type: "listing", listingId: 4n },
  pricePerShare: unitPriceFromSharePriceCents(9_000n),
  requestedUnits: 300n,
  fillable: 80n,
  totalValue: 80n * unitPriceFromSharePriceCents(9_000n),
};

function renderCard(resolution: ResolveBuyResult, overrides: Partial<Parameters<typeof BuyConfirmCard>[0]> = {}) {
  return renderToStaticMarkup(
    <BuyConfirmCard
      assetLabel="TBILL"
      errorText={undefined}
      isConnected
      isCorrectChain
      onBuyListing={() => undefined}
      onBuyPrimary={() => undefined}
      onConnect={() => undefined}
      onSwitchNetwork={() => undefined}
      resolution={resolution}
      status="idle"
      txHash={undefined}
      {...overrides}
    />,
  );
}

describe("BuyConfirmCard", () => {
  test("renders source, unit price, quantity, total, and protocol fee notice", () => {
    const html = renderCard(fillablePrimary);

    expect(html).toContain("BUY / TBILL");
    expect(html).toContain("PRIMARY");
    expect(html).toContain("100.00 USDC");
    expect(html).toContain("2.50");
    expect(html).toContain("250.00 USDC");
    expect(html).toContain("0.5% protocol fee");
    expect(html).toContain("Confirm");
  });

  test("renders max available downgrade when no single source can fill the request", () => {
    const html = renderCard(partialListing);

    expect(html).toContain("MAX AVAILABLE");
    expect(html).toContain("0.80");
    expect(html).toContain("Listing #4");
    expect(html).toContain("72.00 USDC");
  });

  test("submits primary and listing purchases with exact chain units and value", () => {
    const onBuyPrimary = vi.fn();
    const onBuyListing = vi.fn();

    submitBuyConfirmation({
      isConnected: true,
      isCorrectChain: true,
      onBuyListing,
      onBuyPrimary,
      onConnect: vi.fn(),
      onSwitchNetwork: vi.fn(),
      resolution: fillablePrimary,
      status: "idle",
    });
    submitBuyConfirmation({
      isConnected: true,
      isCorrectChain: true,
      onBuyListing,
      onBuyPrimary,
      onConnect: vi.fn(),
      onSwitchNetwork: vi.fn(),
      resolution: fillableListing,
      status: "idle",
    });

    expect(onBuyPrimary).toHaveBeenCalledWith(7n, 250n, 250n * unitPriceFromSharePriceCents(10_000n));
    expect(onBuyListing).toHaveBeenCalledWith(9n, 250n, 250n * unitPriceFromSharePriceCents(10_000n));
  });

  test("uses connect and network guards before attempting a write", () => {
    const onConnect = vi.fn();
    const onSwitchNetwork = vi.fn();
    const onBuyPrimary = vi.fn();
    const onBuyListing = vi.fn();

    submitBuyConfirmation({
      isConnected: false,
      isCorrectChain: true,
      onBuyListing,
      onBuyPrimary,
      onConnect,
      onSwitchNetwork,
      resolution: fillablePrimary,
      status: "idle",
    });
    submitBuyConfirmation({
      isConnected: true,
      isCorrectChain: false,
      onBuyListing,
      onBuyPrimary,
      onConnect,
      onSwitchNetwork,
      resolution: fillablePrimary,
      status: "idle",
    });

    expect(onConnect).toHaveBeenCalledOnce();
    expect(onSwitchNetwork).toHaveBeenCalledOnce();
    expect(onBuyPrimary).not.toHaveBeenCalled();
    expect(onBuyListing).not.toHaveBeenCalled();
  });
});
