import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { BuyPanel } from "../components/asset/BuyPanel";
import { ListingsTable } from "../components/asset/ListingsTable";
import { ToastProvider } from "../components/ui/TxToast";
import type { AssetView } from "../lib/mappers";

const USDC = 10n ** 18n;

const mockState = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111" as `0x${string}`,
  balance: 1_000n * 10n ** 18n,
  buyListing: vi.fn(),
  buyPrimary: vi.fn(),
  cancelListing: vi.fn(),
  connect: vi.fn(),
  invalidateQueries: vi.fn(),
  isConnected: true,
  isCorrectChain: true,
  isListingsLoading: false,
  listings: [] as Array<{
    id: bigint;
    seller: `0x${string}`;
    tokenId: bigint;
    pricePerShare: bigint;
    remaining: bigint;
    isMine: boolean;
  }>,
  refetchBalance: vi.fn(),
  switchToArc: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockState.invalidateQueries,
  }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: mockState.address,
    isConnected: mockState.isConnected,
  }),
  useBalance: () => ({
    data: { value: mockState.balance },
    isLoading: false,
    refetch: mockState.refetchBalance,
  }),
  useConnect: () => ({
    connect: mockState.connect,
    connectors: [{ id: "injected", type: "injected" }],
    isPending: false,
  }),
}));

vi.mock("@/lib/hooks/useNetworkGuard", () => ({
  useNetworkGuard: () => ({
    isConnected: mockState.isConnected,
    isCorrectChain: mockState.isCorrectChain,
    switchToArc: mockState.switchToArc,
  }),
}));

vi.mock("@/lib/hooks/useBuyPrimary", () => ({
  useBuyPrimary: () => ({
    buy: mockState.buyPrimary,
    reset: vi.fn(),
    status: "idle",
  }),
}));

vi.mock("@/lib/hooks/useListings", () => ({
  useListings: () => ({
    isLoading: mockState.isListingsLoading,
    listings: mockState.listings,
  }),
}));

vi.mock("@/lib/hooks/useBuyListing", () => ({
  useBuyListing: () => ({
    buy: mockState.buyListing,
    reset: vi.fn(),
    status: "idle",
  }),
}));

vi.mock("@/lib/hooks/useCancelListing", () => ({
  useCancelListing: () => ({
    cancel: mockState.cancelListing,
    reset: vi.fn(),
    status: "idle",
  }),
}));

function renderWithToast(node: React.ReactNode): string {
  return renderToStaticMarkup(<ToastProvider>{node}</ToastProvider>);
}

function assetView(overrides: Partial<AssetView> = {}): AssetView {
  return {
    category: "treasuries",
    meta: {
      apyBps: 510,
      description: "Test asset",
      displayName: "US T-Bill 2026-Q3",
      docs: [],
      issuer: "Hadron Treasury Desk",
      slug: "t-bill-2026-q3",
      ticker: "TBILL",
    },
    name: "US T-BILL 2026-Q3",
    offering: {
      active: true,
      id: 1n,
      pricePerShare: 100n * USDC,
      remaining: 6_000n,
      tokenId: 1n,
    },
    tokenId: 1n,
    totalShares: 10_000n,
    ...overrides,
  };
}

describe("secondary listings detail surface", () => {
  beforeEach(() => {
    mockState.address = "0x1111111111111111111111111111111111111111";
    mockState.balance = 1_000n * USDC;
    mockState.isConnected = true;
    mockState.isCorrectChain = true;
    mockState.isListingsLoading = false;
    mockState.listings = [
      {
        id: 7n,
        isMine: false,
        pricePerShare: 99n * USDC,
        remaining: 7n,
        seller: "0x2222222222222222222222222222222222222222",
        tokenId: 1n,
      },
      {
        id: 3n,
        isMine: true,
        pricePerShare: 98n * USDC,
        remaining: 5n,
        seller: "0x1111111111111111111111111111111111111111",
        tokenId: 1n,
      },
    ];
  });

  test("renders compact sell orders sorted by price", () => {
    const html = renderWithToast(<ListingsTable tokenId={1n} />);

    expect(html).toContain("SELL ORDERS");
    expect(html).toContain("PRICE");
    expect(html).toContain("AMOUNT");
    expect(html).toContain("SELLER");
    expect(html.indexOf("98.00")).toBeLessThan(html.indexOf("99.00"));
    expect(html).toContain("cursor-pointer");
    expect(html).toContain("hover:bg-border/20");
    expect(html).toContain("0x1111");
    expect(html).toContain("You");
    expect(html).toContain("Cancel");
    expect(html).toContain("Buy");
    expect(html).not.toContain("PLACEHOLDER");
  });

  test("renders the expanded buy form with full amount default and remaining validation", () => {
    mockState.listings = [
      {
        id: 9n,
        isMine: false,
        pricePerShare: 98_250000000000000000n,
        remaining: 3n,
        seller: "0x2222222222222222222222222222222222222222",
        tokenId: 1n,
      },
    ];

    const fullAmountHtml = renderWithToast(
      <ListingsTable initialExpandedListingId={9n} tokenId={1n} />,
    );
    const invalidAmountHtml = renderWithToast(
      <ListingsTable initialAmountInput="4" initialExpandedListingId={9n} tokenId={1n} />,
    );

    expect(fullAmountHtml).toContain("value=\"3\"");
    expect(fullAmountHtml).toContain("294.75 USDC");
    expect(fullAmountHtml).toContain("CONFIRM BUY");
    expect(invalidAmountHtml).toContain("Exceeds available supply");
  });

  test("shows the lowest active sell order as the BuyPanel best ask", () => {
    mockState.listings = [
      {
        id: 12n,
        isMine: false,
        pricePerShare: 88n * USDC,
        remaining: 2n,
        seller: "0x3333333333333333333333333333333333333333",
        tokenId: 1n,
      },
    ];

    const html = renderWithToast(<BuyPanel asset={assetView()} />);

    expect(html).toContain("BEST ASK");
    expect(html).toContain("88.00");
  });
});
