import { describe, expect, test } from "vitest";
import {
  computeStats,
  joinAssetsWithOfferings,
  toHoldings,
  type AssetView,
} from "../lib/mappers";
import type { AssetMeta } from "../lib/metadata";

const meta = (slug: string, apyBps: number | null = null): AssetMeta => ({
  slug,
  displayName: `Asset ${slug}`,
  ticker: "TEST",
  description: "Test asset description",
  issuer: "Test issuer",
  apyBps,
  docs: [{ label: "Test document", note: "Demo document, not a legal instrument." }],
});

const assets = [
  {
    tokenId: 1n,
    name: "US T-BILL 2026-Q3",
    category: "treasuries",
    totalShares: 100n,
    metadataURI: "hadron://assets/t-bill-2026-q3",
  },
  {
    tokenId: 2n,
    name: "GOLD OUNCE VAULT #4",
    category: "gold",
    totalShares: 50n,
    metadataURI: "hadron://assets/gold-ounce-4",
  },
];

const offerings = [
  { id: 1n, tokenId: 1n, pricePerShare: 10n, remaining: 20n, active: false },
  { id: 2n, tokenId: 1n, pricePerShare: 12n, remaining: 15n, active: true },
  { id: 3n, tokenId: 1n, pricePerShare: 11n, remaining: 5n, active: true },
];

describe("joinAssetsWithOfferings", () => {
  test("joins on-chain assets, static metadata, and active offerings", () => {
    const views = joinAssetsWithOfferings(assets.slice(0, 1), offerings.slice(1, 2), (slug) =>
      meta(slug, 510),
    );

    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({
      tokenId: 1n,
      name: "US T-BILL 2026-Q3",
      category: "treasuries",
      totalShares: 100n,
      offering: { id: 2n, pricePerShare: 12n, remaining: 15n, active: true },
    });
    expect(views[0].meta.slug).toBe("t-bill-2026-q3");
  });

  test("returns null offering when no active offering exists", () => {
    const views = joinAssetsWithOfferings(assets, offerings.slice(0, 1), (slug) => meta(slug));

    expect(views[1].offering).toBeNull();
  });

  test("selects the active offering with the largest id for the same tokenId", () => {
    const views = joinAssetsWithOfferings(assets.slice(0, 1), offerings, (slug) => meta(slug));

    expect(views[0].offering?.id).toBe(3n);
    expect(views[0].offering?.pricePerShare).toBe(11n);
  });

  test("extracts the slug from hadron metadataURI before calling metaResolver", () => {
    const seen: string[] = [];

    joinAssetsWithOfferings(assets.slice(0, 1), [], (slug) => {
      seen.push(slug);
      return meta(slug);
    });

    expect(seen).toEqual(["t-bill-2026-q3"]);
  });
});

describe("computeStats", () => {
  test("computes TVL and ignores null APY values when averaging yield", () => {
    const views: AssetView[] = [
      {
        ...assets[0],
        meta: meta("t-bill-2026-q3", 510),
        offering: { id: 1n, pricePerShare: 10n, remaining: 20n, active: true },
      },
      {
        ...assets[1],
        meta: meta("gold-ounce-4", null),
        offering: { id: 2n, pricePerShare: 25n, remaining: 5n, active: true },
      },
    ];

    expect(computeStats(views)).toEqual({ tvl: 2250n, avgApyBps: 510 });
  });

  test("returns null average yield when all APY values are null", () => {
    const views = joinAssetsWithOfferings(assets, [], (slug) => meta(slug, null));

    expect(computeStats(views)).toEqual({ tvl: 0n, avgApyBps: null });
  });
});

describe("toHoldings", () => {
  test("computes moving-average cost, market value, and cost basis from purchase events", () => {
    const views = joinAssetsWithOfferings(assets.slice(0, 1), offerings.slice(1, 2), (slug) =>
      meta(slug),
    );

    const holdings = toHoldings(
      views,
      [{ tokenId: 1n, balance: 5n }],
      [
        { tokenId: 1n, amount: 2n, totalPaid: 20n },
        { tokenId: 1n, amount: 3n, totalPaid: 39n },
      ],
    );

    expect(holdings).toHaveLength(1);
    expect(holdings[0]).toMatchObject({
      balance: 5n,
      marketValue: 60n,
      avgCost: 11n,
      costBasis: 55n,
    });
  });

  test("filters zero-balance assets", () => {
    const views = joinAssetsWithOfferings(assets, offerings, (slug) => meta(slug));

    expect(toHoldings(views, [{ tokenId: 1n, balance: 0n }], [])).toEqual([]);
  });

  test("returns null cost fields when there are no purchase events", () => {
    const views = joinAssetsWithOfferings(assets.slice(1), [], (slug) => meta(slug));
    const holdings = toHoldings(views, [{ tokenId: 2n, balance: 4n }], []);

    expect(holdings[0]).toMatchObject({
      balance: 4n,
      marketValue: 0n,
      avgCost: null,
      costBasis: null,
    });
  });
});
