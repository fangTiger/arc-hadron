import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("响应式布局契约", () => {
  test("全站 shell 与顶栏为手机提供双层导航且不依赖隐藏主导航", () => {
    const css = source("app/globals.css");
    const topBar = source("components/layout/TopBar.tsx");

    expect(css).toContain("--hadron-shell-max:");
    expect(css).toContain(".hadron-shell");
    expect(css).toContain("overflow-x: clip");
    expect(topBar).toContain("data-app-header");
    expect(topBar).toContain("data-mobile-primary-navigation");
    expect(topBar).toContain("data-desktop-primary-navigation");
    expect(topBar).toContain("hadron-shell");
  });

  test("市场表只在局部滚动且手机 ticker 不固定遮挡内容", () => {
    const home = source("app/HomeView.tsx");
    const marketTable = source("components/market/MarketTable.tsx");
    const ticker = source("components/market/LiveTicker.tsx");

    expect(home).toContain("hadron-ticker-safe");
    expect(home).toContain("data-market-workbench");
    expect(home).toContain("min-w-0");
    expect(marketTable).toContain("data-scroll-frame");
    expect(marketTable).toContain("data-scroll-hint");
    expect(ticker).toContain("data-live-ticker");
    expect(ticker).toContain("lg:fixed");
    expect(ticker).not.toContain('className="fixed inset-x-0 bottom-0');
  });

  test("issuer 单列约束宽表溢出到局部滚动框", () => {
    const issuerBody = source("components/issuer/IssuerProfileBody.tsx");
    const issuerAssets = source("components/issuer/IssuerAssetsTable.tsx");

    expect(issuerBody).toContain("min-w-0");
    expect(issuerBody).toContain("data-issuer-profile-grid");
    expect(issuerAssets).toContain("data-issuer-assets");
    expect(issuerAssets).toContain("min-w-0");
  });

  test("开发者文档与资产 loading 使用移动阅读和响应式占位契约", () => {
    const developerPage = source("app/developers/api/page.tsx");
    const assetDetail = source("app/asset/[id]/AssetDetailView.tsx");

    expect(developerPage).toContain("data-reading-layout");
    expect(developerPage).toContain("data-api-copy");
    expect(assetDetail).toContain("data-asset-skeleton");
    expect(assetDetail).toContain("h-[160px] sm:h-[220px]");
    expect(assetDetail).toContain("h-[280px] sm:h-[360px]");
  });

  test("portfolio 的连接与订单空状态使用统一响应式表面", () => {
    const holdings = source("components/portfolio/HoldingsTable.tsx");
    const listings = source("components/portfolio/MyListings.tsx");
    const bids = source("components/portfolio/MyBids.tsx");

    expect(holdings).toContain("data-portfolio-empty-state");
    expect(listings).toContain("data-portfolio-empty-state");
    expect(bids).toContain("data-portfolio-empty-state");
    expect(holdings).toContain("px-5 py-8 sm:p-10");
  });
});
