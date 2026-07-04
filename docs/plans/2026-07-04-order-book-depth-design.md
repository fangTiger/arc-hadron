# 设计：资产详情页订单簿深度可视化（Order Book + Depth Chart）

> 日期：2026-07-04
> 类型：中任务（纯前端，4 处改动，需设计决策）
> 前置：buy-depth（V6）已上链，买单/卖单数据与撮合交互均就绪
> 承接：`add-hadron-buy-depth` 提案遗留项——"左右双边订单簿留作后续迭代"

## 1. 背景与问题

资产详情页（`web/app/asset/[id]/page.tsx`）已聚合 K 线、AI 洞察、SELL/BUY 订单表、收益、成交历史等 9 个模块，功能完整。但盘口呈现是**两张相距很远的独立表格**（`ListingsTable` 与 `BidsTable`，中间还隔着 `PlaceBidPanel`），各自按价格排序，缺少交易所级的：

- 统一订单簿（asks 在上、bids 在下、中间 spread 行）
- 累计深度列（TOTAL / cum）与深度背景条
- 累计深度面积图

数据（`useBids`/`useListings`）与撮合交互（行内 Fill/Buy）都已存在，缺的只是"专业盘口"这层呈现。

## 2. 目标与边界

**范围内**
- 新增只读**订单簿卡片**：asks 升序聚合 / spread 行 / bids 降序聚合，带累计深度背景条。
- 新增**深度图**：SVG 阶梯累计面积图（bids 左绿 / asks 右红，中线为 mid）。
- 接入详情页右栏，置于 `BuyPanel` 上方。
- 点击订单簿某价位 → 平滑滚动定位到下方对应明细表并高亮。

**范围外（Out of Scope）**
- 不改动 `ListingsTable`/`BidsTable` 的成交/撤单逻辑（保留为"操作区"）。
- 不改合约、不改 K 线组件、不改 AI 快照 schema。
- 不做订单簿行受控展开（一个价位聚合多笔订单，无法 1:1 映射明细行）——列为 stretch goal。
- 不做深度图 hover tooltip（阶梯 + 中线足够，后续迭代）。

## 3. 架构（3 新文件 + 1 处接线）

```
web/lib/orderBook.ts              ← 纯函数聚合层（无 React，TDD 主战场）
web/components/asset/OrderBook.tsx    ← 订单簿表（asks↑/spread/bids↓ + 累计条）
web/components/asset/DepthChart.tsx   ← SVG 累计深度面积图
web/app/asset/[id]/page.tsx       ← 右栏接线 + SELL/BUY 明细表加锚点 id
```

数据获取：`OrderBook`/`DepthChart` 各自调用现有 `useBids(tokenId)` + `useListings(tokenId)`。wagmi/react-query 按 queryKey 去重，同 tokenId 的重复调用不会二次拉链。

## 4. 数据模型与聚合（`lib/orderBook.ts`）

输入 view 类型（已存在，不改）：
- `BidView  { id, bidder, pricePerShare, remaining, isOwn }`
- `ListingView { id, seller, pricePerShare, remaining, isMine }`

价格 `pricePerShare` 为 **unit price**（每链上单位价，bigint）；数量 `remaining` 为 **units**（bigint，SHARE_SCALE=100）。

```ts
export interface OrderBookLevel {
  price: bigint;        // unit price
  size: bigint;         // 该价位聚合的 remaining 总量（units）
  cum: bigint;          // 从最优价累计到本档的总量（units）
  count: number;        // 该价位聚合的订单数
  isOwn: boolean;       // 该价位是否含自己的订单（高亮用）
}

export interface OrderBook {
  asks: OrderBookLevel[];   // 升序（最优卖价 = 最低价在前）
  bids: OrderBookLevel[];   // 降序（最优买价 = 最高价在前）
  bestAsk: bigint | null;
  bestBid: bigint | null;
  mid: bigint | null;       // (bestAsk + bestBid) / 2，单边缺失时 null
  spread: bigint | null;    // bestAsk - bestBid，单边缺失时 null
  spreadPct: number | null; // spread / mid * 100
  maxCumulative: bigint;    // max(asks.cum 末档, bids.cum 末档)，归一化用
}

export function buildOrderBook(input: {
  bids: BidView[];
  listings: ListingView[];
}): OrderBook;
```

**聚合规则**
- 按 `price` 分组，`size = Σ remaining`，`count = 组内订单数`，`isOwn = 组内任一 isOwn/isMine`。
- asks 升序、bids 降序后，各自沿方向累加得 `cum`。
- `bestAsk = asks[0].price`，`bestBid = bids[0].price`（各自最优在前）。
- `mid/spread` 用 unit price 计算（SHARE_SCALE 抵消，与展示无关）；`spreadPct = Number(spread) / Number(mid) * 100`。
- 单边缺失（只有 bids 或只有 asks 或全空）：该侧数组为空，`mid/spread/spreadPct = null`，spread 行显示 `—`。
- `maxCumulative`：两侧末档 `cum` 的最大值；全空时为 `0n`（背景条宽度按 0 处理，避免除零）。

深度图数据（复用同一 OrderBook，或独立导出）：
```ts
export interface DepthPoint { price: bigint; cum: bigint }   // unit price / units
export function buildDepthSeries(book: OrderBook): {
  bids: DepthPoint[];   // 从 mid 向低价，cum 递增
  asks: DepthPoint[];   // 从 mid 向高价，cum 递增
};
```

## 5. 组件

