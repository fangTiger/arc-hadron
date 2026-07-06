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

  test("adds the two fixed-income categories to the display list", () => {
    expect(DISPLAY_CATEGORIES).toHaveLength(10);
    expect(DISPLAY_CATEGORIES.slice(0, 3)).toEqual([
      { label: "TREASURIES", value: "treasuries" },
      { label: "SOVEREIGN BONDS", value: "sovereign-bonds" },
      { label: "CORPORATE BONDS", value: "corporate-bonds" },
    ]);
  });

  test("filters the 2026 Q3 expansion seeded assets into sovereign and corporate buckets", () => {
    const assets = seededExpansionAssets();

    expect(assets.map((asset) => asset.meta.issuerSlug)).toEqual([
      "germany-treasury-demo",
      "japan-treasury-demo",
      "apex-corporate-desk",
      "helios-infrastructure",
    ]);
    expect(filterAssets(assets, { category: "sovereign-bonds" }).map((asset) => asset.meta.ticker))
      .toEqual(["BUND-10Y", "JGB-5Y"]);
    expect(filterAssets(assets, { category: "corporate-bonds" }).map((asset) => asset.meta.ticker))
      .toEqual(["APEX-29", "HELIO-31"]);
  });
});
