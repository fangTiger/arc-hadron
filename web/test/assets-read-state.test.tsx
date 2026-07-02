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
      description: "测试资产",
      docs: [],
      issuer: "Hadron Treasury Desk",
      nameZh: "美国短债 2026-Q3",
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

describe("链上资产读取状态", () => {
  test("assetCount=0 是真实空集，不是加载中", () => {
    expect(readContractCount(undefined)).toBe(0);
    expect(readContractCount(0n)).toBe(0);
    expect(readContractCount(4n)).toBe(4);
  });

  test("超出安全整数范围的链上计数会显式失败", () => {
    expect(() => readContractCount(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(
      "链上资产数量超出前端可处理范围",
    );
  });

  test("任一 RPC 查询失败时返回中文错误而不是静默空列表", () => {
    expect(assetReadErrorZh([{ isError: false }, { isError: true }])).toBe(ASSETS_READ_ERROR_ZH);
    expect(assetReadErrorZh([{ isError: false }])).toBeUndefined();
  });

  test("市场列表在 RPC 失败时展示错误态", () => {
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
    expect(html).not.toContain("当前类别暂无活跃资产。");
  });

  test("统计条在 RPC 失败时不把 TVL 伪装成 0", () => {
    const html = renderToStaticMarkup(
      <StatsBarView
        avgApyBps={null}
        errorZh={ASSETS_READ_ERROR_ZH}
        isLoading={false}
        tvl={0n}
      />,
    );

    expect(html).toContain("读取失败");
    expect(html).not.toContain("0.00");
  });

  test("资产详情在 assetCount=0 时展示未找到而不是永久骨架", () => {
    const html = renderToStaticMarkup(
      <AssetDetailView assets={[]} id="1" isLoading={false} />,
    );

    expect(html).toContain("未找到该资产");
    expect(html).not.toContain("REMAINING SHARES");
  });

  test("剩余额度比例在 bigint 域封顶后再转成 number", () => {
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
});
