# Tasks: 订单簿深度可视化

> TDD 强制：每个实现步骤先写/跑 RED 测试再写实现。所有命令在 `web/` 目录下执行。
> view 类型（已存在，勿改）：`BidView{id,bidder,pricePerShare,remaining,isOwn}`、`ListingView{id,seller,pricePerShare,remaining,isMine}`。
> price=unit price（bigint），remaining=units（bigint，SHARE_SCALE=100）。

## 1. 聚合层（纯函数，TDD 主战场）

- [x] 1.1 写 RED 测试 `web/test/order-book.test.ts`：覆盖同价位聚合（size 求和 / count / isOwn 或运算）、asks 升序、bids 降序、累计 cum、bestAsk/bestBid/mid/spread/spreadPct、单边缺失（仅 bids / 仅 asks / 全空 → mid/spread/spreadPct=null）、maxCumulative（两侧末档 cum 最大，全空=0n）。
  - 验证：`npm run test -- order-book` 全部 FAIL（模块未实现）
- [x] 1.2 实现 `web/lib/orderBook.ts`：导出 `OrderBookLevel`、`OrderBook`、`DepthPoint` 接口，`buildOrderBook({bids,listings})` 与 `buildDepthSeries(book)`。聚合按 price 分组，沿最优价方向累加 cum；mid/spread 用 unit price 计算，spreadPct 仅 `Number()` 于展示层数值；除零保护（maxCumulative=0n 时条宽按 0）。
  - 验证：`npm run test -- order-book` 全绿
- [x] 1.3 补 `buildDepthSeries` 测试断言：bids 从 mid 向低价、asks 从 mid 向高价、cum 单调递增；单边只返回一侧。
  - 验证：`npm run test -- order-book` 全绿

## 2. 订单簿组件

- [x] 2.1 写 RED 测试 `web/test/order-book-view.test.tsx`：渲染 `OrderBookView({book,isLoading,onSelectPrice})` 断言 asks/bids 行数、spread 文案、`You` 角标、累计条 style width 比例、点击行触发 `onSelectPrice`。
  - 验证：`npm run test -- order-book-view` FAIL
- [x] 2.2 实现 `web/components/asset/OrderBook.tsx`：命名导出 `OrderBookView`（纯数据 props）+ 默认容器组件（内部调 `useBids(tokenId)`+`useListings(tokenId)`，`buildOrderBook` 后传入 View）。三列 PRICE/SIZE/TOTAL，asks 倒序渲染（最优贴近 spread）红、bids 降序绿、中间 spread 行；每行右对齐半透明累计条 `width = cum/maxCumulative`；价格 `formatUsdc(unitPriceToSharePrice(price))`、数量 `formatShares`；空态 `No open orders`；行 `onClick` 调 `onSelectPrice("ask"|"bid")`。
  - 验证：`npm run test -- order-book-view` 全绿

## 3. 深度图组件

- [x] 3.1 写 RED 测试（并入 `order-book-view.test.tsx` 或新增 `depth-chart.test.tsx`）：`DepthChart` 空态 / 单边 / 双边 SVG path 段存在性。
  - 验证：`npm run test -- depth` FAIL
- [x] 3.2 实现 `web/components/asset/DepthChart.tsx`：SVG `viewBox="0 0 320 160"`、`width=100%`；`buildDepthSeries` → bids 阶梯 `<path>` 面积（绿 `#34d399` / 填充 rgba(52,211,153,0.18)），asks 阶梯 `<path>`（红，复用 down 色）；x 轴 price 线性映射（左=最低 bid、右=最高 ask、mid 居中），y 轴 cum/maxCumulative 归一；中线虚线 + mid 标签 + 两端价签；单边只画一侧、全空显示 `Awaiting order book depth`。默认容器组件调 hooks，命名导出接受纯数据。
  - 验证：`npm run test -- depth` 全绿

## 4. 接线与定位

- [x] 4.1 `web/app/asset/[id]/page.tsx`：右栏包裹层改为 `space-y-6`，在 `<BuyPanel/>` 上方插入 `<OrderBook tokenId={asset.tokenId} onSelectPrice={scrollToOrders} />` 与 `<DepthChart tokenId={asset.tokenId} />`。
- [x] 4.2 为 `ListingsTable`/`BidsTable` 外层加锚点：在 page 中用包裹 div 加 `id="sell-orders"` / `id="buy-orders"`（不改组件内部）；实现 `scrollToOrders(side)`：`getElementById(...).scrollIntoView({behavior:"smooth"})` + `useState` 计时 1.2s 的 ring 高亮。
  - 验证：`npm run dev` 手动确认点击订单簿价位滚动定位并高亮

## 5. 验收（证据先于断言）

- [x] 5.1 `npm run test`（vitest 全量全绿，含新增 order-book / order-book-view / depth 测试）
- [x] 5.2 `npm run lint`
- [x] 5.3 `npm run build`
- [ ] 5.4 本地 `npm run dev`：首页 / portfolio / 资产页均 200，资产页右栏出现订单簿 + 深度图；双边、单边、空盘口三态目视正确；移动端右栏堆叠正常
