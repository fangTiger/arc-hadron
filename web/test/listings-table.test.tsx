import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { BidsTable } from "../components/asset/BidsTable";
import { BuyPanel } from "../components/asset/BuyPanel";
import { ListingsTable } from "../components/asset/ListingsTable";
import { PlaceBidPanel } from "../components/asset/PlaceBidPanel";
import { ToastProvider } from "../components/ui/TxToast";
import type { BidView } from "../lib/hooks/useBids";
import type { AssetView } from "../lib/mappers";

const USDC = 10n ** 18n;

function unitPriceFromSharePriceCents(cents: bigint): bigint {
  return (cents * USDC) / 10_000n;
}

const mockState = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111" as `0x${string}`,
  balance: 1_000n * 10n ** 18n,
  bids: [] as BidView[],
  buyListing: vi.fn(),
  buyPrimary: vi.fn(),
  cancelListing: vi.fn(),
  connect: vi.fn(),
  fillBid: vi.fn(),
  fillBidStatus: "idle",
  invalidateQueries: vi.fn(),
  isBidsLoading: false,
  listForSale: vi.fn(),
  listForSaleStatus: "idle",
  listForSaleApproveTxHash: undefined as `0x${string}` | undefined,
  listForSaleErrorText: undefined as string | undefined,
  listForSaleTxHash: undefined as `0x${string}` | undefined,
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
  placeBid: vi.fn(),
  placeBidErrorText: undefined as string | undefined,
  placeBidStatus: "idle",
  placeBidTxHash: undefined as `0x${string}` | undefined,
  refetchBalance: vi.fn(),
  tokenBalance: 0n,
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
  useReadContract: () => ({
    data: mockState.tokenBalance,
    isLoading: false,
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

vi.mock("@/lib/hooks/useListForSale", () => ({
  useListForSale: () => ({
    approveTxHash: mockState.listForSaleApproveTxHash,
    errorText: mockState.listForSaleErrorText,
    listForSale: mockState.listForSale,
    reset: vi.fn(),
    status: mockState.listForSaleStatus,
    txHash: mockState.listForSaleTxHash,
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

vi.mock("@/lib/hooks/useBids", () => ({
  useBids: () => ({
    bids: mockState.bids,
    isLoading: mockState.isBidsLoading,
  }),
}));

vi.mock("@/lib/hooks/useFillBid", () => ({
  useFillBid: () => ({
    approveTxHash: undefined,
    errorText: undefined,
    fillBid: mockState.fillBid,
    reset: vi.fn(),
    status: mockState.fillBidStatus,
    txHash: undefined,
  }),
}));

vi.mock("@/lib/hooks/usePlaceBid", () => ({
  usePlaceBid: () => ({
    errorText: mockState.placeBidErrorText,
    placeBid: mockState.placeBid,
    reset: vi.fn(),
    status: mockState.placeBidStatus,
    txHash: mockState.placeBidTxHash,
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
      pricePerShare: unitPriceFromSharePriceCents(10_000n),
      remaining: 600_000n,
      tokenId: 1n,
    },
    tokenId: 1n,
    totalShares: 1_000_000n,
    ...overrides,
  };
}

describe("secondary listings detail surface", () => {
  beforeEach(() => {
    mockState.address = "0x1111111111111111111111111111111111111111";
    mockState.balance = 1_000n * USDC;
    mockState.bids = [];
    mockState.fillBid = vi.fn();
    mockState.fillBidStatus = "idle";
    mockState.isBidsLoading = false;
    mockState.isConnected = true;
    mockState.isCorrectChain = true;
    mockState.isListingsLoading = false;
    mockState.listForSale = vi.fn();
    mockState.listForSaleStatus = "idle";
    mockState.listForSaleApproveTxHash = undefined;
    mockState.listForSaleErrorText = undefined;
    mockState.listForSaleTxHash = undefined;
    mockState.placeBid = vi.fn();
    mockState.placeBidErrorText = undefined;
    mockState.placeBidStatus = "idle";
    mockState.placeBidTxHash = undefined;
    mockState.tokenBalance = 1_234n;
    mockState.listings = [
      {
        id: 7n,
        isMine: false,
        pricePerShare: unitPriceFromSharePriceCents(9_900n),
        remaining: 700n,
        seller: "0x2222222222222222222222222222222222222222",
        tokenId: 1n,
      },
      {
        id: 3n,
        isMine: true,
        pricePerShare: unitPriceFromSharePriceCents(9_800n),
        remaining: 500n,
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
        pricePerShare: unitPriceFromSharePriceCents(9_825n),
        remaining: 300n,
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
    expect(fullAmountHtml).toContain("inputMode=\"decimal\"");
    expect(fullAmountHtml).toContain("3.00 SHARES");
    expect(fullAmountHtml).toContain("294.75 USDC");
    expect(fullAmountHtml).toContain("CONFIRM BUY");
    expect(invalidAmountHtml).toContain("Exceeds available supply");
  });

  test("shows the lowest active sell order as the BuyPanel best ask", () => {
    mockState.listings = [
      {
        id: 12n,
        isMine: false,
        pricePerShare: unitPriceFromSharePriceCents(8_800n),
        remaining: 200n,
        seller: "0x3333333333333333333333333333333333333333",
        tokenId: 1n,
      },
    ];

    const html = renderWithToast(<BuyPanel asset={assetView()} />);

    expect(html).toContain("BEST ASK");
    expect(html).toContain("88.00");
  });

  test("renders the BuyPanel trade tabs with BUY selected by default", () => {
    const html = renderWithToast(<BuyPanel asset={assetView()} />);

    expect(html).toContain("role=\"tablist\"");
    expect(html).toContain(">BUY<");
    expect(html).toContain(">SELL<");
    expect(html).toContain("aria-selected=\"true\"");
    expect(html).toContain("PRIMARY OFFERING");
    expect(html).toContain("BEST ASK");
  });

  test("renders the Sell tab with wallet holdings, MAX, best ask price, and estimated proceeds", () => {
    mockState.listings = [
      {
        id: 12n,
        isMine: false,
        pricePerShare: unitPriceFromSharePriceCents(8_800n),
        remaining: 200n,
        seller: "0x3333333333333333333333333333333333333333",
        tokenId: 1n,
      },
    ];
    mockState.tokenBalance = 1_234n;

    const html = renderWithToast(<BuyPanel asset={assetView()} initialMode="sell" />);

    expect(html).toContain("aria-selected=\"true\"");
    expect(html).toContain("YOU HOLD 12.34 SHARES");
    expect(html).toContain("value=\"12.34\"");
    expect(html).toContain(">MAX<");
    expect(html).toContain("PRICE (USDC)");
    expect(html).toContain("value=\"88\"");
    expect(html).toContain("GROSS TOTAL");
    expect(html).toContain("1,085.92 USDC");
    expect(html).toContain("1,080.49 USDC");
    expect(html).toContain("0.5% protocol fee");
  });

  test("falls back to the primary issue price when the Sell tab has no active asks", () => {
    mockState.listings = [];
    mockState.tokenBalance = 500n;

    const html = renderWithToast(<BuyPanel asset={assetView()} initialMode="sell" />);

    expect(html).toContain("YOU HOLD 5.00 SHARES");
    expect(html).toContain("value=\"100\"");
  });

  test("shows the disconnected Sell tab action as connect wallet", () => {
    mockState.isConnected = false;

    const html = renderWithToast(<BuyPanel asset={assetView()} initialMode="sell" />);

    expect(html).toContain("CONNECT WALLET");
    expect(html).not.toContain("List shares");
  });

  test("shows an empty Sell tab state when the wallet does not hold the asset", () => {
    mockState.tokenBalance = 0n;

    const html = renderWithToast(<BuyPanel asset={assetView()} initialMode="sell" />);

    expect(html).toContain("You do not hold this asset");
    expect(html).not.toContain("List shares");
  });

  test("renders compact buy orders with bidder identity, own badge, and fill action", () => {
    mockState.tokenBalance = 500n;
    mockState.bids = [
      {
        active: true,
        bidder: "0x2222222222222222222222222222222222222222",
        id: 5n,
        isOwn: false,
        pricePerShare: unitPriceFromSharePriceCents(9_700n),
        remaining: 300n,
        tokenId: 1n,
      },
      {
        active: true,
        bidder: mockState.address,
        id: 2n,
        isOwn: true,
        pricePerShare: unitPriceFromSharePriceCents(9_600n),
        remaining: 125n,
        tokenId: 1n,
      },
    ];

    const html = renderWithToast(<BidsTable tokenId={1n} />);

    expect(html).toContain("BUY ORDERS");
    expect(html).toContain("BIDDER");
    expect(html.indexOf("97.00")).toBeLessThan(html.indexOf("96.00"));
    expect(html).toContain("3.00");
    expect(html).toContain("0x2222");
    expect(html).toContain("You");
    expect(html).toContain("Fill");
  });

  test("renders the expanded fill form with full amount default and holding validation", () => {
    mockState.bids = [
      {
        active: true,
        bidder: "0x2222222222222222222222222222222222222222",
        id: 9n,
        isOwn: false,
        pricePerShare: unitPriceFromSharePriceCents(9_825n),
        remaining: 300n,
        tokenId: 1n,
      },
    ];
    mockState.tokenBalance = 500n;

    const fullAmountHtml = renderWithToast(
      <BidsTable initialExpandedBidId={9n} tokenId={1n} />,
    );
    mockState.tokenBalance = 0n;
    const noHoldingHtml = renderWithToast(
      <BidsTable initialExpandedBidId={9n} tokenId={1n} />,
    );

    expect(fullAmountHtml).toContain("value=\"3\"");
    expect(fullAmountHtml).toContain("inputMode=\"decimal\"");
    expect(fullAmountHtml).toContain("294.75 USDC");
    expect(fullAmountHtml).toContain("CONFIRM FILL");
    expect(noHoldingHtml).toContain("No shares available to fill this bid");
    expect(noHoldingHtml).toContain("disabled=\"\"");
  });

  test("renders the place bid panel with escrow preview and balance validation", () => {
    mockState.balance = 500n * USDC;

    const fundedHtml = renderWithToast(
      <PlaceBidPanel asset={assetView()} initialAmountInput="2.5" initialPriceInput="96" />,
    );
    mockState.balance = 100n * USDC;
    const insufficientHtml = renderWithToast(
      <PlaceBidPanel asset={assetView()} initialAmountInput="2.5" initialPriceInput="96" />,
    );

    expect(fundedHtml).toContain("PLACE BID");
    expect(fundedHtml).toContain("BID PRICE (USDC)");
    expect(fundedHtml).toContain("ESCROW TOTAL");
    expect(fundedHtml).toContain("240.00 USDC");
    expect(fundedHtml).toContain("500.00 USDC");
    expect(insufficientHtml).toContain("Insufficient USDC balance");
    expect(insufficientHtml).toContain("disabled=\"\"");
  });
});
