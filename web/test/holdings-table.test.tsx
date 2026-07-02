import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { HoldingsTableView } from "../components/portfolio/HoldingsTable";
import { parseUsdc } from "../lib/format";
import type { Holding } from "../lib/mappers";

function holding(overrides: Partial<Holding> = {}): Holding {
  return {
    asset: {
      tokenId: 1n,
      name: "US T-BILL 2026-Q3",
      category: "treasuries",
      totalShares: 100_000n,
      meta: {
        slug: "t-bill-2026-q3",
        nameZh: "美国短债 2026-Q3",
        description: "测试资产",
        issuer: "Hadron Treasury Desk",
        apyBps: 510,
        docs: [],
      },
      offering: {
        id: 1n,
        tokenId: 1n,
        pricePerShare: parseUsdc("2"),
        remaining: 80_000n,
        active: true,
      },
    },
    avgCost: parseUsdc("1.80"),
    balance: 12_345n,
    costBasis: parseUsdc("22221"),
    marketValue: parseUsdc("24690"),
    ...overrides,
  };
}

describe("HoldingsTableView", () => {
  test("渲染持仓表头、资产行、格式化金额和禁用转售入口", () => {
    const html = renderToStaticMarkup(
      <HoldingsTableView holdings={[holding()]} isConnected isLoading={false} />,
    );

    for (const label of ["ASSET", "SHARES", "MARKET VALUE", "AVG COST", "COST BASIS", "ACTIONS"]) {
      expect(html).toContain(label);
    }

    expect(html).toContain("美国短债 2026-Q3");
    expect(html).toContain("TREASURIES");
    expect(html).toContain("12,345");
    expect(html).toContain("24,690.00 USDC");
    expect(html).toContain("1.80 USDC");
    expect(html).toContain("22,221.00 USDC");
    expect(html).toContain("title=\"M3 开放\"");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("挂单转售");
    expect(html).toContain("aria-label=\"总市值 24,690.00 USDC\"");
  });

  test("成本未知时展示中文空值占位", () => {
    const html = renderToStaticMarkup(
      <HoldingsTableView
        holdings={[
          holding({
            avgCost: null,
            costBasis: null,
          }),
        ]}
        isConnected
        isLoading={false}
      />,
    );

    expect((html.match(/—/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  test("未连接和空持仓状态提供下一步引导", () => {
    const disconnected = renderToStaticMarkup(
      <HoldingsTableView
        connectAction={<button type="button">CONNECT WALLET</button>}
        holdings={[]}
        isConnected={false}
        isLoading={false}
      />,
    );
    const empty = renderToStaticMarkup(
      <HoldingsTableView holdings={[]} isConnected isLoading={false} />,
    );

    expect(disconnected).toContain("连接钱包查看持仓");
    expect(disconnected).toContain("CONNECT WALLET");
    expect(empty).toContain("当前钱包暂无持仓");
    expect(empty).toContain("去市场看看");
    expect(empty).toContain("href=\"/\"");
  });

  test("读取失败时展示错误态而不是空持仓", () => {
    const html = renderToStaticMarkup(
      <HoldingsTableView
        errorZh="持仓读取失败，请稍后重试。"
        holdings={[]}
        isConnected
        isLoading={false}
      />,
    );

    expect(html).toContain("持仓读取失败");
    expect(html).not.toContain("当前钱包暂无持仓");
  });
});
