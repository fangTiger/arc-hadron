# Design: 双边订单簿升级

> 完整设计见 `docs/plans/2026-07-04-bilateral-order-book-design.md`。本文件为 OpenSpec 归档留存摘要。

## 本质
纯前端呈现层重写：纵向堆叠 → 左右对排双边盘口。**复用现有 `buildOrderBook` 模型**
（asks/bids/mid/spread/maxCumulative 均已具备），零数据层、零 hook、零合约改动，DepthChart 不动。

## 布局决策
- **排名对齐 + 中间 spread + 镜像 + 中锚深度条**：bids 左（`TOTAL|SIZE|PRICE`）、asks 右
  （`PRICE|SIZE|TOTAL`），价格贴中，最优价同顶行。
- 深度条从中缝向外生长，宽度 `cum/maxCumulative`，bids 绿(up)/asks 红(down)。
- 中间 spread 栏 MID/SPREAD/%；单边或空显示 "—"。
- 两侧档数不等时较短侧补空占位行，逐行排名对齐。
- 每侧上限 12 档（超出暂不做 "N more"，YAGNI）；窄屏 `<sm` 隐 TOTAL 列。
- 保留 "You" 徽章、onSelectPrice 点击滚动、空态 "No open orders"。

## 组件
- 重写 `OrderBook.tsx` 的 `OrderBookView`；容器 `OrderBook`（useBids+useListings+buildOrderBook）
  与 props/onSelectPrice 签名不变（AssetDetailView 集成点零改动）。行/深度条/spread 栏抽为小组件。

## 验收标准
- **AC1**：左右双列，bids 左镜像、asks 右，价格贴中，最优价同顶行。
- **AC2**：中锚深度条从中缝向外，宽度 cum/maxCumulative，bids 绿/asks 红。
- **AC3**：中间 spread 栏 MID/SPREAD/%；单边或空显示 "—"。
- **AC4**：两侧档数不等时较短侧补空行，逐行排名对齐。
- **AC5**：保留 "You" 徽章与 onSelectPrice；AssetDetailView 集成点零改动。
- **AC6**：窄屏隐 TOTAL 列，双列仍可读。
- **AC7**：TDD 全绿，web 现有测试无回归，DepthChart 不受影响。