### 5.1 `OrderBook.tsx`（presentational）
- props：`{ tokenId: bigint }`（内部调 hooks），或 `{ book, isLoading }`（便于测试）——采用**双导出**：默认容器组件调 hooks，命名导出 `OrderBookView({ book, isLoading, onSelectPrice })` 接受纯数据，供快照测试。
- 布局：卡片标题 `ORDER BOOK`；三列 `PRICE / SIZE / TOTAL`，等宽字体。
  - asks 段：**倒序渲染**（最高价在上、最优卖价贴近 spread 行），文字红（`text-down`）。
  - spread 行：居中显示 `mid`（share price）+ `SPREAD x.xx (x.x%)`。
  - bids 段：降序（最优买价在上），文字绿（`text-up`）。
  - 每行右对齐半透明累计条：宽度 `= cum / maxCumulative * 100%`，asks 红底、bids 绿底。
  - 含自己订单的价位加 `You` 角标。
- 单位换算：价格 `formatUsdc(unitPriceToSharePrice(price))`；数量 `formatShares(size)` / `formatShares(cum)`。
- 交互：行 `onClick` → `onSelectPrice("ask"|"bid")` → 页面滚动到 `#sell-orders` / `#buy-orders` 锚点并短暂高亮。
- 空态：无任何订单时显示 `No open orders`。

### 5.2 `DepthChart.tsx`（SVG，不用 lightweight-charts）
- 决策：lightweight-charts 是**时间轴**库，做价格轴深度图需 hack（把 price 塞进 time 轴），坐标/crosshair 会打架。手写 SVG 更可控、更轻（~120 行）、零新依赖。
- 结构：`viewBox="0 0 320 160"`，中线 x=160 为 mid；
  - bids：从中线向左，`buildDepthSeries().bids` 映射为阶梯 `<path>` 面积（绿 `#34d399`，填充 `rgba(52,211,153,0.18)`）。
  - asks：从中线向右，阶梯 `<path>` 面积（红，用现有 down 色）。
  - x 轴按 price 线性映射（左端 = 最低 bid 价，右端 = 最高 ask 价，mid 居中）；y 轴按 `cum / maxCumulative` 归一。
  - 中线虚线 + mid 价标签；两端价签。
- `autoSize` 宽度：外层 `w-full`，SVG `preserveAspectRatio="none"` 或用 `viewBox` + `width=100%`。
- 空态 / 单边：单边只画一侧；全空显示 `Awaiting order book depth`。

## 6. 接线（`app/asset/[id]/page.tsx`）
- 右栏（当前只有 `<BuyPanel/>`）改为：
  ```tsx
  <div className="lg:sticky lg:top-24 space-y-6">
    <OrderBook tokenId={asset.tokenId} onSelectPrice={scrollToOrders} />
    <DepthChart tokenId={asset.tokenId} />
    <BuyPanel asset={asset} />
  </div>
  ```
- `ListingsTable` 外层 section 加 `id="sell-orders"`，`BidsTable` 加 `id="buy-orders"`（或在页面包裹层加锚点 div）。
- `scrollToOrders(side)`：`document.getElementById(...).scrollIntoView({ behavior: "smooth" })` + 加一个短暂 ring 高亮（`useState` 计时 1.2s）。
- 移动端（`< lg`）：右栏在主列下方，订单簿/深度图/买入面板顺序堆叠，均全宽。

## 7. 测试策略（TDD，RED → GREEN → REFACTOR）

新增 `web/test/order-book.test.ts`（纯函数，主覆盖）：
1. 同价位多单聚合：`size` 求和、`count` 计数、`isOwn` 或运算。
2. 排序：asks 升序、bids 降序。
3. 累计 `cum`：沿最优价方向逐档累加正确。
4. `bestAsk/bestBid/mid/spread/spreadPct` 数值正确（含 unit price → 不受 SHARE_SCALE 影响的断言）。
5. 单边缺失：只有 bids / 只有 asks / 全空 → mid/spread/spreadPct 为 null，另一侧数组空。
6. `maxCumulative` = 两侧末档 cum 最大值；全空为 0n。
7. `buildDepthSeries`：bids 从 mid 向低、asks 从 mid 向高，cum 单调递增。

组件测试 `web/test/order-book-view.test.tsx`：
- `OrderBookView` 渲染 asks/bids 行数、spread 文案、`You` 角标、累计条宽度比例（style width）。
- `DepthChart` 空态 / 单边 / 双边路径存在性（快照或 path 段数）。

验收命令（证据先于断言）：
- `cd web && npm run test`（vitest 全绿，含新测试）
- `cd web && npm run lint`
- `cd web && npm run build`
- 手动：本地 `npm run dev`，资产页右栏出现订单簿 + 深度图，点击价位滚动定位。

## 8. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 重复调用 useBids/useListings 二次拉链 | react-query 按 queryKey 去重，实测同 tokenId 不重复请求 |
| SVG 深度图坐标计算易错 | 抽 `buildDepthSeries` 为纯函数并单测；组件只做映射渲染 |
| bigint 除法精度（spreadPct/条宽） | 仅在展示层 `Number()` 转换，聚合与累计全程 bigint |
| 破坏现有明细表 | 明细表零改动，仅外层加锚点 id；订单簿为纯新增 |
| 移动端右栏堆叠拥挤 | 深度图高度 160px；订单簿限制最多显示档位（如各侧 12 档 + "N more"） |

## 9. 交付流程

1. 本设计文档提交 git。
2. OpenSpec 提案 `add-order-book-depth`：在 `secondary-market` 能力 ADDED「订单簿深度可视化」需求 + bite-sized `tasks.md`。
3. `openspec validate add-order-book-depth --strict --no-interactive`。
4. 将 `tasks.md` 交给 codex（`codex` MCP）按 TDD 实现；Claude 交叉检查（Codex 自审 + Claude 复核）与验收。
5. 全绿后归档，合并 delta 到 `specs/secondary-market/spec.md`。
