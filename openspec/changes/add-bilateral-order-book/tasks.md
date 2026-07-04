# Tasks: 双边订单簿升级

> TDD 强制（RED-GREEN-REFACTOR）。web 测试：`cd web && npm test`；lint：`npm run lint`；build：`npm run build`。
> 纯前端呈现层：复用 `buildOrderBook`，不改数据层/hook/合约/DepthChart。保持现有测试无回归。

## 1. 排名对齐配对（纯逻辑，先行）

- [x] 1.1 RED：`web/test/order-book-pairing.test.ts` — 断言配对函数：等长直接配对；一侧较短时较短侧补 `null` 空占位行；两侧空返回空；各侧超 12 档截断到 12
- [x] 1.2 GREEN：在 `web/lib/orderBook.ts` 或 `web/components/asset/OrderBook.tsx` 内实现 `pairLevels(bids, asks, { max: 12 })` 纯函数，返回 `Array<{ bid: OrderBookLevel | null; ask: OrderBookLevel | null }>`（bids 已降序、asks 已升序，逐行排名对齐）
- [x] 1.3 验证：`cd web && npm test -- order-book-pairing`

## 2. 双边 OrderBookView 重写（组件）

- [x] 2.1 RED：`web/test/order-book-view.test.tsx` — 覆盖：
  - 左 bids 列序 `TOTAL|SIZE|PRICE`、右 asks 列序 `PRICE|SIZE|TOTAL`，价格贴中
  - 最优买/卖价同处顶行
  - 中锚深度条宽度 = `cum/maxCumulative`，买侧向左、卖侧向右，class 含 up/down 色
  - 中间 spread 栏：双边显示 MID/SPREAD/%，单边或空显示 `—`
  - 排名对齐：档数不等时较短侧渲染空占位行
  - 空态 "No open orders"
  - onSelectPrice：点买单行 side="bid"、卖单行 side="ask"
  - "You" 徽章渲染
  - 窄屏隐藏 TOTAL 列（`<sm` 断点 class）
- [x] 2.2 GREEN：重写 `web/components/asset/OrderBook.tsx` 的 `OrderBookView` 为左右双列（排名对齐 + 中锚深度条 + 中间 spread 栏）；行/深度条/spread 栏抽为聚焦子组件
- [x] 2.3 保持容器 `OrderBook`（useBids+useListings+buildOrderBook）与 `OrderBookProps`/`onSelectPrice` 签名不变
- [x] 2.4 验证：`cd web && npm test -- order-book-view`

## 3. 集成核对

- [x] 3.1 确认 `AssetDetailView.tsx` 对 OrderBook 的引用与 onSelectPrice 滚动逻辑零改动、正常工作
- [x] 3.2 确认 DepthChart 不受影响

## 4. 终审验证

- [x] 4.1 全量测试：`cd web && npm test`（现有 + 新增全绿，无回归）
- [x] 4.2 lint：`cd web && npm run lint`（干净）
- [x] 4.3 build：`cd web && npm run build`（沙箱网络限制导致 Google Fonts 获取失败；未做 workaround）
- [x] 4.4 逐条核对 design.md AC1-AC7，取证记录
