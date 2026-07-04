# Change: 资产详情页订单簿深度可视化（Order Book + Depth Chart）

## Why

买单深度（buy-depth / V6）上链后，资产详情页已有 SELL/BUY 双侧订单数据，但呈现为两张相距很远的独立表格，缺少交易所级盘口：无统一订单簿、无累计深度、无深度图。这是 `add-hadron-buy-depth` 提案显式遗留的迭代项（"左右双边订单簿留作后续迭代"）。本变更为纯前端呈现层增强，不改合约、不改数据。

## What Changes

- 新增纯函数聚合层 `web/lib/orderBook.ts`：`buildOrderBook`（同价位聚合 + asks 升序 / bids 降序 + 累计 cum + best/mid/spread/spreadPct + maxCumulative）与 `buildDepthSeries`（深度图阶梯点）。
- 新增 `web/components/asset/OrderBook.tsx`：统一订单簿卡片（asks↑ / spread 行 / bids↓ + 累计深度背景条 + You 角标），点击价位滚动定位到对应明细表。
- 新增 `web/components/asset/DepthChart.tsx`：SVG 累计深度面积图（bids 左绿 / asks 右红 / 中线 mid），零新依赖。
- 接线 `web/app/asset/[id]/page.tsx`：右栏 `BuyPanel` 上方插入订单簿 + 深度图；SELL/BUY 明细表加锚点 id 供滚动定位。
- 现有 `ListingsTable`/`BidsTable` 成交/撤单逻辑零改动（保留为操作区）。

## Impact

- Affected specs: `secondary-market`（ADDED 1 需求：订单簿深度可视化）
- Affected code: `web/lib/orderBook.ts`（新）、`web/components/asset/OrderBook.tsx`（新）、`web/components/asset/DepthChart.tsx`（新）、`web/app/asset/[id]/page.tsx`（接线 + 锚点）、`web/test/order-book.test.ts`（新）、`web/test/order-book-view.test.tsx`（新）
- 规模：中任务（纯前端，4 处改动 + 2 处测试），tasks.md 为 bite-sized 步骤，审批后交 codex 按 TDD 实现

## Acceptance Criteria（Clarify Gate 产出）

1. **GIVEN** 资产同价位有多笔挂单/买单 **WHEN** 打开订单簿 **THEN** 同价位聚合为一档（size 求和、显示订单数），asks 升序、bids 降序，各档 TOTAL 为沿最优价方向的累计量
2. **GIVEN** 双边均有订单 **WHEN** 查看 spread 行 **THEN** 显示 mid 价与 `spread (x.x%)`；单边缺失时 spread 行显示 `—` 且只渲染存在的一侧
3. **GIVEN** 订单簿有深度 **WHEN** 查看每档 **THEN** 右对齐累计背景条宽度 = `cum / maxCumulative`，asks 红 / bids 绿；含自己订单的价位有 `You` 角标
4. **GIVEN** 双边深度 **WHEN** 查看深度图 **THEN** SVG 阶梯面积图以 mid 为中线、bids 向左绿、asks 向右红，cum 单调递增
5. **GIVEN** 订单簿某价位 **WHEN** 点击该行 **THEN** 平滑滚动到下方对应 SELL/BUY 明细表并短暂高亮
6. `web/lib/orderBook.ts` 纯函数单测覆盖聚合/排序/累计/spread/单边缺失/maxCumulative 全绿；`npm run test` + `npm run lint` + `npm run build` 通过；本地三页 200，资产页右栏出现订单簿 + 深度图

## Out of Scope

- 订单簿行受控展开（价位聚合多笔订单无法 1:1 映射明细行）
- 深度图 hover tooltip / 十字光标
- 合约、K 线、AI 快照 schema 变更
- 自动撮合、订单过期、价格档位聚合精度（tick size）配置

## 技术决策（已与用户确认）

1. 深度图采用**手写 SVG**，不复用 lightweight-charts（时间轴库做价格轴深度图需 hack，SVG 更可控更轻、零新依赖）
2. 点击价位 = **滚动定位到明细表**，不强行展开某行（价位聚合多笔，无 1:1 映射），保证现有表格零改动
3. 单位与换算全程复用 `unitPriceToSharePrice`/`formatUsdc`/`formatShares`；聚合与累计全程 bigint，仅展示层 `Number()` 转换
