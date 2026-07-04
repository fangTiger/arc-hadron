## ADDED Requirements

### Requirement: 订单簿深度可视化
资产详情页 SHALL 提供统一订单簿与累计深度图，将同一 tokenId 的卖单（listings）与买单（bids）聚合为交易所级盘口。订单簿 SHALL 按价位聚合（同价位多单合并数量并计数），卖侧升序、买侧降序，各档展示沿最优价方向的累计数量；SHALL 呈现 spread 行（mid 价与价差百分比）；SHALL 以背景条按 `cum / maxCumulative` 表示每档累计深度。系统 SHALL 提供独立的累计深度面积图。所有价格与数量换算 MUST 复用现有 unit price / SHARE_SCALE 口径，聚合与累计 MUST 全程使用 bigint。本能力为纯呈现层，MUST NOT 改动挂单/购买/买单/撤单的链上行为。

#### Scenario: 同价位聚合与累计
- **WHEN** 某 tokenId 存在多笔同价位挂单或买单
- **THEN** 订单簿将同价位合并为一档（数量求和、显示订单数），卖侧按价升序、买侧按价降序，各档 TOTAL 为沿最优价方向逐档累加的累计数量

#### Scenario: 双边盘口与 spread
- **WHEN** 卖单与买单双边均存在
- **THEN** spread 行显示 mid 价与 `spread (x.x%)`；深度图以 mid 为中线，买侧向左（绿）、卖侧向右（红），累计量单调递增

#### Scenario: 单边或空盘口降级
- **WHEN** 仅存在买单、仅存在卖单或双边均无
- **THEN** 只渲染存在的一侧，spread 行显示 `—`，深度图相应仅画一侧或显示等待深度的空态，不抛错

#### Scenario: 自有订单标注
- **WHEN** 某价位聚合中含当前地址自己的挂单或买单
- **THEN** 该档展示 `You` 角标

#### Scenario: 点击价位定位明细
- **WHEN** 用户点击订单簿某价位行
- **THEN** 页面平滑滚动到下方对应的卖单表（SELL ORDERS）或买单表（BUY ORDERS）并短暂高亮，现有明细表的成交/撤单交互不受影响
