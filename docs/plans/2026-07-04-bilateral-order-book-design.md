# 双边订单簿升级 — 设计文档

> 日期：2026-07-04
> 状态：设计已确认，待 OpenSpec 提案
> 类型：中任务（纯前端呈现层）
> 分工：Claude 设计/审查/取证，codex exec 实现（TDD）

## 1. 背景与目标

当前资产页订单簿是**纵向堆叠**：asks（倒序）在上 → SpreadRow(MID/SPREAD) 居中 → bids 在下，
下方另有 SVG DepthChart。本变更将订单簿升级为**左右对排双边盘口**（排名对齐 + 中间 spread），
提升交易所级盘口的双边可读性。

**本质**：纯前端呈现层重写。**复用现有 `buildOrderBook` 模型**（asks/bids/bestAsk/bestBid/
mid/spread/spreadPct/maxCumulative 均已具备），**零数据层、零 hook、零合约改动**。
DepthChart 与页面其余部分不动。

## 2. 布局（排名对齐 + 中间 spread，镜像，中锚深度条）

```
              SECONDARY MARKET · ORDER BOOK          N LEVELS
 +--------- BIDS ---------+- MID 2.05 -+--------- ASKS ---------+
 | TOTAL   SIZE    PRICE  |  SPR 0.10  |  PRICE    SIZE   TOTAL  |
 |  120     40    2.00 <==|   (4.9%)   |==> 2.10    30      30   |
 |   80     40    1.95 <==|            |==> 2.20    50      80   |
 |          .            |            |         .               |
 +-----------------------+------------+-------------------------+
             [ SVG 深度图（不动）]
```

- **左 bids 镜像**：列序 `TOTAL | SIZE | PRICE`，价格贴中；**右 asks**：`PRICE | SIZE | TOTAL`，
  价格贴中。两侧最优价紧邻中间 spread 栏。
- **中锚深度条**：bids 条从中缝向左生长、asks 从中缝向右生长，宽度 = `cum / maxCumulative`，
  形成向外的"山形"。颜色沿用 bids 绿(up)/asks 红(down)。
- **中间 spread 栏**：竖向居中显示 MID / SPREAD / spread%；无双边（缺 bestBid 或 bestAsk）时显示 "—"。
- **排名对齐**：第 i 行 = 第 i 优买单 ⟷ 第 i 优卖单。两侧档数不等时，**较短侧补空占位行**，
  保证逐行可比、最优价永远同处顶行。
- 保留 **"You" 徽章**（自有挂单）与 **onSelectPrice**（点买单行滚到 bid 表单、卖单行滚到 ask 表单，
  签名/滚动逻辑不变）。

## 3. 细节决策

- **档位上限**：每侧最多展示 12 档（防未来密集盘口撑爆）；超出暂不做 "N more"（YAGNI，后续迭代）。
  当前 testnet 盘口稀疏，通常全展示。
- **响应式**：`sm+` 双列全展示；窄屏 `<sm` 隐藏两侧 TOTAL 列（保留 PRICE|SIZE）以塞下双列，
  不另维护堆叠版。
- **空态**：无任何挂单时中间显示 "No open orders"。

## 4. 组件与数据流

- 重写 `web/components/asset/OrderBook.tsx` 的 `OrderBookView`（数据获取的默认导出容器 `OrderBook`
  与 props/onSelectPrice 签名不变，保证 AssetDetailView 集成点零改动）。
- 行渲染、深度条、spread 栏抽为聚焦小组件，便于独立测试。
- 数据来源不变：`OrderBook` 容器仍 `useBids` + `useListings` + `buildOrderBook`。

## 5. 测试策略（TDD）

- `buildOrderBook` 既有单测不动（模型未变）。
- 新增 `OrderBookView` 组件测试（vitest + testing-library）：
  - 镜像列序（左 TOTAL|SIZE|PRICE，右 PRICE|SIZE|TOTAL）
  - 排名对齐：两侧档数不等时较短侧补空行，最优价同顶行
  - 中锚深度条宽度 = cum/maxCumulative，方向正确
  - spread 栏：有双边显示 MID/SPREAD/%，单边或空显示 "—"
  - 空态 "No open orders"
  - onSelectPrice：点 bid 行触发 side="bid"，ask 行触发 side="ask"
  - "You" 徽章渲染
  - 窄屏隐 TOTAL 列
- 目标：web 现有测试全绿无回归。

## 6. 不在范围（Out of Scope）

- 数据层 / hook / 合约改动、`buildOrderBook` 模型改动
- DepthChart 改动、下单表单改动
- "N more" 折叠、价格阶梯（DOM）视图、逐笔成交流

## 7. 验收标准（Acceptance Criteria）

- **AC1**：订单簿呈左右双列，bids 左（镜像 TOTAL|SIZE|PRICE）、asks 右（PRICE|SIZE|TOTAL），
  价格贴中，最优价同处顶行。
- **AC2**：中锚深度条从中缝向外生长，宽度按 cum/maxCumulative，bids 绿 / asks 红。
- **AC3**：中间 spread 栏显示 MID/SPREAD/%；单边或空盘口显示 "—"。
- **AC4**：两侧档数不等时较短侧补空行，逐行排名对齐。
- **AC5**：保留 "You" 徽章与 onSelectPrice 点击滚动；AssetDetailView 集成点零改动。
- **AC6**：窄屏隐藏 TOTAL 列，双列仍可读。
- **AC7**：TDD 全绿，web 现有测试无回归，DepthChart 不受影响。
