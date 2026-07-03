# activity-feed Specification

## Requirements

### Requirement: 链上实时动态流
首页 SHALL 滚动展示来自**两个合约**的事件动态——`HadronAssets` 的 `AssetIssued` 与 `HadronMarket` 的 `OfferingCreated / OfferingClosed / PrimarySale / Listed / Cancelled / Purchased`，每条含事件类型、资产、数量、金额、时间与 Arc explorer 交易链接；MUST 仅展示真实链上事件。

#### Scenario: 成交后动态流出现记录
- **WHEN** 任意钱包完成一笔购买且交易上链
- **THEN** 动态流在下一个轮询周期内出现该记录，点击跳转 explorer 对应交易

### Requirement: 事件扫描健壮性
事件拉取 SHALL 从部署区块起按区块范围分块扫描并增量更新，以 `txHash + logIndex` 去重，RPC 限流或失败时采用指数退避重试；页面 MUST 不重复渲染、不丢失事件。

#### Scenario: 事件去重
- **WHEN** 同一事件因重叠扫描窗口被拉取两次
- **THEN** 动态流与交易历史仅渲染一条记录

#### Scenario: RPC 限流退避
- **WHEN** RPC 返回限流错误
- **THEN** 拉取按指数退避重试，恢复后补齐缺失区间的事件
