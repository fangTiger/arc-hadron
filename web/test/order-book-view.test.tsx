import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { OrderBookView } from "../components/asset/OrderBook";
import { buildOrderBook } from "../lib/orderBook";
import type { BidView } from "../lib/bids";
import type { ListingView } from "../lib/listing";

const USDC = 10n ** 18n;

function unitPriceFromSharePriceCents(cents: bigint): bigint {
  return (cents * USDC) / 10_000n;
}

function bid(overrides: Partial<BidView> = {}): BidView {
  return {
    active: true,
    bidder: "0x1000000000000000000000000000000000000001",
    id: 1n,
    isOwn: false,
    pricePerShare: unitPriceFromSharePriceCents(110_00n),
    remaining: 50n,
    tokenId: 1n,
    ...overrides,
  };
}

function listing(overrides: Partial<ListingView> = {}): ListingView {
  return {
    id: 1n,
    isMine: false,
    pricePerShare: unitPriceFromSharePriceCents(120_00n),
    remaining: 100n,
    seller: "0x2000000000000000000000000000000000000002",
    tokenId: 1n,
    ...overrides,
  };
}

function orderBookFixture() {
  return buildOrderBook({
    listings: [
      listing({ id: 1n, pricePerShare: unitPriceFromSharePriceCents(120_00n), remaining: 100n }),
      listing({
        id: 2n,
        isMine: true,
        pricePerShare: unitPriceFromSharePriceCents(120_00n),
        remaining: 50n,
      }),
      listing({ id: 3n, pricePerShare: unitPriceFromSharePriceCents(130_00n), remaining: 20n }),
    ],
    bids: [
      bid({ id: 4n, pricePerShare: unitPriceFromSharePriceCents(110_00n), remaining: 50n }),
      bid({
        id: 5n,
        isOwn: true,
        pricePerShare: unitPriceFromSharePriceCents(100_00n),
        remaining: 75n,
      }),
    ],
  });
}

interface TestElementProps {
  children?: ReactNode;
  "data-price"?: string;
  "data-side"?: string;
  onClick?: () => void;
}

function collectElements(node: ReactNode, predicate: (props: TestElementProps) => boolean): ReactElement[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => collectElements(child, predicate));
  }

  if (!isValidElement(node)) {
    return [];
  }

  const props = node.props as TestElementProps;

  if (typeof node.type === "function") {
    const render = node.type as (componentProps: TestElementProps) => ReactNode;

    return collectElements(render(props), predicate);
  }

  const matches = predicate(props) ? [node] : [];

  return [...matches, ...collectElements(props.children, predicate)];
}

describe("OrderBookView", () => {
  test("renders asks, bids, spread, own badges, and cumulative width bars", () => {
    const html = renderToStaticMarkup(
      <OrderBookView book={orderBookFixture()} isLoading={false} onSelectPrice={vi.fn()} />,
    );

    expect(html).toContain("ORDER BOOK");
    expect(html.match(/data-side="ask"/g)).toHaveLength(2);
    expect(html.match(/data-side="bid"/g)).toHaveLength(2);
    expect(html).toContain("MID 115.00");
    expect(html).toContain("SPREAD 10.00 (8.7%)");
    expect(html.match(/>You</g)).toHaveLength(2);
    expect(html).toContain("style=\"width:88.24%\"");
    expect(html).toContain("style=\"width:73.53%\"");
  });

  test("calls onSelectPrice with the selected side when a price row is clicked", () => {
    const onSelectPrice = vi.fn();
    const element = (
      <OrderBookView book={orderBookFixture()} isLoading={false} onSelectPrice={onSelectPrice} />
    );
    const askButton = collectElements(
      element,
      (props) =>
        props["data-side"] === "ask" &&
        props["data-price"] === unitPriceFromSharePriceCents(120_00n).toString(),
    )[0];
    const bidButton = collectElements(
      element,
      (props) =>
        props["data-side"] === "bid" &&
        props["data-price"] === unitPriceFromSharePriceCents(110_00n).toString(),
    )[0];

    (askButton.props as TestElementProps).onClick?.();
    (bidButton.props as TestElementProps).onClick?.();

    expect(onSelectPrice).toHaveBeenNthCalledWith(1, "ask");
    expect(onSelectPrice).toHaveBeenNthCalledWith(2, "bid");
  });

  test("renders an empty state without order rows", () => {
    const html = renderToStaticMarkup(
      <OrderBookView
        book={buildOrderBook({ bids: [], listings: [] })}
        isLoading={false}
        onSelectPrice={vi.fn()}
      />,
    );

    expect(html).toContain("No open orders");
    expect(html).not.toContain("data-side=\"ask\"");
    expect(html).not.toContain("data-side=\"bid\"");
  });
});
