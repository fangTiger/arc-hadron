import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { AssetDetailView } from "../app/asset/[id]/page";
import { remainingRatio } from "../components/market/AssetCard";
import { AssetGridView } from "../components/market/AssetGrid";
import { StatsBarView } from "../components/market/StatsBar";
import {
  ASSETS_READ_ERROR_ZH,
  activeTokenIdsForCount,
  assetReadErrorZh,
  readContractCount,
} from "../lib/hooks/useAssets";
import type { TradeEvent } from "../lib/events";
import type { AssetView } from "../lib/mappers";

const USDC = 10n ** 18n;
const YIELD_PENDING = 325n * (USDC / 100n);

const yieldMockState = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111" as `0x${string}`,
  balance: 1_000n * 10n ** 18n,
  claim: vi.fn(),
  claimErrorText: undefined as string | undefined,
  claimStatus: "idle",
  connect: vi.fn(),
  deposit: vi.fn(),
  depositErrorText: undefined as string | undefined,
  depositStatus: "idle",
  invalidateQueries: vi.fn(),
  isConnected: true,
  isCorrectChain: true,
  refetchBalance: vi.fn(),
  switchToArc: vi.fn(),
  totalPending: 325n * 10n ** 16n,
}));

vi.mock("../components/asset/BuyPanel", () => ({
  BuyPanel: () => <aside>BUY PANEL</aside>,
}));

vi.mock("../components/asset/ListingsTable", () => ({
  ListingsTable: () => <section>SELL ORDERS</section>,
}));

vi.mock("../components/asset/BidsTable", () => ({
  BidsTable: () => <section>BUY ORDERS</section>,
}));

vi.mock("../components/asset/PlaceBidPanel", () => ({
  PlaceBidPanel: () => <section>PLACE BID</section>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: yieldMockState.invalidateQueries,
  }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: yieldMockState.address,
    isConnected: yieldMockState.isConnected,
  }),
  useBalance: () => ({
    data: { value: yieldMockState.balance },
    isLoading: false,
    refetch: yieldMockState.refetchBalance,
  }),
  useConnect: () => ({
    connect: yieldMockState.connect,
    connectors: [{ id: "injected", type: "injected" }],
    isPending: false,
  }),
}));

vi.mock("@/lib/hooks/useNetworkGuard", () => ({
  useNetworkGuard: () => ({
    isCorrectChain: yieldMockState.isCorrectChain,
    switchToArc: yieldMockState.switchToArc,
  }),
}));

vi.mock("@/lib/hooks/useYield", () => ({
  useClaimYield: () => ({
    claim: yieldMockState.claim,
    claimBatch: vi.fn(),
    errorText: yieldMockState.claimErrorText,
    reset: vi.fn(),
    status: yieldMockState.claimStatus,
    txHash: undefined,
  }),
  useDepositYield: () => ({
    deposit: yieldMockState.deposit,
    errorText: yieldMockState.depositErrorText,
    reset: vi.fn(),
    status: yieldMockState.depositStatus,
    txHash: undefined,
  }),
  usePendingYield: (tokenIds: bigint[]) => ({
    isLoading: false,
    pending: tokenIds.map((tokenId) => ({
      amount: tokenId === 15n ? yieldMockState.totalPending : 0n,
      tokenId,
    })),
    pendingByTokenId: new Map(
      tokenIds.map((tokenId) => [tokenId, tokenId === 15n ? yieldMockState.totalPending : 0n]),
    ),
    totalPending: yieldMockState.totalPending,
  }),
}));

function assetView(overrides: Partial<AssetView> = {}): AssetView {
  return {
    category: "treasuries",
    meta: {
      apyBps: 510,
      description: "Test asset",
      docs: [],
      issuer: "Hadron Treasury Desk",
      displayName: "US T-Bill 2026-Q3",
      ticker: "TBILL",
      slug: "t-bill-2026-q3",
    },
    name: "US T-BILL 2026-Q3",
    offering: {
      active: true,
      id: 1n,
      pricePerShare: USDC / 100n,
      remaining: 5_000n,
      tokenId: 15n,
    },
    tokenId: 15n,
    totalShares: 10_000n,
    ...overrides,
  };
}

function tradeEvent(overrides: Partial<TradeEvent> = {}): TradeEvent {
  return {
    amount: 200n,
    blockNumber: 100n,
    buyer: "0x1000000000000000000000000000000000000001",
    logIndex: 1,
    pricePerShare: 2n * USDC / 100n,
    seller: "0x2000000000000000000000000000000000000002",
    timestamp: Date.UTC(2026, 6, 2, 10),
    tokenId: 15n,
    totalPaid: 4n * USDC,
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000002",
    type: "primary-sale",
    ...overrides,
  };
}

