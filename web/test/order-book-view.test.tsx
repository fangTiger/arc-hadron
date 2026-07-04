import { isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";
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

function unevenOrderBookFixture() {
  return buildOrderBook({
    listings: [
      listing({ id: 1n, pricePerShare: unitPriceFromSharePriceCents(120_00n), remaining: 100n }),
      listing({ id: 2n, pricePerShare: unitPriceFromSharePriceCents(130_00n), remaining: 20n }),
      listing({ id: 3n, pricePerShare: unitPriceFromSharePriceCents(140_00n), remaining: 30n }),
    ],
    bids: [bid({ id: 4n, pricePerShare: unitPriceFromSharePriceCents(110_00n), remaining: 50n })],
  });
}

interface TestElementProps {
  children?: ReactNode;
  className?: string;
  "data-column-role"?: string;
  "data-depth-bar"?: string;
  "data-depth-price"?: string;
  "data-empty-side"?: string;
  "data-header-side"?: string;
  "data-own-badge"?: string;
  "data-pair-index"?: string;
  "data-price"?: string;
  "data-row-side"?: string;
  onClick?: () => void;
  style?: CSSProperties;
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

function textContent(node: ReactNode): string {
  if (Array.isArray(node)) {
    return node.map(textContent).join("");
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (!isValidElement(node)) {
    return "";
  }

  const props = node.props as TestElementProps;

  if (typeof node.type === "function") {
    const render = node.type as (componentProps: TestElementProps) => ReactNode;

    return textContent(render(props));
  }

  return textContent(props.children);
}

describe("OrderBookView", () => {
  test("renders mirrored side headers and aligns best bid and ask in the top row", () => {
    const element = (
      <OrderBookView book={orderBookFixture()} isLoading={false} onSelectPrice={vi.fn()} />
    );
    const bidHeaders = collectElements(element, (props) => props["data-header-side"] === "bid");
    const askHeaders = collectElements(element, (props) => props["data-header-side"] === "ask");
    const topRow = collectElements(element, (props) => props["data-pair-index"] === "0")[0];

    expect(bidHeaders.map((header) => textContent(header))).toEqual(["TOTAL", "SIZE", "PRICE"]);
    expect(askHeaders.map((header) => textContent(header))).toEqual(["PRICE", "SIZE", "TOTAL"]);
    expect(textContent(topRow)).toContain("110.00");
    expect(textContent(topRow)).toContain("120.00");
  });

  test("anchors depth bars at the middle seam with cumulative widths and side colors", () => {
    const element = (
      <OrderBookView book={orderBookFixture()} isLoading={false} onSelectPrice={vi.fn()} />
    );
    const bidBar = collectElements(
      element,
      (props) =>
        props["data-depth-bar"] === "bid" &&
        props["data-depth-price"] === unitPriceFromSharePriceCents(110_00n).toString(),
    )[0];
    const askBar = collectElements(
      element,
      (props) =>
        props["data-depth-bar"] === "ask" &&
        props["data-depth-price"] === unitPriceFromSharePriceCents(120_00n).toString(),
    )[0];

    expect(bidBar.props.className).toContain("right-0");
    expect(bidBar.props.className).toContain("bg-up/15");
    expect(bidBar.props.style).toMatchObject({ width: "29.41%" });
    expect(askBar.props.className).toContain("left-0");
    expect(askBar.props.className).toContain("bg-down/15");
    expect(askBar.props.style).toMatchObject({ width: "88.24%" });
  });

  test("renders the center spread rail and degrades to an em dash for one-sided or empty books", () => {
    const twoSidedHtml = renderToStaticMarkup(
      <OrderBookView book={orderBookFixture()} isLoading={false} onSelectPrice={vi.fn()} />,
    );
    const bidOnlyHtml = renderToStaticMarkup(
      <OrderBookView
        book={buildOrderBook({
          bids: [bid({ id: 1n, pricePerShare: unitPriceFromSharePriceCents(110_00n), remaining: 50n })],
          listings: [],
        })}
        isLoading={false}
        onSelectPrice={vi.fn()}
      />,
    );
    const emptyHtml = renderToStaticMarkup(
      <OrderBookView book={buildOrderBook({ bids: [], listings: [] })} isLoading={false} />,
    );

    expect(twoSidedHtml).toContain("data-spread-state=\"ready\"");
    expect(twoSidedHtml).toContain("MID 115.00");
    expect(twoSidedHtml).toContain("SPREAD 10.00");
    expect(twoSidedHtml).toContain("8.7%");
    expect(bidOnlyHtml).toContain("data-spread-state=\"empty\"");
    expect(bidOnlyHtml).toContain(">—<");
    expect(emptyHtml).toContain("data-spread-state=\"empty\"");
    expect(emptyHtml).toContain(">—<");
  });

  test("pads the shorter side with empty rows to preserve rank alignment", () => {
    const element = (
      <OrderBookView book={unevenOrderBookFixture()} isLoading={false} onSelectPrice={vi.fn()} />
    );
    const rows = collectElements(element, (props) => props["data-pair-index"] !== undefined);
    const bidPlaceholders = collectElements(element, (props) => props["data-empty-side"] === "bid");

    expect(rows).toHaveLength(3);
    expect(bidPlaceholders).toHaveLength(2);
    expect(textContent(rows[0])).toContain("110.00");
    expect(textContent(rows[0])).toContain("120.00");
  });

  test("renders an empty state without paired order rows", () => {
    const html = renderToStaticMarkup(
      <OrderBookView book={buildOrderBook({ bids: [], listings: [] })} isLoading={false} />,
    );

    expect(html).toContain("No open orders");
    expect(html).not.toContain("data-pair-index=");
    expect(html).not.toContain("data-row-side=");
  });

  test("calls onSelectPrice with the selected side when a price row is clicked", () => {
    const onSelectPrice = vi.fn();
    const element = (
      <OrderBookView book={orderBookFixture()} isLoading={false} onSelectPrice={onSelectPrice} />
    );
    const askButton = collectElements(
      element,
      (props) =>
        props["data-row-side"] === "ask" &&
        props["data-price"] === unitPriceFromSharePriceCents(120_00n).toString(),
    )[0];
    const bidButton = collectElements(
      element,
      (props) =>
        props["data-row-side"] === "bid" &&
        props["data-price"] === unitPriceFromSharePriceCents(110_00n).toString(),
    )[0];

    (askButton.props as TestElementProps).onClick?.();
    (bidButton.props as TestElementProps).onClick?.();

    expect(onSelectPrice).toHaveBeenNthCalledWith(1, "ask");
    expect(onSelectPrice).toHaveBeenNthCalledWith(2, "bid");
  });

  test("renders own-order badges on both sides", () => {
    const element = (
      <OrderBookView book={orderBookFixture()} isLoading={false} onSelectPrice={vi.fn()} />
    );
    const badges = collectElements(element, (props) => props["data-own-badge"] === "true");

    expect(badges).toHaveLength(2);
    expect(badges.map((badge) => textContent(badge))).toEqual(["You", "You"]);
  });

  test("hides total columns below the sm breakpoint", () => {
    const element = (
      <OrderBookView book={orderBookFixture()} isLoading={false} onSelectPrice={vi.fn()} />
    );
    const totalColumns = collectElements(element, (props) => props["data-column-role"] === "total");

    expect(totalColumns.length).toBeGreaterThan(0);
    expect(
      totalColumns.every((column) =>
        String((column.props as TestElementProps).className).includes("max-sm:hidden"),
      ),
    ).toBe(true);
  });
});
