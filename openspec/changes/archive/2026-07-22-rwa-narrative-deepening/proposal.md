# Change: RWA 叙事深化——Issuer profile + Sovereign/Corporate bonds + Explore 维度扩展

## Why

- 现有 8 类 14 资产的 issuer 字段是自由字符串，没有主体页面消费；RWA 叙事最重要的"发行方信誉与 track record"层缺失。
- fixed-income 家族只有短期国债（treasuries）与私募信贷（private-credit），缺主权/市政公开债 + 企业公开债这两条正统资产，交易所信息密度不完整。
- Explore 目前只有类别 chips + 搜索 + 表头排序，缺 issuer/yield 两个高频过滤维度。

## What Changes

- **ADDED** capability `issuer-profile`：`/issuers/[slug]` 页 —— Header + KPI 栏（Assets / Total Shares / Cumulative Volume / Weighted APY）+ Assets table + Docs（三条固定 stub）+ External links + Recent activity（复用 activity-feed 过滤）。
- **ADDED** issuer 元数据 schema：`web/content/issuers/*.json`（slug/displayName/shortName/jurisdiction/establishedYear/focus/description/docs/externalLinks）。资产 JSON 新增必填字段 `issuerSlug`（替代原 `issuer` 自由字符串）。构建期 fail-fast 校验。
- **MODIFIED** `market-browsing`：Explore 新增 `sovereign-bonds` + `corporate-bonds` 两个固定收益类别，并追加 `money-market-funds` / `mortgages` / `equipment-finance` / `music-royalties` 四个 RWA 现金流类别；类别 chips 下方新增 Issuer filter（下拉，默认 All Issuers）+ Yield bucket（4 chip 互斥单选：`<4%` / `4-6%` / `6-10%` / `>10%`）；URL 状态包含 `issuer=` 和 `yield=`；多维过滤取交集；**统计条口径不变（保持全局，不随过滤重算）**。
- **MODIFIED** `market-browsing`：资产详情页 header 加一行 `Issuer: [Name →]` 跳转 `/issuers/[slug]`（表格不加 issuer 列，保信息密度）。
- 种子扩展：现有 14 资产 issuer 字符串归并到 9 个 issuer JSON；新增 12 资产（sovereign 2 + corporate 2 + money market 2 + mortgages 2 + equipment finance 2 + music royalties 2）+ 7 新 issuer；arc-testnet 分两批追加 12 笔 `createAsset` 广播（不动合约）。

## Impact

- **Affected specs**:
  - ADDED: `issuer-profile`（新能力）
  - MODIFIED: `market-browsing`（类别扩展 + Explore 过滤 + 资产详情页 issuer 跳转入口）
- **Affected code**:
  - 新增 `web/content/issuers/` 目录 + 12 个 issuer JSON
  - 迁移 `web/content/assets/*.json`：14 个改字段 + 4 个新增
  - 新增 `web/lib/issuers.ts`
  - 修改 `web/lib/categories.ts`（+6 类）、`web/lib/metadata.ts`（+ issuerSlug 校验）
  - 新增 `web/app/issuers/[slug]/page.tsx` + `web/components/issuer/*`（5 个）
  - 新增 `web/components/market/ExploreIssuerFilter.tsx` + `ExploreYieldFilter.tsx`
  - 修改 Explore 主页（HomeView 或 market page）、资产详情页 header
  - 新增 `contracts/script/Seed2026Q3RwaExpansion.s.sol`（4 笔 createAsset）+ `Seed2026Q4RwaBreadthExpansion.s.sol`（8 笔 createAsset）
  - vitest：`web/test/lib/issuers.test.ts` / `issuers-kpi.test.ts` / `metadata.test.ts` / `categories.test.ts` + 组件测
- **Non-impact**:
  - `HadronAssets` / `HadronMarket` 合约不动
  - `asset-registry` spec 不变（issuer 是元数据，链上合约接口不变）
  - 既有 10 类的 gradient / tickerClassName 配色不变
  - 统计条（TVL / 24H Volume / Avg APY）口径不变

## Acceptance Criteria

- **GIVEN** 未连接钱包的访客 **WHEN** 访问 `/issuers/meridian-credit` **THEN** 页面展示 Header + 4 KPI + Assets table（该 issuer 全部资产）+ Docs + Recent activity；KPI 从链上事件 + 静态元数据派生。
- **GIVEN** 访客在 Explore 页选择 `Issuer=Meridian` **THEN** 资产表格只显示该 issuer 的资产；URL 带 `?issuer=meridian-credit`。
- **GIVEN** 访客选 `Yield=6-10%` chip **THEN** 表格只显示 apyBps 在 6.00%-10.00% 区间的资产；再选一次同 chip 取消。
- **GIVEN** 资产 JSON 缺 `issuerSlug` 或指向不存在的 slug **THEN** `npm run build` 失败并明确报错。
- **GIVEN** 访客在资产详情页 **WHEN** 点 header 的 Issuer 名 **THEN** 跳到 `/issuers/[slug]`。
- **GIVEN** arc-testnet 广播完 12 笔新 createAsset **THEN** Explore 页 `SOVEREIGN BONDS`、`CORPORATE BONDS`、`MONEY MARKET FUNDS`、`MORTGAGES`、`EQUIPMENT FINANCE`、`MUSIC ROYALTIES` chips 各显示 2 资产。
- vitest 全通过（包括新增 issuers/kpi/metadata/categories 测试）；`npm run build` 无错误。

## Out of Scope

- 不做 issuer 上链（不改合约、不加 registry）。
- 不做 issuer 历史发行 timeline chart（数据点稀疏，Q4 已否决）。
- 不做 Maturity filter 或 Risk tier filter（Q3 已否决）。
- 不做 Explore 表格的 issuer 列（保信息密度）。
- 不上真 PDF 文件（docs 保持 stub）；不引真实企业域名（externalLinks 用 `demo.hadron.local`）。
- 不做 issuer profile 页的 timeline chart / issuance-by-time 图。
- 不做移动端专属 UX 深化（沿用现有响应式）。
- 不做 KYC / 合规展示层。
