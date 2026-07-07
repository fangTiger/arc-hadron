# Tasks: 紧凑市场首页与交易优先详情页

## 1. 规格与计划

- [x] 1.1 创建 OpenSpec proposal、spec delta、tasks。
- [x] 1.2 创建实现计划，明确首页与详情页的文件范围、TDD 步骤和验证命令。

## 2. 首页布局

- [x] 2.1 先写失败测试：断言 `HomeView` 的筛选区以轻量 market command band 呈现，搜索、类别、issuer、yield、reset 属于同一过滤区域，表格在 brief/activity 前作为主任务区域出现。
- [x] 2.2 实现轻量筛选区：减少独立卡片感，搜索左置或前置，类别 chips 支持横向流式/滚动，issuer/yield 与 reset 同组。
- [x] 2.3 保持 URL 参数、过滤逻辑、统计条全局口径、空态 reset 行为不变。

## 3. 详情页布局

- [x] 3.1 先写失败测试：断言详情页顺序为价格头 → 交易/盘口区 → 卖单/买单明细 → 浏览型内容 → 收益 → 历史。
- [x] 3.2 先写失败测试：断言交易台提供 Buy / Sell / Bid 三个 mode，Place Bid 不再作为左列中后段独立区块。
- [x] 3.3 实现统一交易台：复用既有 Buy/Sell 逻辑，并将 Place Bid 嵌入第三个 mode，保留连接钱包、网络守卫、余额、状态反馈。
- [x] 3.4 将卖单/买单表提前到资产介绍、AI insight、YieldPanel、TradeHistoryTable 之前，保留 `sell-orders` / `buy-orders` anchor 与订单簿点击高亮。
- [x] 3.5 保留移动端单列可读性，避免 sticky 交易台遮挡内容。

## 4. 验证

- [x] 4.1 运行相关测试：`cd web && npm test -- assets-read-state.test.tsx market-components.test.tsx listings-table.test.tsx order-book-view.test.tsx`
- [x] 4.2 运行全量前端测试：`cd web && npm test`
- [x] 4.3 启动本地开发服务器并用浏览器检查 `/` 与 `/asset/1` 首屏；若链读导致 skeleton，至少验证 DOM 顺序与无新增 hydration warning。
- [x] 4.4 更新 graphify：`python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`。
- [x] 4.5 `openspec validate compact-market-trading-layout --strict --no-interactive` 通过。

## 5. 用户反馈补丁

- [x] 5.1 先写失败测试：无市场事件时首页不展示空 Activity 卡片。
- [x] 5.2 先写失败测试：详情页右侧 rail 中紧凑 DepthChart 位于 BuyPanel 上方，同时 BuyPanel 先于介绍、AI insight、收益和历史等长内容可达。
- [x] 5.3 先写失败测试：Issuer profile 首次渲染时事件派生 volume 保持 hydration-safe skeleton。
- [x] 5.4 实现：隐藏空 Activity、交易台置顶、Issuer profile 水合后再显示事件派生 volume。

## 6. 用户二次反馈校正

- [x] 6.1 先写失败测试：详情页存在三栏交易工作区，移动端源码顺序让 `PriceChart → DepthChart → BuyPanel` 先于订单明细和浏览型内容。
- [x] 6.2 先写失败测试：紧凑深度图使用交易栏高度、收紧字距、普通 HTML 数字轴标签，避免 SVG 拉伸导致字体变形。
- [x] 6.3 先写失败测试：首页筛选区使用轻量 command band，带 `data-market-command-bar`，不再使用 `bg-panel/75 p-3 sm:p-4` 厚卡片样式。
- [x] 6.4 实现：详情页桌面三栏为价格图、盘口/订单、右侧 `DepthChart compact + BuyPanel` sticky rail；首页扩大市场工作区并将侧栏标记为次级 rail。
- [x] 6.5 根据浏览器验证继续压缩：价格头改为 compact quote band，DepthChart compact 降为交易栏小图，Buy mode 将金额输入与主操作按钮放在同一行，确保 1280×720 首屏可见。
