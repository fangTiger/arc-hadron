# Compact Market Trading Layout Implementation Plan

> **For Codex:** 使用 TDD 执行本计划。主线程负责 OpenSpec 与审查，worker agent 负责限定文件内实现，verification agent 负责独立验证。

**Goal:** 让首页更像交易工作台并更快进入市场表格，让详情页在深度图之后立即提供 Buy / Sell / Bid 操作。

**Architecture:** 首页只重排现有过滤控件，不改 `filterAssets` 和 URL 状态逻辑。详情页将首屏重排为价格图、盘口/订单、右侧 `DepthChart compact + BuyPanel` 三栏交易工作区；移动端源码顺序让交易 rail 先于介绍、AI insight、收益和历史出现。Place Bid 嵌入现有 Buy/Sell 面板或其后继组件。

**Tech Stack:** Next.js App Router、React 19、Tailwind CSS、Vitest SSR component tests、wagmi hooks。

---

### Task 1: 首页轻量市场命令栏

**Files:**
- Modify: `web/app/HomeView.tsx`
- Test: `web/test/market-components.test.tsx` 或新增 `web/test/home-layout.test.tsx`

**Steps:**
1. 写失败测试，渲染 `HomeView` 或提取出的过滤栏 view，断言 `data-market-filter-toolbar` 与 `data-market-command-bar` 存在，搜索、类别、issuer、yield、reset 在该区域内，表格文本早于 `MARKET BRIEF`。
2. 运行相关测试，确认因缺少 toolbar 标记或顺序失败。
3. 重排 `HomeView` 中过滤区：搜索前置，类别 chips 与 issuer/yield 在同一区域，active filters 时显示 reset；过滤区使用横向 command band，不再呈现厚重卡片。
4. 保留 `replaceQueryParam`、`resetFilters`、`filteredAssets`、`emptyState` 行为。
5. 运行相关测试确认通过。

### Task 2: 详情页交易优先顺序

**Files:**
- Modify: `web/app/asset/[id]/AssetDetailView.tsx`
- Test: `web/test/assets-read-state.test.tsx`

**Steps:**
1. 修改现有顺序测试为失败期望：`PRICE TREND → DEPTH CHART → BUY PANEL` 先于订单明细和浏览型内容，`PLACE BID` 不再出现在左列中后段。
2. 运行单测，确认旧布局失败。
3. 重排详情页：价格头之后接三栏交易工作区；桌面为 PriceChart、OrderBook/订单明细、右侧 DepthChart compact + BuyPanel；移动端源码顺序让 DepthChart + BuyPanel 先于介绍、Insight、Yield、History。
4. 浏览器验证后继续压缩价格头、DepthChart compact 和 BuyPanel buy mode，确保金额输入与主操作按钮在 1280×720 首屏内可见。
4. 保留 `sell-orders` / `buy-orders` anchor 与高亮逻辑。
5. 运行单测确认通过。

### Task 3: 统一 Buy / Sell / Bid 交易台

**Files:**
- Modify: `web/components/asset/BuyPanel.tsx`
- Modify: `web/app/asset/[id]/AssetDetailView.tsx`
- Test: `web/test/listings-table.test.tsx` 或新增 `web/test/trade-panel.test.tsx`

**Steps:**
1. 写失败测试：渲染交易台时包含 Buy、Sell、Bid 三个 tab；切到 Bid 初始模式时渲染 `PLACE BID` / `Open a buy order`。
2. 运行测试确认失败。
3. 将 `BuyPanel` 的 mode 扩展为 `"buy" | "sell" | "bid"`，在 Bid mode 内复用 `PlaceBidPanel`。
4. 为嵌入模式避免重复外层大边框：如需要，为 `PlaceBidPanel` 增加 `variant="embedded"`，默认保持现有样式以保护其他调用。
5. 从详情页左列移除独立 `PlaceBidPanel`，右侧使用扩展后的交易台。
6. 运行相关测试确认通过。

### Task 4: 验证与收尾

**Commands:**
- `cd web && npm test -- assets-read-state.test.tsx market-components.test.tsx listings-table.test.tsx order-book-view.test.tsx`
- `cd web && npm test`
- `openspec validate compact-market-trading-layout --strict --no-interactive`
- `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`

**Browser check:**
- `/`：首屏表格更早露出，筛选区是轻量 command band，Market Brief / Activity 作为次级 rail。
- `/asset/1`：右侧 rail 为紧凑 DepthChart 在上、Buy/Sell/Bid 交易台在下；Buy mode 的金额输入与主操作按钮在首屏内；订单明细在介绍前。
