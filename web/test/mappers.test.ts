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
  nameZh: `资产 ${slug}`,
  description: "测试资产描述",
  issuer: "测试发行方",
  apyBps,
  docs: [{ label: "测试文档", note: "演示文档，非真实法律文件" }],
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
  test("聚合链上资产、静态元数据与活跃发行", () => {
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

  test("无活跃发行时 offering 为 null", () => {
    const views = joinAssetsWithOfferings(assets, offerings.slice(0, 1), (slug) => meta(slug));

    expect(views[1].offering).toBeNull();
  });

  test("同一 tokenId 取 active 且 id 最大的发行", () => {
    const views = joinAssetsWithOfferings(assets.slice(0, 1), offerings, (slug) => meta(slug));

    expect(views[0].offering?.id).toBe(3n);
    expect(views[0].offering?.pricePerShare).toBe(11n);
  });

  test("从 hadron metadataURI 中提取 slug 传给 metaResolver", () => {
    const seen: string[] = [];

    joinAssetsWithOfferings(assets.slice(0, 1), [], (slug) => {
      seen.push(slug);
      return meta(slug);
    });

    expect(seen).toEqual(["t-bill-2026-q3"]);
  });
});

describe("computeStats", () => {
  test("计算 TVL 并忽略 null APY 求平均收益率", () => {
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

  test("无非 null APY 时平均收益率为 null", () => {
    const views = joinAssetsWithOfferings(assets, [], (slug) => meta(slug, null));

    expect(computeStats(views)).toEqual({ tvl: 0n, avgApyBps: null });
  });
});

describe("toHoldings", () => {
  test("按购买事件计算移动平均成本、市值与成本额", () => {
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

  test("过滤 0 余额资产", () => {
    const views = joinAssetsWithOfferings(assets, offerings, (slug) => meta(slug));

    expect(toHoldings(views, [{ tokenId: 1n, balance: 0n }], [])).toEqual([]);
  });

  test("无购买事件时成本字段为 null", () => {
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
