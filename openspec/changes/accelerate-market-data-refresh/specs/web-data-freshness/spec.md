## MODIFIED Requirements

### Requirement: 交易后精确失效
Web 客户端 SHALL 提供 `applyTxInvalidation(queryClient, intent)` 纯函数（同时导出 `TX_INVALIDATION_PREDICATES` 供单测），按 intent 类型对相关合约调用（`functionName`）和首页资产快照 query key 精确执行 `queryClient.invalidateQueries`。intent 类型限定为 `"buy" | "sell" | "cancel" | "claim"`。因 wagmi v2 的 `useReadContract` / `useReadContracts` 由内部管理 queryKey（用户无法覆盖），链上读取失效采用 predicate 匹配（复用 `invalidationPredicates.ts`），识别 wagmi 内部 queryKey 中的合约地址与 `functionName`。

调用职责 MUST 位于标准交易 hooks（`useBuyPrimary` / `useBuyListing` / `useListForSale` / `useCancelListing` / `useCancelBid` / `useClaimYield`）：当交易状态首次进入 `success` 时调用与动作对应的 `applyTxInvalidation`。`AssistantDock` MUST NOT 重复实现相同失效副作用。

#### Scenario: buy 后失效
- **WHEN** intent = "buy"、交易 confirm 成功
- **THEN** invalidate 命中以下 wagmi 查询：market 合约的 `listingCount` / `listingsByToken` / `getListing`；assets 合约的 `balanceOf` / `getAsset` / `assetCount` / `offeringCount`；yield 合约的 `pendingYield`
- **AND** invalidate 命中首页资产快照 query key

#### Scenario: sell 后失效
- **WHEN** intent = "sell"、交易 confirm 成功
- **THEN** invalidate 命中：market 合约的 `listingCount` / `listingsByToken` / `getListing`；assets 合约的 `balanceOf` / `getAsset`
- **AND** invalidate 命中首页资产快照 query key

#### Scenario: cancel 后失效
- **WHEN** intent = "cancel"、交易 confirm 成功
- **THEN** invalidate 命中：market 合约的 `listingCount` / `listingsByToken` / `getListing` / `bidCount` / `bidsByToken` / `getBid`

#### Scenario: claim 后失效
- **WHEN** intent = "claim"、交易 confirm 成功
- **THEN** invalidate 命中：yield 合约的 `pendingYield`

#### Scenario: 交易反馈延迟
- **GIVEN** 用户通过任意 UI 入口提交 buy/sell/cancel/claim 交易
- **WHEN** 对应标准交易 hook 报 `status === "success"`
- **THEN** 相关 UI 字段在 2 秒内触发最新数据校准

#### Scenario: 成功状态只失效一次
- **GIVEN** 一个交易 hook 已处理当前交易的成功状态
- **WHEN** 组件因其他状态变化再次渲染
- **THEN** 不为同一成功交易重复执行缓存失效

#### Scenario: 助手无重复失效
- **WHEN** 检查 `web/components/assistant/AssistantDock.tsx`
- **THEN** 不包含 `applyTxInvalidation` 调用或无参数的 `queryClient.invalidateQueries()` 调用

## ADDED Requirements

### Requirement: 首页指标分段可用
首页统计条 SHALL 按数据依赖分别展示加载状态。`AVG YIELD` 与 `ASSETS` MUST 在资产快照可用后立即显示；`TVL`、`24H VOL` 与 `TRADES` MUST 在事件数据尚未完成时继续显示骨架。系统 MUST NOT 用伪造事件替代加载中的事件数据。

#### Scenario: 资产先于事件可用
- **GIVEN** 资产快照已加载且事件索引仍在进行
- **WHEN** 首页渲染统计条
- **THEN** `AVG YIELD` 与 `ASSETS` 显示真实资产值
- **AND** `TVL`、`24H VOL` 与 `TRADES` 保持骨架状态

#### Scenario: 全部数据可用
- **GIVEN** 资产快照与事件索引均已完成
- **WHEN** 首页渲染统计条
- **THEN** 五项指标均显示按现有市场口径计算的真实值
