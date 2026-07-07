## MODIFIED Requirements

### Requirement: 市场首页目录
首页 SHALL 为交易所式数据密度布局，落地即市场数据，无营销式 hero。统计条之后 SHALL 直接呈现一个轻量 market command band，将资产搜索、类别筛选、issuer 筛选、yield bucket 筛选和 reset 操作组织在同一过滤区域内；该过滤区域 MUST NOT 呈现为厚重独立卡片。类别 chips 在宽屏不应占用多行以上的主要首屏高度，在窄屏可横向滚动或自然折行但不得把资产表格挤出主要阅读路径。资产表格 SHALL 是首页主任务区域，Market Brief SHALL 作为次级侧栏呈现；Activity 面板 SHALL 仅在当前活跃资产集存在真实链上事件时显示，MUST NOT 在无事件时以空态卡片抢占首页首屏。统计条口径保持全局口径，不随过滤重算。

#### Scenario: 紧凑过滤后浏览资产
- **WHEN** 用户访问首页
- **THEN** 用户在首屏可以看到统计条、紧凑过滤工具栏和资产表格开始区域，搜索、类别、issuer、yield 与 reset 作为同一过滤系统工作

#### Scenario: 过滤行为保持 URL 状态
- **WHEN** 用户修改 category、issuer、yield 或搜索词
- **THEN** URL search params 与资产表格过滤结果同步，统计条仍按全局资产集计算

#### Scenario: 无事件时隐藏 Activity 空态
- **WHEN** 当前市场事件流为空或没有匹配当前活跃资产集的事件
- **THEN** 首页不展示空的 Activity 卡片，侧栏仅保留更有信息价值的内容

### Requirement: 资产详情页
详情页 SHALL 采用交易优先布局：价格头之后进入交易工作区。桌面端交易工作区 SHALL 采用价格图、盘口/订单明细、右侧交易 rail 的三栏布局；右侧交易 rail SHALL sticky，并以紧凑深度图位于统一交易台上方的顺序呈现，确保用户能先理解深度再执行 Buy / Sell / Bid 操作。标准桌面首屏下，Buy mode 的金额输入与主操作按钮 SHOULD 在右侧 rail 内首屏可见。移动端或窄屏源码顺序 SHALL 让右侧交易 rail 先于订单明细之后的介绍、AI insight、收益分配和交易历史出现，避免用户必须滚动穿过浏览型长内容才看到 Buy。统一交易台 SHALL 支持 Buy、Sell、Bid 三种操作入口，避免将挂买单入口放在介绍内容之后。紧凑深度图 SHALL 使用适合交易栏的高度和数字排版，价格轴标签不得因 SVG 拉伸而变形。

#### Scenario: 交易入口优先可见
- **WHEN** 用户打开资产详情页
- **THEN** 用户先看到价格图和右侧 rail 中的紧凑深度图、Buy/Sell/Bid 交易台，卖单/买单明细位于资产介绍与 AI insight 之前
