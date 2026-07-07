## MODIFIED Requirements

### Requirement: 买单可读接口与前端呈现
合约 SHALL 暴露 `bidCount`、按 `bidId` 的买单档案 getter 与按 `tokenId` 查询活跃买单的 `bidsByToken` 接口。前端 SHALL 在资产详情页的交易优先区域展示 SELL ORDERS 与 BUY ORDERS 明细，并在统一交易台内提供 PLACE BID mode；买单成交 MUST 与既有成交在价格序列、24H 指标与 AI 快照三处以一致口径计入。

#### Scenario: 挂买单入口不被介绍内容遮挡
- **WHEN** 用户打开资产详情页并希望挂买单
- **THEN** 用户可以在详情页交易台切换到 Bid mode 完成挂买单，不需要滚动穿过资产介绍、文档或 AI insight
