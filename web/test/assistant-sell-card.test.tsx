import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { SellConfirmCard, submitSellConfirmation } from "../components/assistant/SellConfirmCard";

const USDC = 10n ** 18n;

function unitPriceFromSharePriceCents(cents: bigint): bigint {
  return (cents * USDC) / 10_000n;
}

function renderCard(overrides: Partial<Parameters<typeof SellConfirmCard>[0]> = {}) {
  return renderToStaticMarkup(
    <SellConfirmCard
      assetLabel="HADRON"
      balance={500n}
      errorText={undefined}
      isConnected
      isCorrectChain
      onConnect={() => undefined}
      onListForSale={() => undefined}
      onSwitchNetwork={() => undefined}
      price={2.1}
      quantity={2.5}
      status="idle"
      tokenId={7n}
      txHash={undefined}
      {...overrides}
    />,
  );
}

describe("SellConfirmCard", () => {
  test("renders quantity, unit price, estimated proceeds, and the two-step authorization flow", () => {
    const html = renderCard();

    expect(html).toContain("SELL / HADRON");
    expect(html).toContain("2.50");
    expect(html).toContain("2.10 USDC");
    expect(html).toContain("5.25 USDC");
    expect(html).toContain("TWO-STEP AUTHORIZATION");
    expect(html).toContain("setApprovalForAll");
    expect(html).toContain("list");
    expect(html).toContain("Confirm");
  });

  test("asks for a price when price is missing and does not submit", () => {
    const onListForSale = vi.fn();

    const html = renderCard({ onListForSale, price: undefined });
    submitSellConfirmation({
      balance: 500n,
      isConnected: true,
      isCorrectChain: true,
      onConnect: vi.fn(),
      onListForSale,
      onSwitchNetwork: vi.fn(),
      price: undefined,
      quantity: 2.5,
      status: "idle",
      tokenId: 7n,
    });

    expect(html).toContain("At what price per share?");
    expect(onListForSale).not.toHaveBeenCalled();
  });

  test("blocks submission when holdings are insufficient", () => {
    const onListForSale = vi.fn();

    const html = renderCard({ balance: 100n, onListForSale });
    submitSellConfirmation({
      balance: 100n,
      isConnected: true,
      isCorrectChain: true,
      onConnect: vi.fn(),
      onListForSale,
      onSwitchNetwork: vi.fn(),
      price: 2.1,
      quantity: 2.5,
      status: "idle",
      tokenId: 7n,
    });

    expect(html).toContain("Insufficient holdings");
    expect(onListForSale).not.toHaveBeenCalled();
  });

  test("uses wallet and network guards before attempting a listing", () => {
    const onConnect = vi.fn();
    const onSwitchNetwork = vi.fn();
    const onListForSale = vi.fn();

    submitSellConfirmation({
      balance: 500n,
      isConnected: false,
      isCorrectChain: true,
      onConnect,
      onListForSale,
      onSwitchNetwork,
      price: 2.1,
      quantity: 2.5,
      status: "idle",
      tokenId: 7n,
    });
    submitSellConfirmation({
      balance: 500n,
      isConnected: true,
      isCorrectChain: false,
      onConnect,
      onListForSale,
      onSwitchNetwork,
      price: 2.1,
      quantity: 2.5,
      status: "idle",
      tokenId: 7n,
    });

    expect(onConnect).toHaveBeenCalledOnce();
    expect(onSwitchNetwork).toHaveBeenCalledOnce();
    expect(onListForSale).not.toHaveBeenCalled();
  });

  test("submits listForSale with exact chain units after confirmation", () => {
    const onListForSale = vi.fn();

    submitSellConfirmation({
      balance: 500n,
      isConnected: true,
      isCorrectChain: true,
      onConnect: vi.fn(),
      onListForSale,
      onSwitchNetwork: vi.fn(),
      price: 2.1,
      quantity: 2.5,
      status: "idle",
      tokenId: 7n,
    });

    expect(onListForSale).toHaveBeenCalledWith(7n, 250n, unitPriceFromSharePriceCents(210n));
  });
});
