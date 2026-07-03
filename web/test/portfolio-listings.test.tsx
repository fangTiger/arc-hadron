import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import {
  defaultListingAmountInput,
  formatListingPriceInput,
  ListForSaleModalView,
  listingProceeds,
  type ListForSaleModalViewProps,
} from "../components/portfolio/ListForSaleModal";
import { MyListingsView, type MyListingsViewProps } from "../components/portfolio/MyListings";
import { parseUsdc } from "../lib/format";
import type { ListingView } from "../lib/hooks/useListings";
import type { Holding } from "../lib/mappers";

const HASH =
  "0x00000000000000000000000000000000000000000000000000000000000000ab";

function holding(overrides: Partial<Holding> = {}): Holding {
  return {
    asset: {
      tokenId: 7n,
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
        tokenId: 7n,
        pricePerShare: parseUsdc("0.02"),
        remaining: 8_000_000n,
        active: true,
      },
    },
    avgCost: parseUsdc("0.018"),
    balance: 1_200n,
    costBasis: parseUsdc("21.60"),
    marketValue: parseUsdc("24"),
    ...overrides,
  };
}

function listing(overrides: Partial<ListingView> = {}): ListingView {
  return {
    id: 3n,
    isMine: true,
    pricePerShare: parseUsdc("0.025"),
    remaining: 400n,
    seller: "0x1111111111111111111111111111111111111111",
    tokenId: 7n,
    ...overrides,
  };
}

function listModalProps(
  overrides: Partial<ListForSaleModalViewProps> = {},
): ListForSaleModalViewProps {
  return {
    amountInput: "3",
    explorerUrl: "https://testnet.arcscan.app/",
    holding: holding(),
    onAmountChange: () => undefined,
    onClose: () => undefined,
    onSubmit: () => undefined,
    priceInput: "2.50",
    status: "idle",
    ...overrides,
  };
}

function myListingsProps(overrides: Partial<MyListingsViewProps> = {}): MyListingsViewProps {
  return {
    assetNameByTokenId: new Map([[7n, "US T-Bill 2026-Q3"]]),
    cancellingId: null,
    errorText: undefined,
    isLoading: false,
    listings: [listing()],
    onAskCancel: () => undefined,
    onCancel: () => undefined,
    onDismissConfirm: () => undefined,
    status: "idle",
    txHash: undefined,
    ...overrides,
  };
}

describe("ListForSaleModalView", () => {
  test("renders validation, gross total, protocol-fee net proceeds, and submit state", () => {
    const html = renderToStaticMarkup(<ListForSaleModalView {...listModalProps()} />);

    expect(html).toContain("LIST FOR SALE");
    expect(html).toContain("US T-Bill 2026-Q3");
    expect(html).toContain("BALANCE 12.00");
    expect(html).toContain("inputMode=\"decimal\"");
    expect(html).toContain(">MAX<");
    expect(html).toContain("7.50 USDC");
    expect(html).toContain("7.46 USDC");
    expect(html).toContain("0.5% protocol fee");
    expect(html).toContain("Approve");
    expect(html).toContain("List");
    expect(html).toContain(">List shares<");
  });

  test("shows realtime validation errors and disables the submit button", () => {
    const html = renderToStaticMarkup(
      <ListForSaleModalView {...listModalProps({ amountInput: "13" })} />,
    );

    expect(html).toContain("Exceeds your balance");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("—");
  });

  test("renders approve and list explorer transaction links", () => {
    const html = renderToStaticMarkup(
      <ListForSaleModalView
        {...listModalProps({
          approveTxHash: HASH,
          status: "pending",
          txHash: HASH,
        })}
      />,
    );

    expect(html).toContain(`href="https://testnet.arcscan.app/tx/${HASH}"`);
    expect(html).toContain("0x0000…00ab");
  });

  test("computes seller proceeds in bigint space after the protocol fee", () => {
    expect(listingProceeds(parseUsdc("7.50"))).toBe(parseUsdc("7.4625"));
  });

  test("formats default price inputs without losing USDC wei precision", () => {
    expect(formatListingPriceInput(parseUsdc("0.02"))).toBe("2");
    expect(formatListingPriceInput(parseUsdc("0.021234567891234567"))).toBe(
      "2.1234567891234567",
    );
  });

  test("defaults the modal amount input to the full holding balance", () => {
    expect(defaultListingAmountInput(holding().balance)).toBe("12");
    expect(defaultListingAmountInput(1_234n)).toBe("12.34");
  });
});

describe("MyListingsView", () => {
  test("renders an empty active listings state", () => {
    const html = renderToStaticMarkup(
      <MyListingsView {...myListingsProps({ listings: [] })} />,
    );

    expect(html).toContain("MY LISTINGS");
    expect(html).toContain("No active listings");
  });

  test("renders active listing rows with price, remaining amount, and cancel action", () => {
    const html = renderToStaticMarkup(<MyListingsView {...myListingsProps()} />);

    expect(html).toContain("US T-Bill 2026-Q3");
    expect(html).toContain("cursor-pointer");
    expect(html).toContain("hover:bg-border/20");
    expect(html).toContain("2.50 USDC");
    expect(html).toContain("4.00");
    expect(html).toContain("Cancel");
  });

  test("renders the secondary confirmation before cancelling", () => {
    const html = renderToStaticMarkup(
      <MyListingsView {...myListingsProps({ cancellingId: 3n })} />,
    );

    expect(html).toContain("Confirm cancel?");
    expect(html).toContain("Keep");
  });

  test("calls the cancel handler with the confirmed listing id", () => {
    const onCancel = vi.fn();
    const props = myListingsProps({ cancellingId: 3n, onCancel });

    props.onCancel(props.cancellingId);

    expect(onCancel).toHaveBeenCalledWith(3n);
  });
});
