## ADDED Requirements

### Requirement: 市场日报首页紧凑呈现
首页右侧的市场 AI 日报（MarketBrief）SHALL 以紧凑高度呈现：生成内容 SHALL 限制在固定最大高度内并支持内部滚动（含底部渐隐提示），避免在窄侧栏中撑高、破坏首页布局。该紧凑呈现 MUST 仅作用于首页 MarketBrief；资产详情页的资产洞察（InsightPanel）布局 MUST 保持不变。紧凑呈现为纯展示层，MUST NOT 改动生成、缓存或 SSE 行为。

#### Scenario: 首页日报限高滚动
- **WHEN** 首页 MarketBrief 生成较长的日报内容
- **THEN** 内容限制在固定最大高度内、可内部滚动，首页整体布局不被撑高

#### Scenario: 资产页洞察不受影响
- **WHEN** 用户在资产详情页查看资产洞察
- **THEN** 洞察面板按原有布局完整展示，不施加紧凑限高
