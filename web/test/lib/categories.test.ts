import { describe, expect, test } from "vitest";
import {
  DISPLAY_CATEGORIES,
  displayCategoryForChainCategory,
} from "../../lib/categories";
import { filterAssets } from "../../lib/filterAssets";
import { metaBySlug, type AssetMeta } from "../../lib/metadata";

interface SeededAssetFixture {
  category: string;
  meta: AssetMeta;
}

function seededExpansionAssets(): SeededAssetFixture[] {
  return [
    {
      category: "sovereign-bonds",
      meta: metaBySlug("hadron://assets/de-bund-10y"),
    },
    {
      category: "sovereign-bonds",
      meta: metaBySlug("hadron://assets/jp-jgb-5y"),
    },
    {
      category: "corporate-bonds",
      meta: metaBySlug("hadron://assets/apex-industrials-2029"),
    },
    {
      category: "corporate-bonds",
      meta: metaBySlug("hadron://assets/helios-utility-2031"),
    },
  ];
}

describe("batch-1 display category extensions", () => {
  test("maps sovereign and corporate bond chain categories directly", () => {
    expect(displayCategoryForChainCategory("sovereign-bonds")).toBe("sovereign-bonds");
    expect(displayCategoryForChainCategory("corporate-bonds")).toBe("corporate-bonds");
  });

  test("keeps the fixed-income categories at the front of the display list", () => {
    expect(DISPLAY_CATEGORIES.slice(0, 3)).toEqual([
      { label: "TREASURIES", value: "treasuries" },
      { label: "SOVEREIGN BONDS", value: "sovereign-bonds" },
      { label: "CORPORATE BONDS", value: "corporate-bonds" },
    ]);
  });

  test("filters the 2026 Q3 expansion seeded assets into sovereign and corporate buckets", () => {
    const assets = seededExpansionAssets();

    expect(assets.map((asset) => asset.meta.issuerSlug)).toEqual([
      "germany-treasury-desk",
      "japan-treasury-desk",
      "apex-corporate-desk",
      "helios-infrastructure",
    ]);
    expect(filterAssets(assets, { category: "sovereign-bonds" }).map((asset) => asset.meta.ticker))
      .toEqual(["BUND-10Y", "JGB-5Y"]);
    expect(filterAssets(assets, { category: "corporate-bonds" }).map((asset) => asset.meta.ticker))
      .toEqual(["APEX-29", "HELIO-31"]);
  });
});

describe("batch-2 display category breadth", () => {
  test("maps the additional cashflow categories directly", () => {
    expect(displayCategoryForChainCategory("money-market-funds")).toBe("money-market-funds");
    expect(displayCategoryForChainCategory("mortgages")).toBe("mortgages");
    expect(displayCategoryForChainCategory("equipment-finance")).toBe("equipment-finance");
    expect(displayCategoryForChainCategory("music-royalties")).toBe("music-royalties");
  });

  test("adds the four additional RWA categories in the market browsing order", () => {
    expect(DISPLAY_CATEGORIES).toHaveLength(14);
    expect(DISPLAY_CATEGORIES.map((category) => category.value)).toEqual([
      "treasuries",
      "sovereign-bonds",
      "corporate-bonds",
      "money-market-funds",
      "private-credit",
      "mortgages",
      "real-estate",
      "equipment-finance",
      "commodities",
      "carbon",
      "infrastructure",
      "music-royalties",
      "art-collectibles",
      "invoice-financing",
    ]);
  });

  test("filters seeded breadth assets into their new category buckets", () => {
    const assets: SeededAssetFixture[] = [
      { category: "money-market-funds", meta: metaBySlug("hadron://assets/usdc-treasury-mmf-a") },
      { category: "money-market-funds", meta: metaBySlug("hadron://assets/sgd-liquidity-note-2026") },
      { category: "mortgages", meta: metaBySlug("hadron://assets/prime-mortgage-pool-2026-08") },
      { category: "mortgages", meta: metaBySlug("hadron://assets/sunbelt-rental-mortgage-b") },
      { category: "equipment-finance", meta: metaBySlug("hadron://assets/gpu-lease-2027") },
      { category: "equipment-finance", meta: metaBySlug("hadron://assets/railcar-lease-pool-2028") },
      { category: "music-royalties", meta: metaBySlug("hadron://assets/indie-catalog-royalty-a") },
      { category: "music-royalties", meta: metaBySlug("hadron://assets/streaming-royalty-basket-2026") },
    ];

    expect(
      filterAssets(assets, { category: "money-market-funds" }).map((asset) => asset.meta.ticker),
    ).toEqual(["MMF-A", "SGD-LIQ"]);
    expect(filterAssets(assets, { category: "mortgages" }).map((asset) => asset.meta.ticker)).toEqual([
      "MORT-A",
      "MORT-B",
    ]);
    expect(
      filterAssets(assets, { category: "equipment-finance" }).map((asset) => asset.meta.ticker),
    ).toEqual(["GPU-27", "RAIL-28"]);
    expect(
      filterAssets(assets, { category: "music-royalties" }).map((asset) => asset.meta.ticker),
    ).toEqual(["SONG-A", "STREAM"]);
  });
});