describe("on-chain asset read state", () => {
  test("starts active catalog reads at the V4 fresh-deployment token range", () => {
    expect(activeTokenIdsForCount(0)).toEqual([]);
    expect(activeTokenIdsForCount(2)).toEqual([1n, 2n]);
  });

  test("assetCount=0 is a real empty set, not a loading state", () => {
    expect(readContractCount(undefined)).toBe(0);
    expect(readContractCount(0n)).toBe(0);
    expect(readContractCount(4n)).toBe(4);
  });

  test("fails explicitly when an on-chain count exceeds the safe integer range", () => {
    expect(() => readContractCount(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(
      "On-chain asset count exceeds the frontend safe range",
    );
  });

  test("returns an English RPC error when any query fails instead of silently returning an empty list", () => {
    expect(assetReadErrorZh([{ isError: false }, { isError: true }])).toBe(ASSETS_READ_ERROR_ZH);
    expect(assetReadErrorZh([{ isError: false }])).toBeUndefined();
  });

  test("renders the market list error state when RPC reads fail", () => {
    const html = renderToStaticMarkup(
      <AssetGridView
        assets={[]}
        category="all"
        errorZh={ASSETS_READ_ERROR_ZH}
        isLoading={false}
        onCategoryChange={() => undefined}
      />,
    );

    expect(html).toContain(ASSETS_READ_ERROR_ZH);
    expect(html).not.toContain("No active assets in this category.");
  });

  test("does not disguise TVL as zero when RPC reads fail", () => {
    const html = renderToStaticMarkup(
      <StatsBarView
        avgApyBps={null}
        errorZh={ASSETS_READ_ERROR_ZH}
        isLoading={false}
        tvl={0n}
      />,
    );

    expect(html).toContain("Read failed");
    expect(html).not.toContain("0.00");
  });

  test("renders not found instead of a permanent skeleton when assetCount=0", () => {
    const html = renderToStaticMarkup(
      <AssetDetailView assets={[]} id="1" isLoading={false} />,
    );

    expect(html).toContain("Asset not found");
    expect(html).not.toContain("REMAINING SHARES");
  });

  test("renders the redesigned asset price header and on-chain trade history", () => {
    const html = renderToStaticMarkup(
      <AssetDetailView
        assets={[assetView()]}
        events={[tradeEvent()]}
        id="15"
        isLoading={false}
        nowMs={Date.UTC(2026, 6, 2, 12)}
      />,
    );

    expect(html).toContain("2.00");
    expect(html).toContain("24H");
    expect(html).toContain("MARKET CAP");
    expect(html).toContain("TRADE HISTORY");
    expect(html).toContain("COUNTERPARTY");
    expect(html).toContain("PRIMARY SALE");
    expect(html).toContain("BUYER");
    expect(html).toContain("0x1000…0001");
    expect(html).toContain("href=\"https://testnet.arcscan.app/tx/");
    expect(html).toContain("href=\"https://testnet.arcscan.app/address/0x1000000000000000000000000000000000000001\"");
  });

  test("renders both buyer and seller address links for secondary purchases", () => {
    const html = renderToStaticMarkup(
      <AssetDetailView
        assets={[assetView()]}
        events={[tradeEvent({ type: "purchased" })]}
        id="15"
        isLoading={false}
        nowMs={Date.UTC(2026, 6, 2, 12)}
      />,
    );

    expect(html).toContain("PURCHASED");
    expect(html).toContain("BUYER");
    expect(html).toContain("SELLER");
    expect(html).toContain("href=\"https://testnet.arcscan.app/address/0x1000000000000000000000000000000000000001\"");
    expect(html).toContain("href=\"https://testnet.arcscan.app/address/0x2000000000000000000000000000000000000002\"");
  });

  test("renders bid lifecycle labels in asset trade history", () => {
    const html = renderToStaticMarkup(
      <AssetDetailView
        assets={[assetView()]}
        events={[
          tradeEvent({ logIndex: 1, type: "bid-placed" }),
          tradeEvent({ logIndex: 2, type: "bid-filled" }),
          tradeEvent({ logIndex: 3, type: "bid-cancelled" }),
        ]}
        id="15"
        isLoading={false}
        nowMs={Date.UTC(2026, 6, 2, 12)}
      />,
    );

    expect(html).toContain("BID");
    expect(html).toContain("BID FILL");
    expect(html).toContain("BID CANCEL");
  });

  test("filters yield events out of asset trade history", () => {
    const html = renderToStaticMarkup(
      <AssetDetailView
        assets={[assetView()]}
        events={[
          tradeEvent({
            amount: undefined,
            logIndex: 4,
            pricePerShare: undefined,
            totalPaid: undefined,
            txHash: "0x00000000000000000000000000000000000000000000000000000000000000ff",
            type: "yield-deposited",
            yieldAmount: 12n * USDC,
          }),
        ]}
        id="15"
        isLoading={false}
        nowMs={Date.UTC(2026, 6, 2, 12)}
      />,
    );

    expect(html).toContain("Trade history lands here after on-chain activity.");
    expect(html.slice(html.indexOf("TRADE HISTORY"))).not.toContain("0x0000…00ff");
  });

  test("mounts buy orders and place bid controls between sell orders and trade history", () => {
    const html = renderToStaticMarkup(
      <AssetDetailView
        assets={[assetView()]}
        events={[tradeEvent()]}
        id="15"
        isLoading={false}
        nowMs={Date.UTC(2026, 6, 2, 12)}
      />,
    );

    expect(html.indexOf("SELL ORDERS")).toBeLessThan(html.indexOf("BUY ORDERS"));
    expect(html.indexOf("BUY ORDERS")).toBeLessThan(html.indexOf("PLACE BID"));
    expect(html.indexOf("PLACE BID")).toBeLessThan(html.indexOf("TRADE HISTORY"));
  });

  test("renders asset yield panel with pending claim, distribution records, and deposit entry before trade history", () => {
    yieldMockState.totalPending = YIELD_PENDING;

    const html = renderToStaticMarkup(
      <AssetDetailView
        assets={[assetView()]}
        events={[
          tradeEvent(),
          tradeEvent({
            account: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            amount: undefined,
            blockNumber: 104n,
            logIndex: 4,
            pricePerShare: undefined,
            timestamp: Date.UTC(2026, 6, 2, 11),
            totalPaid: undefined,
            txHash: "0x00000000000000000000000000000000000000000000000000000000000000aa",
            type: "yield-deposited",
            yieldAmount: 12n * USDC,
          }),
          tradeEvent({
            account: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            amount: undefined,
            blockNumber: 105n,
            logIndex: 5,
            pricePerShare: undefined,
            timestamp: Date.UTC(2026, 6, 2, 11, 30),
            totalPaid: undefined,
            txHash: "0x00000000000000000000000000000000000000000000000000000000000000bb",
            type: "yield-deposited",
            yieldAmount: 35n * (USDC / 10n),
          }),
          tradeEvent({
            account: "0xcccccccccccccccccccccccccccccccccccccccc",
            amount: undefined,
            blockNumber: 106n,
            logIndex: 6,
            pricePerShare: undefined,
            timestamp: Date.UTC(2026, 6, 2, 12),
            tokenId: 1n,
            totalPaid: undefined,
            txHash: "0x00000000000000000000000000000000000000000000000000000000000000cc",
            type: "yield-deposited",
            yieldAmount: 99n * USDC,
          }),
        ]}
        id="15"
        isLoading={false}
        nowMs={Date.UTC(2026, 6, 2, 12)}
      />,
    );

    expect(html).toContain("Pending yield: 3.25 USDC");
    expect(html).toContain("TOTAL DISTRIBUTED");
    expect(html).toContain("15.50 USDC");
    expect(html).toContain("RECENT DISTRIBUTIONS");
    expect(html).toContain("YIELD DEPOSIT");
    expect(html).toContain("12.00 USDC");
    expect(html).toContain("3.50 USDC");
    expect(html).not.toContain("99.00 USDC");
    expect(html).toContain("Distribute");
    expect(html.indexOf("PLACE BID")).toBeLessThan(html.indexOf("Pending yield: 3.25 USDC"));
    expect(html.indexOf("Pending yield: 3.25 USDC")).toBeLessThan(html.indexOf("TRADE HISTORY"));
  });

  test("caps remaining ratio in bigint space before converting to number", () => {
    expect(
      remainingRatio(
        assetView({
          offering: {
            active: true,
            id: 1n,
            pricePerShare: 1n,
            remaining: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
            tokenId: 15n,
          },
          totalShares: 1n,
        }),
      ),
    ).toBe(100);
  });

  test("filters gold and commodities assets into the COMMODITIES display category", () => {
    const html = renderToStaticMarkup(
      <AssetGridView
        assets={[
          assetView({
            category: "gold",
            meta: {
              ...assetView().meta,
              displayName: "Gold Ounce Vault #4",
              ticker: "GOLD",
              slug: "gold-ounce-4",
            },
            tokenId: 2n,
          }),
          assetView({
            category: "commodities",
            meta: {
              ...assetView().meta,
              displayName: "Silver Bullion Vault #2",
              ticker: "SLVR",
              slug: "silver-bullion-vault-2",
            },
            tokenId: 9n,
          }),
        ]}
        category="commodities"
        isLoading={false}
        onCategoryChange={() => undefined}
      />,
    );

    expect(html).toContain("Gold Ounce Vault #4");
    expect(html).toContain("Silver Bullion Vault #2");
    expect(html).toContain("COMMODITIES");
  });
});
