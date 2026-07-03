## MODIFIED Requirements

### Requirement: 链上实时动态流
首页 SHALL 滚动展示来自**三个合约**的事件动态——`HadronAssets` 的 `AssetIssued`、`HadronMarket` 的 `OfferingCreated / OfferingClosed / PrimarySale / Listed / Cancelled / Purchased / BidPlaced / BidFilled / BidCancelled` 与 `HadronYield` 的 `YieldDeposited / YieldClaimed`，每条含事件类型、资产、数量或金额、时间与 Arc explorer 交易链接；MUST 仅展示真实链上事件；收益事件 MUST 按 USDC 金额格式化（不复用份额数量语义）。

#### Scenario: 成交后动态流出现记录
- **WHEN** 任意钱包完成一笔购买且交易上链
- **THEN** 动态流在下一个轮询周期内出现该记录，点击跳转 explorer 对应交易

#### Scenario: 收益入金进入动态流
- **WHEN** 任意钱包对某资产入金收益
- **THEN** 动态流出现 YIELD 记录（USDC 金额），交易历史表不出现该记录
