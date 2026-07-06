import { describe, expect, test } from "vitest";
import { filterAssets, type YieldBucket } from "../../lib/filterAssets";

interface FilterAssetFixture {
  category: string;
  meta: {
    apyBps: number | null;
    displayName: string;
    issuerSlug: string;
    ticker: string;
  };
}

function asset(
  slug: string,
  overrides: Partial<FilterAssetFixture> & { meta?: Partial<FilterAssetFixture["meta"]> } = {},
): FilterAssetFixture {
  const { meta, ...assetOverrides } = overrides;

  return {
    category: "treasuries",
    meta: {
      apyBps: 510,
      displayName: slug,
      issuerSlug: "us-treasury-desk",
      ticker: slug.toUpperCase(),
      ...meta,
    },
    ...assetOverrides,
  };
}

function names(assets: readonly FilterAssetFixture[]): string[] {
  return assets.map((item) => item.meta.displayName);
}

describe("filterAssets", () => {
  const assets = [
    asset("Treasury Bill", { category: "treasuries" }),
    asset("Corporate Note", {
      category: "corporate-bonds",
      meta: { apyBps: 540, issuerSlug: "apex-corporate-desk", ticker: "APEX" },
    }),
    asset("Infra Credit", {
      category: "infrastructure",
      meta: { apyBps: 740, issuerSlug: "helios-infrastructure", ticker: "HELIO" },
    }),
  ];

  test("filters by category", () => {
    expect(names(filterAssets(assets, { category: "corporate-bonds" }))).toEqual([
      "Corporate Note",
    ]);
  });

  test("filters by issuer", () => {
    expect(names(filterAssets(assets, { issuerSlug: "helios-infrastructure" }))).toEqual([
      "Infra Credit",
    ]);
  });

  test("filters by yield bucket", () => {
    expect(names(filterAssets(assets, { yieldBucket: "6to10" }))).toEqual(["Infra Credit"]);
  });

  test("filters by query against name and ticker", () => {
    expect(names(filterAssets(assets, { query: "apex" }))).toEqual(["Corporate Note"]);
    expect(names(filterAssets(assets, { query: "infra" }))).toEqual(["Infra Credit"]);
  });

  test("filters by category, issuer, yield, and query as an intersection", () => {
    expect(
      names(
        filterAssets(assets, {
          category: "corporate-bonds",
          issuerSlug: "apex-corporate-desk",
          query: "note",
          yieldBucket: "4to6",
        }),
      ),
    ).toEqual(["Corporate Note"]);

    expect(
      names(
        filterAssets(assets, {
          category: "corporate-bonds",
          issuerSlug: "helios-infrastructure",
          query: "note",
          yieldBucket: "4to6",
        }),
      ),
    ).toEqual([]);
  });

  test.each([
    [399, "lt4", true],
    [400, "lt4", false],
    [400, "4to6", true],
    [599, "4to6", true],
    [600, "4to6", false],
    [600, "6to10", true],
    [999, "6to10", true],
    [1000, "6to10", false],
    [1000, "gt10", true],
  ] satisfies [number, YieldBucket, boolean][])(
    "classifies apyBps=%i against %s as %s",
    (apyBps, yieldBucket, expected) => {
      const result = filterAssets(
        [asset(`apy-${apyBps}`, { meta: { apyBps } })],
        { yieldBucket },
      );

      expect(result).toHaveLength(expected ? 1 : 0);
    },
  );
});
