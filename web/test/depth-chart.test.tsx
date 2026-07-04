import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { DepthChartView } from "../components/asset/DepthChart";
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

describe("DepthChartView", () => {
  test("renders an empty depth state without SVG paths", () => {
    const html = renderToStaticMarkup(
      <DepthChartView book={buildOrderBook({ bids: [], listings: [] })} isLoading={false} />,
    );

    expect(html).toContain("Awaiting order book depth");
    expect(html).not.toContain("data-depth-side=");
  });

  test("renders only bid depth for a bid-only book", () => {
    const html = renderToStaticMarkup(
      <DepthChartView
        book={buildOrderBook({
          bids: [
            bid({ id: 1n, pricePerShare: unitPriceFromSharePriceCents(110_00n), remaining: 50n }),
            bid({ id: 2n, pricePerShare: unitPriceFromSharePriceCents(100_00n), remaining: 75n }),
          ],
          listings: [],
        })}
        isLoading={false}
      />,
    );

    expect(html).toContain("viewBox=\"0 0 320 160\"");
    expect(html).toContain("data-depth-side=\"bid\"");
    expect(html).not.toContain("data-depth-side=\"ask\"");
  });

  test("renders bid and ask depth paths for a two-sided book", () => {
    const html = renderToStaticMarkup(
      <DepthChartView
        book={buildOrderBook({
          bids: [
            bid({ id: 1n, pricePerShare: unitPriceFromSharePriceCents(110_00n), remaining: 50n }),
            bid({ id: 2n, pricePerShare: unitPriceFromSharePriceCents(100_00n), remaining: 75n }),
          ],
          listings: [
            listing({
              id: 3n,
              pricePerShare: unitPriceFromSharePriceCents(120_00n),
              remaining: 100n,
            }),
            listing({
              id: 4n,
              pricePerShare: unitPriceFromSharePriceCents(130_00n),
              remaining: 20n,
            }),
          ],
        })}
        isLoading={false}
      />,
    );

    expect(html).toContain("data-depth-side=\"bid\"");
    expect(html).toContain("data-depth-side=\"ask\"");
    expect(html).toContain("MID 115.00");
    expect(html).toContain("100.00");
    expect(html).toContain("130.00");
  });
});
