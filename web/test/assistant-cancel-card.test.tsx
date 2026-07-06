import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import {
  CancelDisambiguationCard,
  submitCancelOrder,
} from "../components/assistant/CancelDisambiguationCard";
import type { CancelableOrder } from "../lib/ai/resolveCancelable";

const USDC = 10n ** 18n;

function unitPriceFromSharePriceCents(cents: bigint): bigint {
  return (cents * USDC) / 10_000n;
}

const orders: CancelableOrder[] = [
  { side: "listing", id: 4n, price: unitPriceFromSharePriceCents(210n), size: 250n },
  { side: "bid", id: 9n, price: unitPriceFromSharePriceCents(190n), size: 125n },
];

function renderCard(overrides: Partial<Parameters<typeof CancelDisambiguationCard>[0]> = {}) {
  return renderToStaticMarkup(
    <CancelDisambiguationCard
      assetLabel="HADRON"
      errorText={undefined}
      isConnected
      isCorrectChain
      onCancelBid={() => undefined}
      onCancelListing={() => undefined}
      onConnect={() => undefined}
      onSwitchNetwork={() => undefined}
      orders={orders}
      status="idle"
      txHash={undefined}
      {...overrides}
    />,
  );
}

describe("CancelDisambiguationCard", () => {
  test("renders every cancelable listing and bid with side, price, size, and id", () => {
    const html = renderCard();

    expect(html).toContain("CANCEL / HADRON");
    expect(html).toContain("LISTING #4");
    expect(html).toContain("BID #9");
    expect(html).toContain("2.10 USDC");
    expect(html).toContain("1.90 USDC");
    expect(html).toContain("2.50");
    expect(html).toContain("1.25");
  });

  test("routes selected orders to listing and bid cancellation callbacks", () => {
    const onCancelListing = vi.fn();
    const onCancelBid = vi.fn();

    submitCancelOrder({
      isConnected: true,
      isCorrectChain: true,
      onCancelBid,
      onCancelListing,
      onConnect: vi.fn(),
      onSwitchNetwork: vi.fn(),
      order: orders[0],
      status: "idle",
    });
    submitCancelOrder({
      isConnected: true,
      isCorrectChain: true,
      onCancelBid,
      onCancelListing,
      onConnect: vi.fn(),
      onSwitchNetwork: vi.fn(),
      order: orders[1],
      status: "idle",
    });

    expect(onCancelListing).toHaveBeenCalledWith(4n);
    expect(onCancelBid).toHaveBeenCalledWith(9n);
  });

  test("renders a no-open-orders fallback and avoids submitting", () => {
    const onCancelListing = vi.fn();
    const onCancelBid = vi.fn();

    const html = renderCard({ onCancelBid, onCancelListing, orders: [] });
    submitCancelOrder({
      isConnected: true,
      isCorrectChain: true,
      onCancelBid,
      onCancelListing,
      onConnect: vi.fn(),
      onSwitchNetwork: vi.fn(),
      order: undefined,
      status: "idle",
    });

    expect(html).toContain("No open orders to cancel for HADRON");
    expect(onCancelListing).not.toHaveBeenCalled();
    expect(onCancelBid).not.toHaveBeenCalled();
  });

  test("uses wallet and network guards before attempting cancellation", () => {
    const onConnect = vi.fn();
    const onSwitchNetwork = vi.fn();
    const onCancelListing = vi.fn();
    const onCancelBid = vi.fn();

    submitCancelOrder({
      isConnected: false,
      isCorrectChain: true,
      onCancelBid,
      onCancelListing,
      onConnect,
      onSwitchNetwork,
      order: orders[0],
      status: "idle",
    });
    submitCancelOrder({
      isConnected: true,
      isCorrectChain: false,
      onCancelBid,
      onCancelListing,
      onConnect,
      onSwitchNetwork,
      order: orders[1],
      status: "idle",
    });

    expect(onConnect).toHaveBeenCalledOnce();
    expect(onSwitchNetwork).toHaveBeenCalledOnce();
    expect(onCancelListing).not.toHaveBeenCalled();
    expect(onCancelBid).not.toHaveBeenCalled();
  });

  test("prompts for a wallet connection before showing the no-orders fallback", () => {
    const html = renderCard({ isConnected: false, orders: [] });

    expect(html).toContain("Connect wallet to cancel orders");
    expect(html).toContain("Connect wallet");
    expect(html).not.toContain("No open orders to cancel");
  });
});
