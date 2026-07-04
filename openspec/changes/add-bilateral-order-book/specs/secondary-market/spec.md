## MODIFIED Requirements

### Requirement: 订单簿深度可视化
资产详情页 SHALL 提供**左右对排双边订单簿**与累计深度图，将同一 tokenId 的卖单（listings）与买单（bids）聚合为交易所级盘口。订单簿 SHALL 按价位聚合（同价位多单合并数量并计数），并以**双列排名对齐**呈现：买单在左（镜像列序 `TOTAL | SIZE | PRICE`，价格贴中）、卖单在右（`PRICE | SIZE | TOTAL`，价格贴中），买侧按价降序、卖侧按价升序，两侧最优价同处顶行，各档展示沿最优价方向的累计数量；两侧档数不等时较短侧 SHALL 补空占位行以保持逐行排名对齐；每侧 SHALL 至多展示 12 档。系统 SHALL 在两列中间呈现 spread 栏（mid 价与价差百分比）；SHALL 以**中锚背景条**按 `cum / maxCumulative` 表示每档累计深度（买侧从中缝向左、卖侧从中缝向右生长）。系统 SHALL 提供独立的累计深度面积图。所有价格与数量换算 MUST 复用现有 unit price / SHARE_SCALE 口径，聚合与累计 MUST 全程使用 bigint。本能力为纯呈现层，MUST NOT 改动挂单/购买/买单/撤单的链上行为，MUST NOT 改动数据层 hook 与 `buildOrderBook` 模型。

#### Scenario: 同价位聚合与累计
- **WHEN** 某 tokenId 存在多笔同价位挂单或买单
- **THEN** 订单簿将同价位合并为一档（数量求和、显示订单数），买侧按价降序、卖侧按价升序，各档 TOTAL 为沿最优价方向逐档累加的累计数量

#### Scenario: 双边对排盘口与 spread
- **WHEN** 卖单与买单双边均存在
- **THEN** 订单簿呈左右双列，买单在左（镜像，价格贴中）、卖单在右（价格贴中），最优买/卖价同处顶行；中间 spread 栏显示 mid 价与 `spread (x.x%)`；中锚深度条以中缝为界，买侧向左（绿）、卖侧向右（红），累计量单调递增

#### Scenario: 排名对齐补空行
- **WHEN** 买侧与卖侧档数不等
- **THEN** 较短侧补空占位行，使第 i 行始终为第 i 优买单与第 i 优卖单的对排，最优价保持在顶行

#### Scenario: 单边或空盘口降级
- **WHEN** 仅存在买单、仅存在卖单或双边均无
- **THEN** 只渲染存在的一侧（另一侧为空占位），spread 栏显示 `—`，深度图相应仅画一侧或显示等待深度的空态，不抛错

#### Scenario: 自有订单标注
- **WHEN** 某价位聚合中含当前地址自己的挂单或买单
- **THEN** 该档展示 `You` 角标

#### Scenario: 点击价位定位明细
- **WHEN** 用户点击订单簿某价位行
- **THEN** 页面平滑滚动到下方对应的卖单表（SELL ORDERS）或买单表（BUY ORDERS）并短暂高亮，现有明细表的成交/撤单交互不受影响

#### Scenario: 窄屏响应式
- **WHEN** 视口窄于 `sm` 断点
- **THEN** 两侧隐藏 TOTAL 列（保留 PRICE 与 SIZE），双列盘口仍完整可读
