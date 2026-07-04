# Change: 双边订单簿升级 — 左右对排盘口（排名对齐 + 中间 spread）

## Why

当前订单簿是纵向堆叠（asks 上 / spread 中 / bids 下）。升级为交易所标准的**左右对排双边盘口**
（bids 左、asks 右，排名对齐，价格贴中，中锚深度条），提升双边盘口的可读性。纯前端呈现层，
复用现有 `buildOrderBook` 模型，零数据/合约改动。

## What Changes

- MODIFIED `secondary-market` 的「订单簿深度可视化」需求：订单簿呈现从纵向堆叠改为**左右双列**
  - bids 左（镜像列序 `TOTAL | SIZE | PRICE`）、asks 右（`PRICE | SIZE | TOTAL`），价格贴中
  - **排名对齐**：第 i 行 = 第 i 优买单 ⟷ 第 i 优卖单；两侧档数不等时较短侧补空占位行
  - **中锚深度条**：从中缝向外生长，宽度 `cum / maxCumulative`，bids 绿 / asks 红
  - 中间 spread 栏（MID/SPREAD/%），单边或空显示 "—"
  - 每侧上限 12 档；窄屏隐藏 TOTAL 列
- 保留：同价位聚合、"You" 徽章、点击价位滚动定位、独立 DepthChart、纯呈现层约束
- 无破坏性：数据层/hook/合约/DepthChart 均不动，AssetDetailView 集成点零改动

## Acceptance Criteria

见 design.md「验收标准」AC1-AC7（对应 `docs/plans/2026-07-04-bilateral-order-book-design.md` §7）。

## Out of Scope

- 数据层 / hook / 合约改动、`buildOrderBook` 模型改动、DepthChart 改动、下单表单改动
- "N more" 折叠、价格阶梯（DOM）视图、逐笔成交流

## Impact

- Affected specs: MODIFIED `secondary-market`（订单簿深度可视化）
- Affected code: 重写 `web/components/asset/OrderBook.tsx` 的 `OrderBookView`（容器与 props 签名不变）；
  新增聚焦子组件与组件测试
