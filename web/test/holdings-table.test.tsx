import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { HoldingsTableView } from "../components/portfolio/HoldingsTable";
import { parseUsdc } from "../lib/format";
import type { Holding } from "../lib/mappers";

function holding(overrides: Partial<Holding> = {}): Holding {
  return {
    asset: {
      tokenId: 1n,
      name: "US T-BILL 2026-Q3",
      category: "treasuries",
      totalShares: 100_000n,
      meta: {
        slug: "t-bill-2026-q3",
        displayName: "US T-Bill 2026-Q3",
        ticker: "TBILL",
        description: "Test asset",
        issuer: "Hadron Treasury Desk",
        apyBps: 510,
        docs: [],
      },
      offering: {
        id: 1n,
        tokenId: 1n,
        pricePerShare: parseUsdc("2"),
        remaining: 80_000n,
        active: true,
      },
    },
    avgCost: parseUsdc("1.80"),
    balance: 12_345n,
    costBasis: parseUsdc("22221"),
    marketValue: parseUsdc("24690"),
    ...overrides,
  };
}

describe("HoldingsTableView", () => {
  test("renders table headers, asset row, formatted values, and resale entry", () => {
    const html = renderToStaticMarkup(
      <HoldingsTableView holdings={[holding()]} isConnected isLoading={false} />,
    );

    for (const label of ["ASSET", "SHARES", "MARKET VALUE", "AVG COST", "COST BASIS", "ACTIONS"]) {
      expect(html).toContain(label);
    }

    expect(html).toContain("US T-Bill 2026-Q3");
    expect(html).toContain("aria-label=\"Open US T-Bill 2026-Q3\"");
    expect(html).toContain("role=\"link\"");
    expect(html).toContain("cursor-pointer");
    expect(html).toContain("TREASURIES");
    expect(html).toContain("12,345");
    expect(html).toContain("24,690.00 USDC");
    expect(html).toContain("1.80 USDC");
    expect(html).toContain("22,221.00 USDC");
    expect(html).toContain("List for sale");
    expect(html).not.toContain("title=\"Secondary market opens in M3\"");
    expect(html).toContain("aria-label=\"Total market value 24,690.00 USDC\"");
  });

  test("renders a dash placeholder when cost is unknown", () => {
    const html = renderToStaticMarkup(
      <HoldingsTableView
        holdings={[
          holding({
            avgCost: null,
            costBasis: null,
          }),
        ]}
        isConnected
        isLoading={false}
      />,
    );

    expect((html.match(/—/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  test("renders next-step guidance for disconnected and empty states", () => {
    const disconnected = renderToStaticMarkup(
      <HoldingsTableView
        connectAction={<button type="button">CONNECT WALLET</button>}
        holdings={[]}
        isConnected={false}
        isLoading={false}
      />,
    );
    const empty = renderToStaticMarkup(
      <HoldingsTableView holdings={[]} isConnected isLoading={false} />,
    );

    expect(disconnected).toContain("Connect wallet to view holdings");
    expect(disconnected).toContain("CONNECT WALLET");
    expect(empty).toContain("No holdings yet");
    expect(empty).toContain("Browse market");
    expect(empty).toContain("href=\"/\"");
  });

  test("renders the error state instead of the empty state when reads fail", () => {
    const html = renderToStaticMarkup(
      <HoldingsTableView
        errorZh="Failed to load portfolio data from Arc RPC."
        holdings={[]}
        isConnected
        isLoading={false}
      />,
    );

    expect(html).toContain("Failed to load holdings");
    expect(html).not.toContain("No holdings yet");
  });
});
