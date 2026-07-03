import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { HoldingsTable, HoldingsTableView } from "../components/portfolio/HoldingsTable";
import { parseUsdc } from "../lib/format";
import type { Holding } from "../lib/mappers";

const portfolioMockState = vi.hoisted(() => ({
  claim: vi.fn(),
  claimStatus: "idle",
  errorZh: undefined as string | undefined,
  holdings: [] as Holding[],
  isConnected: true,
  isCorrectChain: true,
  isLoading: false,
  pendingByTokenId: new Map<bigint, bigint>(),
  pendingTokenIds: [] as bigint[],
  push: vi.fn(),
  switchToArc: vi.fn(),
  totalPending: 0n,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: portfolioMockState.push,
  }),
}));

vi.mock("@/components/layout/WalletButton", () => ({
  WalletButton: () => <button type="button">CONNECT WALLET</button>,
}));

vi.mock("@/components/asset/BidsTable", () => ({
  BidsTable: () => <section>BUY ORDERS</section>,
}));

vi.mock("@/components/portfolio/ListForSaleModal", () => ({
  ListForSaleModal: () => <section>LIST MODAL</section>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    isConnected: portfolioMockState.isConnected,
  }),
}));

vi.mock("@/lib/hooks/useNetworkGuard", () => ({
  useNetworkGuard: () => ({
    isCorrectChain: portfolioMockState.isCorrectChain,
    switchToArc: portfolioMockState.switchToArc,
  }),
}));

vi.mock("@/lib/hooks/usePortfolio", () => ({
  usePortfolio: () => ({
    errorZh: portfolioMockState.errorZh,
    holdings: portfolioMockState.holdings,
    isLoading: portfolioMockState.isLoading,
  }),
}));

vi.mock("@/lib/hooks/useYield", () => ({
  useClaimYield: () => ({
    claim: portfolioMockState.claim,
    claimBatch: vi.fn(),
    errorText: undefined,
    reset: vi.fn(),
    status: portfolioMockState.claimStatus,
    txHash: undefined,
  }),
  usePendingYield: (tokenIds: bigint[]) => {
    portfolioMockState.pendingTokenIds = tokenIds;

    return {
      isLoading: false,
      pending: tokenIds.map((tokenId) => ({
        amount: portfolioMockState.pendingByTokenId.get(tokenId) ?? 0n,
        tokenId,
      })),
      pendingByTokenId: portfolioMockState.pendingByTokenId,
      totalPending: portfolioMockState.totalPending,
    };
  },
}));

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
        pricePerShare: parseUsdc("0.02"),
        remaining: 8_000_000n,
        active: true,
      },
    },
    avgCost: parseUsdc("0.018"),
    balance: 12_345n,
    costBasis: parseUsdc("222.21"),
    marketValue: parseUsdc("246.90"),
    ...overrides,
  };
}

describe("HoldingsTableView", () => {
  beforeEach(() => {
    portfolioMockState.claim = vi.fn();
    portfolioMockState.claimStatus = "idle";
    portfolioMockState.errorZh = undefined;
    portfolioMockState.holdings = [];
    portfolioMockState.isConnected = true;
    portfolioMockState.isCorrectChain = true;
    portfolioMockState.isLoading = false;
    portfolioMockState.pendingByTokenId = new Map();
    portfolioMockState.pendingTokenIds = [];
    portfolioMockState.push = vi.fn();
    portfolioMockState.switchToArc = vi.fn();
    portfolioMockState.totalPending = 0n;
  });

  test("renders table headers, asset row, formatted values, and resale entry", () => {
    const html = renderToStaticMarkup(
      <HoldingsTableView holdings={[holding()]} isConnected isLoading={false} />,
    );

    for (const label of ["ASSET", "SHARES", "MARKET VALUE", "AVG COST", "COST BASIS", "PENDING YIELD", "ACTIONS"]) {
      expect(html).toContain(label);
    }

    expect(html).toContain("US T-Bill 2026-Q3");
    expect(html).toContain("aria-label=\"Open US T-Bill 2026-Q3\"");
    expect(html).toContain("role=\"link\"");
    expect(html).toContain("cursor-pointer");
    expect(html).toContain("TREASURIES");
    expect(html).toContain("123.45");
    expect(html).toContain("246.90 USDC");
    expect(html).toContain("1.80 USDC");
    expect(html).toContain("222.21 USDC");
    expect(html).toContain("List for sale");
    expect(html).toContain("Sell to bid");
    expect(html).not.toContain("title=\"Secondary market opens in M3\"");
    expect(html).toContain("aria-label=\"Total market value 246.90 USDC\"");
  });

  test("renders pending yield summary and row-level claim controls", () => {
    const html = renderToStaticMarkup(
      <HoldingsTableView
        holdings={[
          holding(),
          holding({
            asset: {
              ...holding().asset,
              tokenId: 2n,
              meta: {
                ...holding().asset.meta,
                displayName: "Private Credit Note",
                ticker: "PCRED",
              },
            },
          }),
        ]}
        isConnected
        isLoading={false}
        pendingYieldByTokenId={new Map([
          [1n, parseUsdc("3.25")],
          [2n, 0n],
        ])}
        totalPendingYield={parseUsdc("3.25")}
      />,
    );

    expect(html).toContain("TOTAL PENDING YIELD");
    expect(html).toContain("3.25 USDC");
    expect(html).toContain("PENDING YIELD");
    expect(html).toContain("0.00 USDC");
    expect(html).toContain("Claim");
    expect(html).toContain("disabled=\"\"");
  });

  test("batches pending yield reads for every current holding", () => {
    portfolioMockState.holdings = [
      holding(),
      holding({
        asset: {
          ...holding().asset,
          tokenId: 2n,
        },
      }),
    ];
    portfolioMockState.pendingByTokenId = new Map([
      [1n, parseUsdc("1.20")],
      [2n, parseUsdc("0.05")],
    ]);
    portfolioMockState.totalPending = parseUsdc("1.25");

    const html = renderToStaticMarkup(<HoldingsTable />);

    expect(portfolioMockState.pendingTokenIds).toEqual([1n, 2n]);
    expect(html).toContain("TOTAL PENDING YIELD");
    expect(html).toContain("1.25 USDC");
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
