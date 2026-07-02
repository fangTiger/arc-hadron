import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AssetDetailView } from "../app/asset/[id]/page";
import { remainingRatio } from "../components/market/AssetCard";
import { AssetGridView } from "../components/market/AssetGrid";
import { StatsBarView } from "../components/market/StatsBar";
import {
  ASSETS_READ_ERROR_ZH,
  assetReadErrorZh,
  readContractCount,
} from "../lib/hooks/useAssets";
import type { AssetView } from "../lib/mappers";

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
      pricePerShare: 1n,
      remaining: 50n,
      tokenId: 1n,
    },
    tokenId: 1n,
    totalShares: 100n,
    ...overrides,
  };
}

describe("on-chain asset read state", () => {
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

  test("caps remaining ratio in bigint space before converting to number", () => {
    expect(
      remainingRatio(
        assetView({
          offering: {
            active: true,
            id: 1n,
            pricePerShare: 1n,
            remaining: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
            tokenId: 1n,
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
